import { Router } from 'express';
import { deriveCodeChallenge, generateCodeVerifier } from '../auth/pkce.js';
import { buildAuthUrl, createOAuthClient, exchangeCodeForTokens } from '../auth/oauth.js';
import { popCodeVerifier, stashCodeVerifier } from '../auth/pendingAuth.js';
import { cacheAccessToken, createSession, destroySession } from '../auth/session.js';

export const authRouter = Router();

/** Spec §5: POST /auth/google → démarre OAuth2 (PKCE). */
authRouter.post('/auth/google', (_req, res) => {
  const client = createOAuthClient();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = deriveCodeChallenge(codeVerifier);
  const state = stashCodeVerifier(codeVerifier);
  const url = buildAuthUrl(client, codeChallenge, state);
  res.json({ authUrl: url });
});

/** Spec §5: GET /auth/callback → échange code, stocke tokens. */
authRouter.get('/auth/callback', async (req, res) => {
  const code = String(req.query.code ?? '');
  const state = String(req.query.state ?? '');
  const codeVerifier = popCodeVerifier(state);

  if (!code || !codeVerifier) {
    res.status(400).json({ error: 'invalid_or_expired_state' });
    return;
  }

  try {
    const client = createOAuthClient();
    const { refreshToken, accessToken, expiresInSec } = await exchangeCodeForTokens(client, code, codeVerifier);
    const sessionToken = createSession(refreshToken);
    cacheAccessToken(sessionToken, accessToken, expiresInSec);

    // Spec §5.2 — cookie HttpOnly + SameSite=None; Secure, ou header
    // Authorization porté par l'iframe. On pose les deux : le cookie pour un
    // navigateur classique, et le token dans le body pour l'iframe du plugin
    // (qui n'a pas toujours de stockage de cookie fiable en sandbox).
    res.cookie('f2s_session', sessionToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 90 * 24 * 3600 * 1000,
    });
    res.json({ sessionToken });
  } catch (err) {
    res.status(502).json({ error: 'oauth_exchange_failed', message: (err as Error).message });
  }
});

authRouter.post('/auth/logout', (req, res) => {
  const sessionToken = extractSessionToken(req);
  if (sessionToken) {
    destroySession(sessionToken);
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
