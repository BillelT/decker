import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './env.js';
import { authRouter } from './routes/auth.js';
import { assetsRouter } from './routes/assets.js';
import { exportRouter } from './routes/export.js';

/**
 * Vérification au démarrage plutôt qu'un crash silencieux au premier appel
 * OAuth : `tsx watch` ne recharge PAS .env quand on l'édite, seulement les
 * fichiers .ts — après avoir créé/modifié .env, il faut relancer `npm run
 * dev` pour que les nouvelles valeurs soient prises en compte.
 */
function checkRequiredEnv(): void {
  const required = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI', 'SESSION_ENCRYPTION_KEY'];
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    // eslint-disable-next-line no-console
    console.error(
      `\n[backend] Variable(s) d'environnement manquante(s) : ${missing.join(', ')}.\n` +
        `Vérifie packages/backend/.env (voir .env.example), puis RELANCE ce process\n` +
        `— tsx watch ne recharge pas .env automatiquement quand tu l'édites, seulement le code.\n`,
    );
  }
}
checkRequiredEnv();

/**
 * Slides `createImage` va chercher l'image lui-même depuis les serveurs
 * Google — une URL `localhost`/`127.0.0.1` n'est joignable que depuis cette
 * machine, jamais depuis l'infra Google. Ça ne casse rien tant qu'une slide
 * n'a aucun contenu rasterisé/image (texte et formes natives s'en passent),
 * d'où un avertissement plutôt qu'un blocage : le premier export avec une
 * image échouera avec une erreur Slides "Localhost image URLs are invalid"
 * sinon bien plus tard et moins clairement.
 */
function warnIfBackendUrlIsLocal(): void {
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(env.publicBackendUrl)) {
    // eslint-disable-next-line no-console
    console.warn(
      `\n[backend] PUBLIC_BACKEND_URL pointe vers "${env.publicBackendUrl}" — inatteignable depuis les serveurs Google.\n` +
        `Tout export contenant une image ou un élément rasterisé (dégradé, ombre, LINE…) échouera avec\n` +
        `"Localhost image URLs are invalid" dès que Slides essaiera de la récupérer. Pour tester en local,\n` +
        `expose ce backend via un tunnel public (ex. \`ngrok http 8787\`), puis mets PUBLIC_BACKEND_URL\n` +
        `dans .env sur l'URL https donnée par le tunnel et relance ce process.\n`,
    );
  }
}
warnIfBackendUrlIsLocal();

const app = express();

// Chrome (donc le Chromium embarqué par Figma Desktop) applique Private
// Network Access : l'iframe du plugin tourne dans un espace d'adresses
// "public", et une requête vers localhost (espace "local") déclenche un
// préflight portant `Access-Control-Request-Private-Network: true`, qui
// échoue silencieusement (le fetch est bloqué avant même d'atteindre le
// serveur) tant que la réponse ne renvoie pas ce header en retour — le
// paquet `cors` ne l'ajoute pas de lui-même.
app.use((req, res, next) => {
  if (req.headers['access-control-request-private-network']) {
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
  }
  next();
});

app.use(
  cors({
    origin: env.allowedOrigins.length > 0 ? env.allowedOrigins : false,
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use(authRouter);
app.use(assetsRouter);
app.use(exportRouter);

// Doit rester le DERNIER `app.use` : filet de sécurité pour toute erreur
// synchrone ou passée à `next(err)` non gérée par une route. Sans ça,
// Express répond avec une page HTML générique dont le contenu ne dit rien
// côté navigateur — juste un 500 sans détail (ce qui, vu depuis un fetch()
// cross-origin, se présente à tort comme une erreur CORS).
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  // eslint-disable-next-line no-console
  console.error('[backend] unhandled error', err);
  if (res.headersSent) return;
  res.status(500).json({ error: 'internal_error', message: err instanceof Error ? err.message : String(err) });
});

app.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`figma-to-slides backend listening on :${env.port}`);
});
