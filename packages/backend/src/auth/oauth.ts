import { OAuth2Client } from 'google-auth-library';
import { env } from '../env.js';

export function createOAuthClient(): OAuth2Client {
  return new OAuth2Client(env.google.clientId, env.google.clientSecret, env.google.redirectUri);
}

/**
 * Spec §5.2 — access_type=offline, prompt=consent au premier passage.
 * `select_account` en plus (audit 2026-08) : sans lui, Google saute
 * directement à l'écran de consentement dès qu'un seul compte est connecté
 * dans le navigateur, sans jamais proposer le sélecteur de compte — donc
 * aucun moyen de se connecter avec un autre compte Google que le premier.
 */
export function buildAuthUrl(client: OAuth2Client, codeChallenge: string, state: string): string {
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'select_account consent',
    scope: env.google.scopes,
    code_challenge_method: 'S256' as any,
    code_challenge: codeChallenge,
    state,
  });
}

/** Adresse email du compte Google connecté — scope non sensible `userinfo.email` (voir env.ts). */
export async function fetchUserEmail(accessToken: string): Promise<string | undefined> {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return undefined;
  const body = (await res.json()) as { email?: string };
  return body.email;
}

export async function exchangeCodeForTokens(
  client: OAuth2Client,
  code: string,
  codeVerifier: string,
): Promise<{ refreshToken: string; accessToken: string; expiresInSec: number }> {
  const { tokens } = await client.getToken({ code, codeVerifier } as never);
  if (!tokens.refresh_token) {
    throw new Error(
      'No refresh_token returned by Google. This happens on re-consent without prompt=consent — verify the OAuth flow.',
    );
  }
  if (!tokens.access_token) {
    throw new Error('No access_token returned by Google.');
  }
  const expiresInSec = tokens.expiry_date ? Math.round((tokens.expiry_date - Date.now()) / 1000) : 3600;
  return { refreshToken: tokens.refresh_token, accessToken: tokens.access_token, expiresInSec };
}

export async function refreshAccessToken(
  client: OAuth2Client,
  refreshToken: string,
): Promise<{ accessToken: string; expiresInSec: number }> {
  client.setCredentials({ refresh_token: refreshToken });
  const { credentials } = await client.refreshAccessToken();
  if (!credentials.access_token) {
    throw new Error('Failed to refresh access token.');
  }
  const expiresInSec = credentials.expiry_date ? Math.round((credentials.expiry_date - Date.now()) / 1000) : 3600;
  return { accessToken: credentials.access_token, expiresInSec };
}
