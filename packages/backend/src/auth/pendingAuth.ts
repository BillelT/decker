import { randomUUID } from 'node:crypto';
import { getRedis } from '../kv.js';

/**
 * PKCE code_verifier en attente, keyé par `state`, expire après 10 min.
 * Store via `kv.ts` (Redis en production, in-memory en dev sans
 * credentials) : la requête qui initie le login et celle qui reçoit le
 * callback OAuth peuvent atterrir sur deux instances serverless distinctes,
 * qui ne partagent aucune mémoire de process.
 */
const TTL_SEC = 10 * 60;
const key = (state: string) => `f2s:pkce:${state}`;

export async function stashCodeVerifier(codeVerifier: string): Promise<string> {
  const state = randomUUID();
  await getRedis().set(key(state), codeVerifier, { ex: TTL_SEC });
  return state;
}

export async function popCodeVerifier(state: string): Promise<string | undefined> {
  const codeVerifier = await getRedis().get<string>(key(state));
  if (codeVerifier) await getRedis().del(key(state));
  return codeVerifier ?? undefined;
}
