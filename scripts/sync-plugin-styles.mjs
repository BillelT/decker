// Recopie le CSS du plugin (skin modern) pour la démo interactive du site :
// la démo du hero (packages/backend/src/routes/heroDemo.ts) reprend le vrai
// markup du plugin, classes f2s-* comprises, et ce script lui fournit les
// vraies règles, scopées sous `.dm-plugin` pour ne rien toucher du site.
//
//   node scripts/sync-plugin-styles.mjs           régénère le fichier
//   node scripts/sync-plugin-styles.mjs --check   vérifie qu'il est à jour
//
// Ne jamais modifier le fichier généré à la main : on change le CSS du
// plugin, puis on relance ce script (npm run lint le vérifie).
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCES = ['packages/plugin/src/styles.css', 'packages/plugin/src/styles.modern.css'].map((p) => join(ROOT, p));
const OUT = join(ROOT, 'packages/backend/src/generated/pluginStyles.ts');
const SCOPE = '.dm-plugin';

const HEADER = 'Généré par scripts/sync-plugin-styles.mjs depuis le CSS du plugin (skin modern). Ne pas modifier à la main.';

// Morceaux du plugin absents de la démo et des visuels des cards : les garder
// alourdirait chaque chargement de la page d'accueil pour rien. La modale
// Settings reste (card Privacy), sans son voile.
const UNUSED = /f2s-(modal-overlay|login|resize-grip|grip-|titlebar|error\b|statusbar|progress\b|export-failure|canvas-empty)/;

/** Découpe une liste de sélecteurs sur ses virgules de premier niveau. */
function splitSelectors(text) {
  const out = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth--;
    else if (c === ',' && depth === 0) {
      out.push(text.slice(start, i).trim());
      start = i + 1;
    }
  }
  out.push(text.slice(start).trim());
  return out.filter(Boolean);
}

function scopeSelector(sel) {
  let s = sel.replace(/\s+/g, ' ');
  s = s.replace(/^html:not\(\.f2s-skin--win95\)/, SCOPE).replace(/^html\.f2s-skin--modern/, SCOPE);
  if (s.includes('f2s-skin--')) return null;
  if (UNUSED.test(s)) return null;
  const root = /^(:root|html|body|#app)(?=$|[\s.:[>])/;
  if (root.test(s)) return s.replace(root, SCOPE);
  if (s.startsWith(SCOPE)) return s;
  return `${SCOPE} ${s}`;
}

/** Parcourt un bloc CSS (sans commentaires) et rend sa version scopée. */
function transform(css) {
  let out = '';
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf('{', i);
    if (open === -1) break;
    const head = css.slice(i, open).trim();
    // Fin du bloc : accolade fermante appariée.
    let depth = 1;
    let j = open + 1;
    while (j < css.length && depth > 0) {
      if (css[j] === '{') depth++;
      else if (css[j] === '}') depth--;
      j++;
    }
    const body = css.slice(open + 1, j - 1);
    i = j;
    if (head.startsWith('@font-face')) continue;
    if (head.startsWith('@keyframes')) {
      out += `${head}{${minify(body)}}`;
    } else if (head.startsWith('@')) {
      const inner = transform(body);
      if (inner) out += `${head}{${inner}}`;
    } else {
      const sels = splitSelectors(head).map(scopeSelector).filter(Boolean);
      if (sels.length) out += `${sels.join(',')}{${minify(body)}}`;
    }
  }
  return out;
}

function minify(body) {
  return body
    .replace(/\s+/g, ' ')
    .replace(/\s*([{};])\s*/g, '$1')
    .replace(/:\s+/g, ':')
    .trim();
}

async function build() {
  const parts = await Promise.all(SOURCES.map((p) => readFile(p, 'utf8')));
  const css = transform(parts.join('\n').replace(/\/\*[\s\S]*?\*\//g, ''));
  const escaped = css.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
  return `// ${HEADER}\n\nexport const PLUGIN_STYLES_CSS = \`${escaped}\`;\n`;
}

const expected = await build();
if (process.argv[2] === '--check') {
  if ((await readFile(OUT, 'utf8').catch(() => '')) !== expected) {
    console.error(`CSS de la démo désynchronisé du plugin, relancer node scripts/sync-plugin-styles.mjs :\n${OUT}`);
    process.exit(1);
  }
} else {
  await writeFile(OUT, expected);
  console.log(`${OUT} (${(expected.length / 1024).toFixed(1)} Ko)`);
}
