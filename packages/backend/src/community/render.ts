/**
 * Script de maintenance : rend les visuels de la page Figma Community
 * (scenes.ts) en PNG 1920x1080 dans assets/community/.
 *
 *   npm run community:build --workspace packages/backend
 *
 * Comme og/render.ts, Playwright n'est VOLONTAIREMENT pas une dépendance du
 * dépôt (voir l'en-tête de og/render.ts) : le fournir avant de lancer la
 * commande, par exemple
 *
 *   npx --yes playwright@1.49.0 install --with-deps chromium
 *   NODE_PATH="$(npm root -g)" npm run community:build --workspace packages/backend
 *
 * Le plugin rendu est packages/plugin/dist/ui.html tel qu'il est committé :
 * rebuild le plugin avant, si son UI a changé. Le canvas Figma et l'éditeur
 * Slides sont en Inter, la police de ces deux applications : elle doit être
 * installée sur la machine (à défaut, Helvetica ou Arial prennent le relais).
 *
 * Réseau : tout est servi en local. Les slides du deck viennent de
 * assets/mockup slides/, et les appels du plugin à son backend reçoivent des
 * réponses figées (session connectée, export en cours) : rien ne sort de la
 * machine.
 *
 * `--only <motif>` ne rend que les visuels dont le nom contient le motif.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { scenes, type PluginFrame } from './scenes.js';
import { DECK } from './deck.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const SLIDES_DIR = join(ROOT, 'assets/mockup slides');
const OUT_DIR = join(ROOT, 'assets/community');
const PLUGIN_HTML = readFileSync(join(ROOT, 'packages/plugin/dist/ui.html'), 'utf8');

/** Origine fictive des slides (deck.ts, slideUrl). */
const LOCAL = 'https://community.decker.local/';
/** Backend que le plugin appelle (CLAUDE.md : toujours l'URL Vercel dans dist/). */
const BACKEND = /^https:\/\/decker-gamma\.vercel\.app\//;

/** Lots d'un export en cours : les trois premières slides sont déjà dans Slides. */
const EXPORT_JOB = {
  status: 'running',
  batches: DECK.map((s, i) => ({ sourceSlideId: s.id, status: i < 3 ? 'applied' : 'pending' })),
};

function backendReply(url: URL, method: string): unknown {
  if (url.pathname === '/auth/me') return { email: 'alex@example.com' };
  if (url.pathname === '/assets') return { ok: true };
  if (url.pathname === '/export' && method === 'POST') return { jobId: 'community' };
  if (url.pathname.startsWith('/export/')) return EXPORT_JOB;
  return {};
}

async function main(): Promise<void> {
  let chromium: typeof import('playwright').chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    throw new Error("playwright introuvable : installe-le d'abord (voir l'en-tête de ce fichier), il n'est pas une dépendance du dépôt.");
  }
  const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : undefined;

  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  mkdirSync(OUT_DIR, { recursive: true });
  try {

  for (const scene of scenes(PLUGIN_HTML)) {
    if (only && !scene.file.includes(only)) continue;
    // deviceScaleFactor 1 : la sortie est déjà à la taille demandée par Figma.
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    page.on('pageerror', (e) => console.error(`[community] ${scene.file} :`, e.message));
    if (process.env.COMMUNITY_DEBUG) {
      page.on('console', (m) => console.log(`[console] ${m.text()}`));
      page.on('request', (r) => console.log(`[req] ${r.method()} ${r.url().slice(0, 100)}`));
    }

    await page.route('**/*', async (route) => {
      const req = route.request();
      const url = req.url();
      if (url.startsWith('data:') || url.startsWith('about:')) return route.continue();
      if (url.startsWith(LOCAL)) {
        const file = decodeURIComponent(new URL(url).pathname.replace(/^\/slides\//, ''));
        return route.fulfill({ status: 200, contentType: 'image/png', body: readFileSync(join(SLIDES_DIR, file)) });
      }
      if (BACKEND.test(url)) {
        // L'iframe appelle le backend en cross-origin, avec cookies et
        // en-tête Authorization : sans ces en-têtes, Chromium rejette la
        // réponse (ou son preflight) avant que le plugin ne la lise.
        const headers = {
          'access-control-allow-origin': (await req.headerValue('origin')) ?? '*',
          'access-control-allow-credentials': 'true',
          'access-control-allow-headers': 'authorization, content-type',
          'access-control-allow-methods': 'GET, POST, OPTIONS',
        };
        if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
        return route.fulfill({ status: 200, headers, contentType: 'application/json', body: JSON.stringify(backendReply(new URL(url), req.method())) });
      }
      return route.abort();
    });

    await page.setContent(scene.html, { waitUntil: 'load' });

    const plugin = async (name = 'main'): Promise<PluginFrame> => {
      const el = await page.waitForSelector(`iframe[data-plugin="${name}"]`);
      const frame = await el.contentFrame();
      if (!frame) throw new Error(`iframe ${name} sans document`);
      await frame.waitForSelector('.f2s-topbar');
      return frame as unknown as PluginFrame;
    };

    /* Pose le pointeur de la scène (.cursor) sur un élément du plugin, en
       tenant compte de l'échelle de sa fenêtre. */
    const pointAt = async (selector: string, name = 'main'): Promise<void> => {
      const iframe = await page.waitForSelector(`iframe[data-plugin="${name}"]`);
      const box = await iframe.boundingBox();
      const frame = await iframe.contentFrame();
      if (!box || !frame) throw new Error(`iframe ${name} invisible`);
      const r = await frame.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) throw new Error(`introuvable dans le plugin : ${sel}`);
        const b = el.getBoundingClientRect();
        return { x: b.x, y: b.y, w: b.width, h: b.height, vw: window.innerWidth };
      }, selector);
      const scale = box.width / r.vw;
      const x = box.x + (r.x + r.w * 0.6) * scale;
      const y = box.y + (r.y + r.h * 0.62) * scale;
      await page.evaluate(([px, py]) => {
        const c = document.querySelector<SVGElement & { offsetParent?: Element }>('.cursor');
        if (!c) throw new Error('pas de .cursor dans la scène');
        const parent = (c.parentElement as HTMLElement).getBoundingClientRect();
        c.style.left = `${px - parent.x - 6}px`;
        c.style.top = `${py - parent.y - 3}px`;
      }, [x, y]);
    };

    if (scene.drive) await scene.drive({ plugin, pointAt });
    // Images du plugin décodées, transitions de survol terminées.
    await page.waitForTimeout(900);
    await page.evaluate(() => document.fonts.ready);
    for (const frame of page.frames()) {
      await frame.evaluate(() => Promise.all(Array.from(document.images, (i) => i.decode().catch(() => undefined)))).catch(() => undefined);
    }
    const png = await page.screenshot({ type: 'png' });
    writeFileSync(join(OUT_DIR, scene.file), png);
    console.log(`[community] ${scene.file} : ${(png.byteLength / 1024).toFixed(0)} Ko`);
    await page.close();
  }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
