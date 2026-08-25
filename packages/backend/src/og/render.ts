/**
 * Script de maintenance : rasterise `ogTemplate.ts` en PNG 1200x630 et
 * réécrit `ogImageData.ts` (base64), le module lu à l'exécution par
 * `routes/pages.ts`.
 *
 *   npm run og:build --workspace packages/backend
 *
 * Playwright n'est VOLONTAIREMENT pas une dépendance du dépôt : son
 * postinstall télécharge des navigateurs, ce qui alourdirait (voire
 * casserait) le `npm install` du build Vercel pour un script lancé à la main
 * une fois tous les six mois. Il faut donc le fournir soi-même avant de
 * lancer la commande :
 *
 *   npx --yes playwright@1.49.0 install --with-deps chromium
 *   NODE_PATH="$(npm root -g)" npm run og:build --workspace packages/backend
 *
 * (ou `npm i -D playwright` temporairement, sans le committer).
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { renderOgImageHtml } from './ogTemplate.js';
import { OG_IMAGE } from './variants.js';

const OUT_FILE = join(dirname(fileURLToPath(import.meta.url)), 'ogImageData.ts');

/** Taille de référence des cartes de partage : 1200x630 (ratio 1.91:1). */
const WIDTH = 1200;
const HEIGHT = 630;

async function main(): Promise<void> {
  let chromium: typeof import('playwright').chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    throw new Error(
      'playwright introuvable — installe-le d\'abord (voir l\'en-tête de ce fichier), il n\'est pas une dépendance du dépôt.',
    );
  }

  // Le binaire est celui de la machine : `PLAYWRIGHT_CHROMIUM_EXECUTABLE`
  // permet de pointer un Chromium déjà présent (ex. celui d'une image CI)
  // quand il ne correspond pas à la révision qu'attend le playwright installé.
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  // deviceScaleFactor: 1 — la sortie EST déjà à la résolution cible, un
  // rendu 2x rééchantillonné ne ferait que flouter les biseaux 1px du
  // chrome 95 et tripler le poids du fichier.
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });

  await page.setContent(renderOgImageHtml(OG_IMAGE.content), { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  const png = await page.screenshot({ type: 'png' });
  // eslint-disable-next-line no-console
  console.log(`[og] ${OG_IMAGE.file} — ${(png.byteLength / 1024).toFixed(1)} Ko`);
  await browser.close();

  writeFileSync(
    OUT_FILE,
    `/* eslint-disable */
/**
 * FICHIER GÉNÉRÉ — ne pas éditer à la main.
 * Produit par \`src/og/render.ts\` à partir de \`src/og/ogTemplate.ts\`
 * (voir l'en-tête de render.ts pour la commande).
 *
 * Le PNG est inliné en base64 pour la même raison que la police des pages
 * publiques (routes/fontData.ts) : le build du backend est un simple \`tsc\`,
 * qui ne recopie aucun binaire vers dist/ — un fichier .png posé dans src/
 * n'existerait tout simplement pas dans la fonction serverless déployée.
 */
export const OG_IMAGE_PNG_BASE64 = '${png.toString('base64')}';
`,
    'utf8',
  );
  // eslint-disable-next-line no-console
  console.log(`[og] écrit ${OUT_FILE}`);
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exitCode = 1;
});
