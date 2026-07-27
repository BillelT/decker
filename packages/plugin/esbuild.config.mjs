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
const template = await readFile('src/ui.html', 'utf8');
await writeFile('dist/ui.html', template.replace('__UI_SCRIPT__', () => uiScript));

console.log(`Built dist/code.js and dist/ui.html (backend: ${BACKEND_URL})`);
