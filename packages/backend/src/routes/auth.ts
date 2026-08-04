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
    res.type('html').send(renderSuccessPage());
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

/**
 * Habillage partagé des pages /auth/callback (succès et erreur) — reprend la
 * DA du plugin (orange #F06800, fond crème, pastille logo arrondie) pour que
 * cet onglet de navigateur, seul moment où l'utilisateur quitte l'iframe
 * Figma, ne détonne pas visuellement. Nom et logo sont des placeholders (le
 * plugin s'appelle encore "Figma → Google Slides" côté manifest) : à
 * remplacer une fois la marque définitive choisie.
 *
 * Ne montre plus le token brut : l'iframe du plugin récupère le jeton de
 * session toute seule par polling (voir /auth/session/:pollId), donc cette
 * page n'a plus besoin d'exposer de secret à l'utilisateur. `npm run
 * calibrate` (spec §4) a une méthode d'obtention distincte du token, voir
 * printMissingCredentialsHelp() dans calibration/calibrate.ts.
 */
function renderPage(opts: {
  title: string;
  accent: 'success' | 'error';
  heading: string;
  body: string;
}): string {
  const iconPath =
    opts.accent === 'success'
      ? '<path d="M20 34 L29 43 L46 24" stroke="#F2ECE8" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>'
      : '<path d="M24 24 L42 42 M42 24 L24 42" stroke="#F2ECE8" stroke-width="4.5" stroke-linecap="round"/>';
  const accentColor = opts.accent === 'success' ? '#F06800' : '#E00000';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${opts.title}</title>
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'><rect width='80' height='80' rx='40' fill='%23F06800'/><path d='M48.6887 47.1716C50.2508 48.7337 50.2508 51.2664 48.6887 52.8285L44.2034 57.3138C41.6836 59.8336 37.375 58.049 37.375 54.4854L37.375 45.5148C37.375 41.9512 41.6836 40.1665 44.2034 42.6864L48.6887 47.1716Z' fill='%23F2ECE8'/><path d='M48.6887 27.1715C50.2508 28.7335 50.2508 31.2662 48.6887 32.8283L44.2034 37.3136C41.6836 39.8334 37.375 38.0488 37.375 34.4852L37.375 25.5146C37.375 21.951 41.6836 20.1663 44.2034 22.6862L48.6887 27.1715Z' fill='%23F2ECE8'/><rect x='30.6235' y='21.0001' width='3' height='37' rx='1.5' fill='%23F2ECE8'/></svg>" />
<style>
  :root {
    color-scheme: light;
    --f2s-orange: #f06800;
    --f2s-bg: #fff9f5;
    --f2s-surface: #ffffff;
    --f2s-border: #eeeeee;
    --f2s-text: #120f0d;
    --f2s-text-muted: rgba(18, 15, 13, 0.7);
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
    background: var(--f2s-bg);
    color: var(--f2s-text);
    font-family: 'Cabinet Grotesk', system-ui, -apple-system, 'Segoe UI', sans-serif;
  }
  .card {
    width: 100%;
    max-width: 400px;
    background: var(--f2s-surface);
    border: 1px solid var(--f2s-border);
    border-radius: 20px;
    padding: 2.5rem 2rem;
    text-align: center;
    box-shadow: 0 12px 32px rgba(18, 15, 13, 0.08);
  }
  .brand {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    margin-bottom: 2rem;
  }
  .brand-mark { width: 28px; height: 28px; border-radius: 8px; flex-shrink: 0; }
  .brand-name {
    font-size: 0.95rem;
    font-weight: 600;
    letter-spacing: 0.01em;
  }
  .status-icon { width: 64px; height: 64px; margin: 0 auto 1.5rem; }
  h1 {
    margin: 0 0 0.75rem;
    font-size: 1.3rem;
    font-weight: 700;
  }
  p.body {
    margin: 0 0 2rem;
    color: var(--f2s-text-muted);
    font-size: 0.95rem;
    line-height: 1.5;
  }
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    padding: 0.75rem 1.25rem;
    border-radius: 10px;
    background: var(--f2s-orange);
    color: #fff9f5;
    font-size: 0.95rem;
    font-weight: 600;
    text-decoration: none;
    border: none;
    cursor: pointer;
  }
  .fallback {
    margin: 1rem 0 0;
    font-size: 0.8rem;
    color: var(--f2s-text-muted);
  }
</style>
</head>
<body>
  <main class="card">
    <div class="brand">
      <svg class="brand-mark" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect width="80" height="80" rx="40" fill="#F06800"/>
        <path d="M48.6887 47.1716C50.2508 48.7337 50.2508 51.2664 48.6887 52.8285L44.2034 57.3138C41.6836 59.8336 37.375 58.049 37.375 54.4854L37.375 45.5148C37.375 41.9512 41.6836 40.1665 44.2034 42.6864L48.6887 47.1716Z" fill="#F2ECE8"/>
        <path d="M48.6887 27.1715C50.2508 28.7335 50.2508 31.2662 48.6887 32.8283L44.2034 37.3136C41.6836 39.8334 37.375 38.0488 37.375 34.4852L37.375 25.5146C37.375 21.951 41.6836 20.1663 44.2034 22.6862L48.6887 27.1715Z" fill="#F2ECE8"/>
        <rect x="30.6235" y="21.0001" width="3" height="37" rx="1.5" fill="#F2ECE8"/>
      </svg>
      <!-- Placeholder — nom de marque à figer -->
      <span class="brand-name">Figma to Slides</span>
    </div>
    <svg class="status-icon" viewBox="0 0 66 66" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="33" cy="33" r="33" fill="${accentColor}"/>
      ${iconPath}
    </svg>
    <h1>${opts.heading}</h1>
    <p class="body">${opts.body}</p>
    <a class="btn" href="figma://">Back to Figma</a>
    <p class="fallback">If nothing happens, just close this tab.</p>
  </main>
</body>
</html>`;
}

function renderSuccessPage(): string {
  return renderPage({
    title: 'Signed in',
    accent: 'success',
    heading: "You're signed in",
    body: 'You can close this tab and go back to Figma — the plugin will pick this up automatically.',
  });
}

function renderErrorPage(message: string): string {
  const escaped = message.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return renderPage({
    title: 'Sign-in failed',
    accent: 'error',
    heading: 'Google sign-in failed',
    body: escaped,
  });
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
