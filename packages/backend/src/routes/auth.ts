import { Router } from 'express';
import { deriveCodeChallenge, generateCodeVerifier } from '../auth/pkce.js';
import { buildAuthUrl, createOAuthClient, exchangeCodeForTokens } from '../auth/oauth.js';
import { popAuthResult, popCodeVerifier, stashAuthResult, stashCodeVerifier } from '../auth/pendingAuth.js';
import { cacheAccessToken, createSession, destroySession } from '../auth/session.js';

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
    const sessionToken = await createSession(refreshToken);
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
 * L'iframe du plugin récupère le jeton toute seule par polling (voir
 * /auth/session/:pollId) : cette page n'a plus besoin de faire copier-coller
 * quoi que ce soit, juste confirmer que l'utilisateur peut revenir à Figma.
 */
function renderSuccessPage(): string {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8" /><title>Signed in</title></head>
<body style="font-family: system-ui, sans-serif; max-width: 480px; margin: 3rem auto; padding: 0 1rem;">
  <h2>✅ Signed in with Google</h2>
  <p>You're all set — you can close this tab and go back to Figma. The plugin will pick this up automatically.</p>
</body>
</html>`;
}

function renderErrorPage(message: string): string {
  const escaped = message.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8" /><title>Sign-in failed</title></head>
<body style="font-family: system-ui, sans-serif; max-width: 480px; margin: 3rem auto; padding: 0 1rem;">
  <h2>❌ Google sign-in failed</h2>
  <p>${escaped}</p>
</body>
</html>`;
}

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
