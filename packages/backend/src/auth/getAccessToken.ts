import { createOAuthClient, refreshAccessToken } from './oauth.js';
import { cacheAccessToken, getCachedAccessToken, getRefreshToken } from './session.js';

export class UnauthenticatedError extends Error {}

export async function getValidAccessToken(sessionToken: string | undefined): Promise<string> {
  if (!sessionToken) throw new UnauthenticatedError('Missing session token');

  const cached = getCachedAccessToken(sessionToken);
  if (cached) return cached;

  const refreshToken = getRefreshToken(sessionToken);
  if (!refreshToken) throw new UnauthenticatedError('Unknown or expired session');

  const client = createOAuthClient();
  const { accessToken, expiresInSec } = await refreshAccessToken(client, refreshToken);
  cacheAccessToken(sessionToken, accessToken, expiresInSec);
  return accessToken;
}
