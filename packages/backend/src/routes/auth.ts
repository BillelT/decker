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
    // navigateur classique, et le token affiché ici pour l'iframe du plugin
    // (qui n'a pas toujours de stockage de cookie fiable en sandbox).
    // `secure: req.secure` plutôt que `true` en dur : un cookie Secure est
    // silencieusement refusé par le navigateur sur http://localhost, ce qui
    // aurait cassé le fallback cookie en dev sans avertissement.
    res.cookie('f2s_session', sessionToken, {
      httpOnly: true,
      secure: req.secure,
      sameSite: 'none',
      maxAge: 90 * 24 * 3600 * 1000,
    });
    res.type('html').send(renderTokenPage(sessionToken));
  } catch (err) {
    res
      .status(502)
      .type('html')
      .send(renderErrorPage((err as Error).message));
  }
});

/**
 * Une page plutôt qu'un JSON brut : coller `{"sessionToken":"xxx"}` en
 * entier au lieu de la seule valeur est une source d'erreur 401 fréquente.
 * Le champ ci-dessous ne contient QUE le jeton, sélectionné automatiquement
 * pour qu'un simple Ctrl+C copie la bonne chose.
 */
function renderTokenPage(sessionToken: string): string {
  const escaped = sessionToken.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  return `<!doctype html>
<html lang="fr">
<head><meta charset="utf-8" /><title>Connexion réussie</title></head>
<body style="font-family: system-ui, sans-serif; max-width: 480px; margin: 3rem auto; padding: 0 1rem;">
  <h2>✅ Connexion Google réussie</h2>
  <p>Copie ce jeton de session et colle-le dans le champ du plugin Figma :</p>
  <input id="token" readonly value="${escaped}" style="width: 100%; padding: 8px; font-family: monospace; box-sizing: border-box;" />
  <p><button id="copy" style="padding: 8px 16px;">Copier</button> <span id="copied" style="opacity: 0.7;"></span></p>
  <p style="opacity: 0.7;">Tu peux fermer cet onglet une fois le jeton collé dans le plugin.</p>
  <script>
    const input = document.getElementById('token');
    input.focus();
    input.select();
    document.getElementById('copy').addEventListener('click', () => {
      navigator.clipboard.writeText(input.value).then(() => {
        document.getElementById('copied').textContent = 'Copié !';
      });
    });
  </script>
</body>
</html>`;
}

function renderErrorPage(message: string): string {
  const escaped = message.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return `<!doctype html>
<html lang="fr">
<head><meta charset="utf-8" /><title>Échec de la connexion</title></head>
<body style="font-family: system-ui, sans-serif; max-width: 480px; margin: 3rem auto; padding: 0 1rem;">
  <h2>❌ La connexion Google a échoué</h2>
  <p>${escaped}</p>
</body>
</html>`;
}

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
