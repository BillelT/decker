// Synchronise les tokens de la DA (billel-skill, skills/design-tokens/token.css)
// vers decker, puis régénère les copies consommées par le plugin et le backend.
//
//   node scripts/sync-tokens.mjs [chemin/vers/billel-skill]   copie + régénère
//   node scripts/sync-tokens.mjs --check                       vérifie que les
//     fichiers générés correspondent à tokens/token.css (aucune écriture)
//
// Sans chemin, le fichier est téléchargé depuis la branche main de
// BillelT/billel-skill. Ne jamais modifier les fichiers générés à la main :
// toute valeur se change dans la DA, puis on relance ce script.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = join(ROOT, 'tokens/token.css');
const PLUGIN_OUT = join(ROOT, 'packages/plugin/src/generated/tokens.css');
const BACKEND_OUT = join(ROOT, 'packages/backend/src/generated/designTokens.ts');
const REMOTE = 'https://raw.githubusercontent.com/BillelT/billel-skill/main/skills/design-tokens/token.css';

const HEADER = 'Généré par scripts/sync-tokens.mjs depuis tokens/token.css (DA billel-skill). Ne pas modifier à la main.';

// Les commentaires de la DA sont retirés : leur documentation reste dans
// billel-skill, et ils contiennent des tirets cadratins, bannis de ce dépôt.
function normalize(css) {
  return `${css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/var\(\s*([^()]*?)\s*\)/g, 'var($1)')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\{\n\n/g, '{\n')
    .trim()}\n`;
}

// Le @font-face de la DA pointe vers un fichier relatif (./fonts/...) qui
// n'existe ni dans le plugin ni sur Vercel : chaque cible déclare sa propre
// police inlinée en base64.
function inline(css) {
  return css.replace(/@font-face\s*\{[^}]*\}\s*/g, '').trim();
}

function pluginCss(css) {
  return `/* ${HEADER} */\n\n${inline(css)}\n`;
}

function backendTs(css) {
  const escaped = inline(css).replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
  return `// ${HEADER}\n\nexport const DESIGN_TOKENS_CSS = \`\n${escaped}\n\`;\n`;
}

const args = process.argv.slice(2);

if (args[0] === '--check') {
  const css = normalize(await readFile(SOURCE, 'utf8'));
  const stale = [];
  if ((await readFile(PLUGIN_OUT, 'utf8').catch(() => '')) !== pluginCss(css)) stale.push(PLUGIN_OUT);
  if ((await readFile(BACKEND_OUT, 'utf8').catch(() => '')) !== backendTs(css)) stale.push(BACKEND_OUT);
  if (stale.length) {
    console.error(`Tokens désynchronisés, relancer node scripts/sync-tokens.mjs :\n${stale.join('\n')}`);
    process.exit(1);
  }
  console.log('Tokens synchronisés.');
  process.exit(0);
}

let css;
if (args[0]) {
  css = await readFile(join(resolve(args[0]), 'skills/design-tokens/token.css'), 'utf8');
} else {
  const res = await fetch(REMOTE);
  if (!res.ok) throw new Error(`Téléchargement impossible (${res.status}) : passer le chemin d'un clone de billel-skill.`);
  css = await res.text();
}

css = normalize(css);
await writeFile(SOURCE, `/* Copie de skills/design-tokens/token.css (BillelT/billel-skill), sans commentaires.\n   Se met à jour avec scripts/sync-tokens.mjs, jamais à la main. */\n\n${css}`);
await mkdir(dirname(PLUGIN_OUT), { recursive: true });
await mkdir(dirname(BACKEND_OUT), { recursive: true });
await writeFile(PLUGIN_OUT, pluginCss(css));
await writeFile(BACKEND_OUT, backendTs(css));
console.log('Tokens copiés depuis la DA et régénérés pour le plugin et le backend.');
