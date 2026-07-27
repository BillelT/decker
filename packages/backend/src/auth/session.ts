import { randomUUID } from 'node:crypto';
import { decryptSecret, encryptSecret } from './crypto.js';
import { env } from '../env.js';

interface StoredSession {
  encryptedRefreshToken: string;
  accessToken?: string;
  accessTokenExpiresAt?: number;
}

/**
 * Stockage des sessions. En mémoire pour le dev (§5.2 — le client ne reçoit
 * qu'un jeton de session opaque). Pour un déploiement multi-instance,
 * remplacer par Redis/une table DB — l'interface reste la même.
 */
const sessions = new Map<string, StoredSession>();

export function createSession(refreshToken: string): string {
  const sessionToken = randomUUID();
  sessions.set(sessionToken, {
    encryptedRefreshToken: encryptSecret(refreshToken, env.sessionEncryptionKey),
  });
  return sessionToken;
}

export function getRefreshToken(sessionToken: string): string | undefined {
  const s = sessions.get(sessionToken);
  if (!s) return undefined;
  return decryptSecret(s.encryptedRefreshToken, env.sessionEncryptionKey);
}

export function cacheAccessToken(sessionToken: string, accessToken: string, expiresInSec: number): void {
  const s = sessions.get(sessionToken);
  if (!s) return;
  s.accessToken = accessToken;
  s.accessTokenExpiresAt = Date.now() + expiresInSec * 1000 - 30_000; // marge de 30s
}

export function getCachedAccessToken(sessionToken: string): string | undefined {
  const s = sessions.get(sessionToken);
  if (!s?.accessToken || !s.accessTokenExpiresAt) return undefined;
  if (Date.now() >= s.accessTokenExpiresAt) return undefined;
  return s.accessToken;
}

export function destroySession(sessionToken: string): void {
  sessions.delete(sessionToken);
}
