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

/**
 * Résultat du callback OAuth, gardé sous le même `state` que le
 * code_verifier ci-dessus, pour que l'iframe du plugin (qui a démarré le
 * flow et connaît donc ce `state`) puisse le récupérer par polling une fois
 * l'utilisateur revenu de la fenêtre Google — sans copier-coller de jeton à
 * la main.
 */
export type AuthPollResult = { status: 'ready'; sessionToken: string } | { status: 'error'; message: string };

const RESULT_TTL_SEC = 10 * 60;
const resultKey = (state: string) => `f2s:pkce:result:${state}`;

export async function stashAuthResult(state: string, result: AuthPollResult): Promise<void> {
  await getRedis().set(resultKey(state), result, { ex: RESULT_TTL_SEC });
}

/** Single-use comme `popCodeVerifier` : une fois lu, le résultat est effacé. */
export async function popAuthResult(state: string): Promise<AuthPollResult | undefined> {
  const result = await getRedis().get<AuthPollResult>(resultKey(state));
  if (result) await getRedis().del(resultKey(state));
  return result ?? undefined;
}
