import { Router } from 'express';
import { deriveCodeChallenge, generateCodeVerifier } from '../auth/pkce.js';
import { buildAuthUrl, createOAuthClient, exchangeCodeForTokens, fetchUserEmail } from '../auth/oauth.js';
import { popAuthResult, popCodeVerifier, stashAuthResult, stashCodeVerifier } from '../auth/pendingAuth.js';
import { cacheAccessToken, createSession, destroySession, getEmail, getRefreshToken } from '../auth/session.js';

export const authRouter = Router();

/** Spec §5: POST /auth/google → démarre OAuth2 (PKCE). */
authRouter.post('/auth/google', async (_req, res) => {
  const client = createOAuthClient();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = deriveCodeChallenge(codeVerifier);
  const state = await stashCodeVerifier(codeVerifier);
  const url = buildAuthUrl(client, codeChallenge, state);
  // `state` sert aussi d'identifiant de polling (GET /auth/session/:pollId) :
  // le plugin peut ainsi récupérer le jeton de session automatiquement une
  // fois l'utilisateur revenu de la fenêtre Google, sans copier-coller.
  res.json({ authUrl: url, pollId: state });
});

/** Spec §5: GET /auth/callback → échange code, stocke tokens. */
authRouter.get('/auth/callback', async (req, res) => {
  const code = String(req.query.code ?? '');
  const state = String(req.query.state ?? '');
  const codeVerifier = await popCodeVerifier(state);

  if (!code || !codeVerifier) {
    res.status(400).type('html').send(renderErrorPage('This sign-in link is invalid or has expired.'));
    return;
  }

  try {
    const client = createOAuthClient();
    const { refreshToken, accessToken, expiresInSec } = await exchangeCodeForTokens(client, code, codeVerifier);
    // Best-effort : un email introuvable (scope refusé, erreur transitoire
    // Google) ne doit jamais bloquer la connexion elle-même, juste laisser
    // la modale Settings du plugin sans email à afficher.
    const email = await fetchUserEmail(accessToken).catch(() => undefined);
    const sessionToken = await createSession(refreshToken, email);
    await cacheAccessToken(sessionToken, accessToken, expiresInSec);
    await stashAuthResult(state, { status: 'ready', sessionToken });

    // Spec §5.2 — cookie HttpOnly + SameSite=None; Secure, en complément du
    // résultat de polling ci-dessus (utilisé par l'iframe du plugin, qui n'a
    // pas toujours de stockage de cookie fiable en sandbox).
    // `secure: req.secure` plutôt que `true` en dur : un cookie Secure est
    // silencieusement refusé par le navigateur sur http://localhost, ce qui
    // aurait cassé le fallback cookie en dev sans avertissement.
    res.cookie('f2s_session', sessionToken, {
      httpOnly: true,
      secure: req.secure,
      sameSite: 'none',
      maxAge: 90 * 24 * 3600 * 1000,
    });
    res.type('html').send(renderSuccessPage(accessToken, expiresInSec));
  } catch (err) {
    const message = (err as Error).message;
    await stashAuthResult(state, { status: 'error', message });
    res.status(502).type('html').send(renderErrorPage(message));
  }
});

/** GET /auth/session/:pollId → l'iframe du plugin sonde ce point après avoir ouvert authUrl. */
authRouter.get('/auth/session/:pollId', async (req, res) => {
  const result = await popAuthResult(req.params.pollId);
  res.json(result ?? { status: 'pending' });
});

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;');
}

/** Pile de cartes façon icône Windows 95 — même marque que le plugin, recopiée ici en dur : cette page est rendue par Express, hors du pipeline esbuild du plugin (§esbuild.config.mjs) qui injecte __LOGO_SVG__ au build. */
const DECKER_MARK_SVG = `<svg viewBox="0 0 32 32" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg">
<rect x="3" y="15" width="20" height="14" fill="#7a3b12" stroke="#1a0d02" stroke-width="1"/>
<rect x="6" y="10" width="20" height="14" fill="#c1651c" stroke="#1a0d02" stroke-width="1"/>
<rect x="9" y="5" width="20" height="14" fill="#ffb238" stroke="#1a0d02" stroke-width="1"/>
<rect x="9" y="5" width="20" height="1" fill="#fff4d6"/>
<rect x="9" y="5" width="1" height="14" fill="#fff4d6"/>
<rect x="10.5" y="6.5" width="17" height="3.2" fill="#1a0d02"/>
<rect x="10.5" y="12" width="17" height="2" fill="#fff4d6"/>
<rect x="10.5" y="15" width="11" height="2" fill="#fff4d6"/>
<path d="M26 5 L29 5 L29 8 Z" fill="#1a0d02"/>
<path d="M26 5 L28 5 L28 7 Z" fill="#fff4d6"/>
</svg>`;

/** Monogramme "B" personnel — recopié depuis assets/logo.svg (même source que le crédit dans le plugin, ui.tsx §Logo). Sert de crédit discret en pied de page, pas de logo produit ici. */
const PERSONAL_MARK_SVG = `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
<rect width="80" height="80" rx="40" fill="#F06800"/>
<path d="M48.6887 47.1716C50.2508 48.7337 50.2508 51.2664 48.6887 52.8285L44.2034 57.3138C41.6836 59.8336 37.375 58.049 37.375 54.4854L37.375 45.5148C37.375 41.9512 41.6836 40.1665 44.2034 42.6864L48.6887 47.1716Z" fill="#F2ECE8"/>
<path d="M48.6887 27.1715C50.2508 28.7335 50.2508 31.2662 48.6887 32.8283L44.2034 37.3136C41.6836 39.8334 37.375 38.0488 37.375 34.4852L37.375 25.5146C37.375 21.951 41.6836 20.1663 44.2034 22.6862L48.6887 27.1715Z" fill="#F2ECE8"/>
<rect x="30.6235" y="21.0001" width="3" height="37" rx="1.5" fill="#F2ECE8"/>
</svg>`;

/** Coquille Windows 95 partagée par les pages de succès/erreur d'auth — mêmes tokens que packages/plugin/src/styles.win95.css, recopiés ici (page Express autonome, pas de CSS partagé avec le plugin). */
function pageShell(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>
  :root {
    --w95-face: #c0c0c0;
    --w95-shadow: #808080;
    --w95-dark: #0a0a0a;
    --w95-light: #dfdfdf;
    --w95-white: #ffffff;
    --w95-navy: #000080;
    --w95-navy-light: #1084d0;
    --w95-out: inset -1px -1px var(--w95-dark), inset 1px 1px var(--w95-white), inset -2px -2px var(--w95-shadow), inset 2px 2px var(--w95-light);
    --w95-in: inset -1px -1px var(--w95-white), inset 1px 1px var(--w95-shadow), inset -2px -2px var(--w95-light), inset 2px 2px var(--w95-dark);
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; height: 100%; }
  body {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 22px;
    padding: 24px;
    font-family: Tahoma, 'MS Sans Serif', Geneva, Verdana, sans-serif;
    font-size: 12px;
    color: #000;
    background:
      repeating-linear-gradient(45deg, rgba(255, 255, 255, 0.05) 0 2px, transparent 2px 4px),
      linear-gradient(160deg, #1a8a86, #0f6f6c);
  }
  .window { width: 100%; max-width: 440px; background: var(--w95-face); box-shadow: var(--w95-out); padding: 3px; }
  .titlebar {
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 0 3px 0 5px;
    background: linear-gradient(90deg, var(--w95-navy), var(--w95-navy-light));
    color: #fff;
    font-weight: 700;
    font-size: 12px;
  }
  .titlebar-left { display: flex; align-items: center; gap: 6px; min-width: 0; }
  .titlebar-left svg { width: 16px; height: 16px; flex: none; }
  .titlebar-left span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .titlebar-btn { flex: none; width: 18px; height: 16px; display: flex; align-items: center; justify-content: center; background: var(--w95-face); color: #000; box-shadow: var(--w95-out); font-size: 10px; }
  .window-body { padding: 16px 14px; background: var(--w95-face); border-top: 1px solid var(--w95-shadow); box-shadow: inset 0 1px 0 var(--w95-white); }
  .msg-row { display: flex; gap: 12px; align-items: flex-start; }
  .msg-icon { flex: none; font-size: 28px; line-height: 1; }
  .msg-title { margin: 0 0 6px; font-weight: 700; font-size: 13px; }
  p { margin: 0 0 8px; line-height: 1.5; }
  .dev-details { margin-top: 14px; background: var(--w95-light); box-shadow: inset -1px -1px var(--w95-white), inset 1px 1px var(--w95-shadow); padding: 8px 10px; }
  .dev-details summary { cursor: pointer; font-weight: 700; }
  .dev-note { color: #3f3f3f; font-size: 11px; }
  textarea { width: 100%; margin-top: 6px; font-family: 'Courier New', monospace; font-size: 11px; padding: 6px; border: none; background: var(--w95-white); box-shadow: var(--w95-in); resize: vertical; }
  .credit { display: flex; justify-content: center; }
  .credit a { display: inline-flex; opacity: 0.85; }
  .credit a:hover { opacity: 1; }
  .credit svg { width: 26px; height: 26px; display: block; }
</style>
</head>
<body>
  <div class="window">
    <div class="titlebar">
      <div class="titlebar-left">${DECKER_MARK_SVG}<span>Decker</span></div>
      <div class="titlebar-btn">×</div>
    </div>
    <div class="window-body">${bodyHtml}</div>
  </div>
  <footer class="credit">
    <a href="https://billeltighidet.fr" target="_blank" rel="noreferrer" title="billeltighidet.fr">${PERSONAL_MARK_SVG}</a>
  </footer>
</body>
</html>`;
}

/**
 * L'iframe du plugin récupère le jeton toute seule par polling (voir
 * /auth/session/:pollId) — le copier-coller ci-dessous n'est là que pour
 * `npm run calibrate` (spec §4), qui a besoin d'un access token Google brut
 * en variable d'env et n'a pas d'autre moyen d'en obtenir un dans ce dépôt.
 * Google expire ce token après `expiresInSec` (~1h) : largement suffisant
 * pour lancer le script juste après, mais il faudra se reconnecter pour un
 * nouveau run plus tard.
 */
function renderSuccessPage(accessToken: string, expiresInSec: number): string {
  const escapedToken = escapeHtml(accessToken);
  const expiresMin = Math.round(expiresInSec / 60);
  const body = `
    <div class="msg-row">
      <div class="msg-icon">✅</div>
      <div>
        <p class="msg-title">Signed in with Google</p>
        <p>You're all set — you can close this tab and go back to Figma. Decker will pick this up automatically.</p>
      </div>
    </div>
    <details class="dev-details">
      <summary>Access token for <code>npm run calibrate</code> (dev only)</summary>
      <p class="dev-note">Expires in ~${expiresMin} min. Do not share this — treat it like a password.</p>
      <textarea readonly rows="4" onclick="this.select()">${escapedToken}</textarea>
    </details>`;
  return pageShell('Signed in — Decker', body);
}

function renderErrorPage(message: string): string {
  const escaped = escapeHtml(message);
  const body = `
    <div class="msg-row">
      <div class="msg-icon">❌</div>
      <div>
        <p class="msg-title">Google sign-in failed</p>
        <p>${escaped}</p>
      </div>
    </div>`;
  return pageShell('Sign-in failed — Decker', body);
}

/** GET /auth/me → email du compte connecté, pour la section Compte de la modale Settings du plugin. */
authRouter.get('/auth/me', async (req, res) => {
  const sessionToken = extractSessionToken(req);
  if (!sessionToken) {
    res.status(401).json({ error: 'Not signed in.' });
    return;
  }
  const refreshToken = await getRefreshToken(sessionToken);
  if (!refreshToken) {
    res.status(401).json({ error: 'Session expired.' });
    return;
  }
  const email = await getEmail(sessionToken);
  res.json({ email: email ?? null });
});

authRouter.post('/auth/logout', async (req, res) => {
  const sessionToken = extractSessionToken(req);
  if (sessionToken) {
    await destroySession(sessionToken);
  }
  res.clearCookie('f2s_session');
  res.status(204).end();
});

export function extractSessionToken(req: { cookies?: Record<string, string>; headers: Record<string, unknown> }): string | undefined {
  const header = req.headers.authorization;
  if (typeof header === 'string' && header.startsWith('Bearer ')) {
    return header.slice('Bearer '.length);
  }
  return req.cookies?.f2s_session;
}
