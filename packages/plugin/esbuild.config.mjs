import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const BACKEND_URL = process.env.F2S_BACKEND_URL ?? 'http://localhost:8787';

await mkdir('dist', { recursive: true });

await build({
  entryPoints: ['src/code.ts'],
  outfile: 'dist/code.js',
  bundle: true,
  platform: 'browser',
  target: 'es2022',
  format: 'iife',
});

const uiResult = await build({
  entryPoints: ['src/ui.tsx'],
  bundle: true,
  platform: 'browser',
  target: 'es2020',
  format: 'iife',
  write: false,
  define: { __BACKEND_URL__: JSON.stringify(BACKEND_URL) },
  jsx: 'automatic',
  jsxImportSource: 'preact',
});

const uiScript = uiResult.outputFiles[0].text;

// Le HTML servi par `figma.showUI(__html__)` est une chaîne autonome — pas
// de requête réseau possible pour charger une police (§networkAccess du
// manifest) ni de fichier statique séparé. La police (licence Fontshare,
// usage self-hosted/embed autorisé — voir public/fonts/LICENSE.txt du repo
// billeltighidet) est donc inlinée en base64 directement dans le CSS.
const fontBase64 = (await readFile('src/assets/CabinetGrotesk-Variable.woff2')).toString('base64');
const fontDataUri = `data:font/woff2;base64,${fontBase64}`;
// Les deux habillages sont servis dans la MÊME feuille, dans cet ordre :
// styles.css pose la structure et le skin moderne, styles.win95.css repeint
// par-dessus sous `html.f2s-skin--win95`. L'ordre compte — plusieurs règles
// de thème (`html.figma-dark`, `prefers-color-scheme`) ont la même
// spécificité que le scope du skin rétro, qui doit l'emporter.
const stylesTemplate = await readFile('src/styles.css', 'utf8');
const win95Styles = await readFile('src/styles.win95.css', 'utf8');
const styles = `${stylesTemplate}\n${win95Styles}`.replace('__FONT_DATA_URI__', () => fontDataUri);

const template = await readFile('src/ui.html', 'utf8');
const html = template.replace('__STYLES__', () => styles).replace('__UI_SCRIPT__', () => uiScript);
await writeFile('dist/ui.html', html);

console.log(`Built dist/code.js and dist/ui.html (backend: ${BACKEND_URL})`);
