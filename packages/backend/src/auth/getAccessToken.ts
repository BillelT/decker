import { createOAuthClient, refreshAccessToken } from './oauth.js';
import { cacheAccessToken, getCachedAccessToken, getRefreshToken } from './session.js';

export class UnauthenticatedError extends Error {}

export async function getValidAccessToken(sessionToken: string | undefined): Promise<string> {
  if (!sessionToken) throw new UnauthenticatedError('Missing session token');

  const cached = await getCachedAccessToken(sessionToken);
  if (cached) return cached;

  const refreshToken = await getRefreshToken(sessionToken);
  if (!refreshToken) throw new UnauthenticatedError('Unknown or expired session');

  const client = createOAuthClient();
  const { accessToken, expiresInSec } = await refreshAccessToken(client, refreshToken);
  await cacheAccessToken(sessionToken, accessToken, expiresInSec);
  return accessToken;
}
