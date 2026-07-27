import { randomUUID } from 'node:crypto';
import { decryptSecret, encryptSecret } from './crypto.js';
import { env } from '../env.js';
import { getRedis } from '../kv.js';

interface StoredSession {
  encryptedRefreshToken: string;
  accessToken?: string;
  accessTokenExpiresAt?: number;
}

/**
 * Store persistant via `kv.ts` (Redis en production, in-memory en dev sans
 * credentials) — indispensable sur Vercel : deux requêtes du même
 * utilisateur peuvent atterrir sur deux instances serverless distinctes,
 * qui ne partagent aucune mémoire de process. TTL aligné sur le maxAge du
 * cookie `f2s_session` (90 jours).
 */
const SESSION_TTL_SEC = 90 * 24 * 3600;
const sessionKey = (token: string) => `f2s:session:${token}`;

export async function createSession(refreshToken: string): Promise<string> {
  const sessionToken = randomUUID();
  const stored: StoredSession = { encryptedRefreshToken: encryptSecret(refreshToken, env.sessionEncryptionKey) };
  await getRedis().set(sessionKey(sessionToken), stored, { ex: SESSION_TTL_SEC });
  return sessionToken;
}

export async function getRefreshToken(sessionToken: string): Promise<string | undefined> {
  const s = await getRedis().get<StoredSession>(sessionKey(sessionToken));
  if (!s) return undefined;
  return decryptSecret(s.encryptedRefreshToken, env.sessionEncryptionKey);
}

export async function cacheAccessToken(sessionToken: string, accessToken: string, expiresInSec: number): Promise<void> {
  const s = await getRedis().get<StoredSession>(sessionKey(sessionToken));
  if (!s) return;
  s.accessToken = accessToken;
  s.accessTokenExpiresAt = Date.now() + expiresInSec * 1000 - 30_000; // marge de 30s
  await getRedis().set(sessionKey(sessionToken), s, { ex: SESSION_TTL_SEC });
}

export async function getCachedAccessToken(sessionToken: string): Promise<string | undefined> {
  const s = await getRedis().get<StoredSession>(sessionKey(sessionToken));
  if (!s?.accessToken || !s.accessTokenExpiresAt) return undefined;
  if (Date.now() >= s.accessTokenExpiresAt) return undefined;
  return s.accessToken;
}

export async function destroySession(sessionToken: string): Promise<void> {
  await getRedis().del(sessionKey(sessionToken));
}
