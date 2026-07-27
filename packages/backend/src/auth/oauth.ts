import { OAuth2Client } from 'google-auth-library';
import { env } from '../env.js';

export function createOAuthClient(): OAuth2Client {
  return new OAuth2Client(env.google.clientId, env.google.clientSecret, env.google.redirectUri);
}

/** Spec §5.2 — access_type=offline, prompt=consent au premier passage. */
export function buildAuthUrl(client: OAuth2Client, codeChallenge: string, state: string): string {
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: env.google.scopes,
    code_challenge_method: 'S256' as any,
    code_challenge: codeChallenge,
    state,
  });
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
