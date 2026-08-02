// Point d'entrée Vercel : convention "un fichier sous /api = une fonction
// serverless". Une app Express EST déjà un handler `(req, res) => void`,
// donc la ré-exporter par défaut suffit — pas de framework `@vercel/node`
// supplémentaire à apprendre. Importe le JS déjà compilé (dist/), pas le
// TypeScript source : ce backend a déjà son propre pipeline de build
// (tsc, avec packages/shared compilé en premier via le script `prebuild`),
// pas la peine de faire re-résoudre à Vercel notre monorepo de workspaces.
export { default } from '../dist/index.js';

// Étend la durée de vie de la fonction au-delà des quelques secondes par
// défaut — un export multi-slides avec plusieurs appels Slides API (et
// leurs retries) peut prendre plus de temps qu'une requête HTTP classique.
export const config = { maxDuration: 60 };
