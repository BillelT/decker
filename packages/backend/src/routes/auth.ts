import { Router } from 'express';
import { deriveCodeChallenge, generateCodeVerifier } from '../auth/pkce.js';
import { buildAuthUrl, createOAuthClient, exchangeCodeForTokens, fetchUserEmail } from '../auth/oauth.js';
import { popAuthResult, popCodeVerifier, popSkin, stashAuthResult, stashCodeVerifier, stashSkin } from '../auth/pendingAuth.js';
import { cacheAccessToken, createSession, destroySession, getEmail, getRefreshToken } from '../auth/session.js';
import { DECKER_FAVICON, DECKER_MARK_SVG, PERSONAL_MARK_SVG, escapeHtml } from './brand.js';

export const authRouter = Router();

/** Habillages du plugin — voir packages/plugin/src/ui/types.ts::UiSkin, recopié ici (pas de dépendance vers le workspace plugin depuis le backend). */
type UiSkin = 'win95' | 'modern' | 'hybrid';
const DEFAULT_UI_SKIN: UiSkin = 'win95';

function normalizeSkin(value: unknown): UiSkin {
  return value === 'modern' || value === 'hybrid' || value === 'win95' ? value : DEFAULT_UI_SKIN;
}

/** Spec §5: POST /auth/google → démarre OAuth2 (PKCE). */
authRouter.post('/auth/google', async (req, res) => {
  const client = createOAuthClient();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = deriveCodeChallenge(codeVerifier);
  const state = await stashCodeVerifier(codeVerifier);
  // Le skin voyage avec `state` : GET /auth/callback (déclenché par Google,
  // pas par le plugin) n'a que ce paramètre pour savoir quel habillage
  // rendre — voir Logo()/skin dans ui.tsx pour l'origine de la valeur.
  await stashSkin(state, normalizeSkin((req.body as { skin?: unknown } | undefined)?.skin));
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
  const skin = normalizeSkin(await popSkin(state));

  if (!code || !codeVerifier) {
    res.status(400).type('html').send(renderErrorPage('This sign-in link is invalid or has expired.', skin));
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
    res.type('html').send(renderSuccessPage(skin));
  } catch (err) {
    const message = (err as Error).message;
    await stashAuthResult(state, { status: 'error', message });
    res.status(502).type('html').send(renderErrorPage(message, skin));
  }
});

/** GET /auth/session/:pollId → l'iframe du plugin sonde ce point après avoir ouvert authUrl. */
authRouter.get('/auth/session/:pollId', async (req, res) => {
  const result = await popAuthResult(req.params.pollId);
  res.json(result ?? { status: 'pending' });
});

const FOOTER_CREDIT = `<a href="https://billeltighidet.fr" target="_blank" rel="noreferrer" title="billeltighidet.fr">${PERSONAL_MARK_SVG}</a>`;

interface PageContent {
  title: string;
  accent: 'success' | 'error';
  heading: string;
  body: string;
}

/**
 * Ne montre plus le token brut : l'iframe du plugin récupère le jeton de
 * session toute seule par polling (voir /auth/session/:pollId), donc ces
 * pages n'ont plus besoin d'exposer de secret à l'utilisateur. `npm run
 * calibrate` (spec §4) a une méthode d'obtention distincte du token, voir
 * printMissingCredentialsHelp() dans calibration/calibrate.ts.
 */

// ============================================================================
// Skin "modern" — DA de marque du plugin (orange, coins arrondis).
// ============================================================================

function renderModernPage(content: PageContent): string {
  const iconPath =
    content.accent === 'success'
      ? '<path d="M20 34 L29 43 L46 24" stroke="#F2ECE8" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>'
      : '<path d="M24 24 L42 42 M42 24 L24 42" stroke="#F2ECE8" stroke-width="4.5" stroke-linecap="round"/>';
  const accentColor = content.accent === 'success' ? '#F06800' : '#E00000';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(content.title)}</title>
<link rel="icon" type="image/svg+xml" href="${DECKER_FAVICON}" />
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
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1.25rem;
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
  .brand { display: flex; align-items: center; justify-content: center; gap: 0.5rem; margin-bottom: 2rem; }
  .brand-mark { width: 28px; height: 28px; border-radius: 8px; flex-shrink: 0; }
  .brand-name { font-size: 0.95rem; font-weight: 600; letter-spacing: 0.01em; }
  .status-icon { width: 64px; height: 64px; margin: 0 auto 1.5rem; }
  h1 { margin: 0 0 0.75rem; font-size: 1.3rem; font-weight: 700; }
  p.body { margin: 0 0 2rem; color: var(--f2s-text-muted); font-size: 0.95rem; line-height: 1.5; }
  .btn {
    display: inline-flex; align-items: center; justify-content: center; width: 100%;
    padding: 0.75rem 1.25rem; border-radius: 10px; background: var(--f2s-orange); color: #fff9f5;
    font-size: 0.95rem; font-weight: 600; text-decoration: none; border: none; cursor: pointer;
  }
  .fallback { margin: 1rem 0 0; font-size: 0.8rem; color: var(--f2s-text-muted); }
  .credit { display: flex; justify-content: center; }
  .credit a { display: inline-flex; opacity: 0.6; }
  .credit a:hover { opacity: 1; }
  .credit svg { width: 24px; height: 24px; display: block; }
</style>
</head>
<body>
  <main class="card">
    <div class="brand">
      <svg class="brand-mark" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${DECKER_MARK_SVG.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')}</svg>
      <span class="brand-name">Decker</span>
    </div>
    <svg class="status-icon" viewBox="0 0 66 66" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="33" cy="33" r="33" fill="${accentColor}"/>
      ${iconPath}
    </svg>
    <h1>${escapeHtml(content.heading)}</h1>
    <p class="body">${content.body}</p>
    <a class="btn" href="figma://">Back to Figma</a>
    <p class="fallback">If nothing happens, just close this tab.</p>
  </main>
  <footer class="credit">${FOOTER_CREDIT}</footer>
</body>
</html>`;
}

// ============================================================================
// Skin "win95" — chrome Windows 95, mêmes tokens que styles.win95.css.
// ============================================================================

function renderWin95Page(content: PageContent): string {
  const icon = content.accent === 'success' ? '✅' : '❌';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(content.title)}</title>
<link rel="icon" type="image/svg+xml" href="${DECKER_FAVICON}" />
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
    --w95-pressed: inset -1px -1px var(--w95-white), inset 1px 1px var(--w95-dark), inset -2px -2px var(--w95-light), inset 2px 2px var(--w95-shadow);
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
    height: 22px; display: flex; align-items: center; justify-content: space-between; gap: 8px;
    padding: 0 3px 0 5px; background: linear-gradient(90deg, var(--w95-navy), var(--w95-navy-light));
    color: #fff; font-weight: 700; font-size: 12px;
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
  .btn95 {
    display: inline-flex; align-items: center; justify-content: center; width: 100%; margin-top: 8px;
    padding: 6px 12px; background: var(--w95-face); color: #000; box-shadow: var(--w95-out);
    font-family: inherit; font-size: 11px; font-weight: 700; text-decoration: none; border: none; cursor: pointer;
  }
  .btn95:active { box-shadow: var(--w95-pressed); }
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
    <div class="window-body">
      <div class="msg-row">
        <div class="msg-icon">${icon}</div>
        <div>
          <p class="msg-title">${escapeHtml(content.heading)}</p>
          <p>${content.body}</p>
        </div>
      </div>
      <a class="btn95" href="figma://">Back to Figma</a>
    </div>
  </div>
  <footer class="credit">${FOOTER_CREDIT}</footer>
</body>
</html>`;
}

// ============================================================================
// Skin "hybrid" — palette de marque du skin moderne, biseaux/angles droits
// du skin win95 (mêmes tokens que styles.hybrid.css, valeurs "clair" — ces
// pages statiques ne suivent pas le thème Figma, comme win95).
// ============================================================================

function renderHybridPage(content: PageContent): string {
  const iconPath =
    content.accent === 'success'
      ? '<path d="M20 34 L29 43 L46 24" stroke="#F2ECE8" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>'
      : '<path d="M24 24 L42 42 M42 24 L24 42" stroke="#F2ECE8" stroke-width="4.5" stroke-linecap="round"/>';
  const accentColor = content.accent === 'success' ? '#F06800' : '#E00000';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(content.title)}</title>
<link rel="icon" type="image/svg+xml" href="${DECKER_FAVICON}" />
<style>
  :root {
    color-scheme: light;
    --f2s-orange: #f06800;
    --f2s-bg: #fff9f5;
    --f2s-surface: #ffffff;
    --f2s-text: #120f0d;
    --f2s-text-muted: rgba(18, 15, 13, 0.7);
    --hyb-hi: rgba(255, 255, 255, 0.9);
    --hyb-lo: rgba(18, 15, 13, 0.22);
    --hyb-lo-strong: rgba(18, 15, 13, 0.4);
    --hyb-out: inset -1px -1px var(--hyb-lo), inset 1px 1px var(--hyb-hi), inset -2px -2px var(--hyb-lo-strong), inset 2px 2px var(--hyb-hi);
    --hyb-pressed: inset -1px -1px var(--hyb-hi), inset 1px 1px var(--hyb-lo-strong), inset -2px -2px var(--hyb-hi), inset 2px 2px var(--hyb-lo);
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1.25rem;
    padding: 1.5rem;
    background: var(--f2s-bg);
    color: var(--f2s-text);
    font-family: 'Cabinet Grotesk', system-ui, -apple-system, 'Segoe UI', sans-serif;
  }
  .card {
    width: 100%;
    max-width: 400px;
    background: var(--f2s-surface);
    border-radius: 0;
    padding: 2.5rem 2rem;
    text-align: center;
    box-shadow: var(--hyb-out), 0 12px 32px rgba(18, 15, 13, 0.08);
  }
  .brand { display: flex; align-items: center; justify-content: center; gap: 0.5rem; margin-bottom: 2rem; }
  .brand-mark { width: 28px; height: 28px; border-radius: 0; flex-shrink: 0; }
  .brand-name { font-size: 0.95rem; font-weight: 600; letter-spacing: 0.01em; }
  .status-icon { width: 64px; height: 64px; margin: 0 auto 1.5rem; }
  h1 { margin: 0 0 0.75rem; font-size: 1.3rem; font-weight: 700; }
  p.body { margin: 0 0 2rem; color: var(--f2s-text-muted); font-size: 0.95rem; line-height: 1.5; }
  .btn {
    display: inline-flex; align-items: center; justify-content: center; width: 100%;
    padding: 0.75rem 1.25rem; border-radius: 0; background: var(--f2s-orange); color: #fff9f5;
    font-size: 0.95rem; font-weight: 600; text-decoration: none; border: none; cursor: pointer;
    box-shadow: var(--hyb-out);
  }
  .btn:active { box-shadow: var(--hyb-pressed); }
  .fallback { margin: 1rem 0 0; font-size: 0.8rem; color: var(--f2s-text-muted); }
  .credit { display: flex; justify-content: center; }
  .credit a { display: inline-flex; opacity: 0.6; }
  .credit a:hover { opacity: 1; }
  .credit svg { width: 24px; height: 24px; display: block; }
</style>
</head>
<body>
  <main class="card">
    <div class="brand">
      <svg class="brand-mark" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${DECKER_MARK_SVG.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')}</svg>
      <span class="brand-name">Decker</span>
    </div>
    <svg class="status-icon" viewBox="0 0 66 66" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="33" cy="33" r="33" fill="${accentColor}"/>
      ${iconPath}
    </svg>
    <h1>${escapeHtml(content.heading)}</h1>
    <p class="body">${content.body}</p>
    <a class="btn" href="figma://">Back to Figma</a>
    <p class="fallback">If nothing happens, just close this tab.</p>
  </main>
  <footer class="credit">${FOOTER_CREDIT}</footer>
</body>
</html>`;
}

function renderPage(skin: UiSkin, content: PageContent): string {
  if (skin === 'modern') return renderModernPage(content);
  if (skin === 'hybrid') return renderHybridPage(content);
  return renderWin95Page(content);
}

function renderSuccessPage(skin: UiSkin): string {
  return renderPage(skin, {
    title: 'Signed in — Decker',
    accent: 'success',
    heading: "You're signed in",
    body: 'You can close this tab and go back to Figma — Decker will pick this up automatically.',
  });
}

function renderErrorPage(message: string, skin: UiSkin): string {
  return renderPage(skin, {
    title: 'Sign-in failed — Decker',
    accent: 'error',
    heading: 'Google sign-in failed',
    body: escapeHtml(message),
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
