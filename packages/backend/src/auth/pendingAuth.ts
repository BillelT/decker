import { randomUUID } from 'node:crypto';

/** PKCE code_verifier en attente, keyé par `state`, expire après 10 min. */
const pending = new Map<string, { codeVerifier: string; expiresAt: number }>();

const TTL_MS = 10 * 60 * 1000;

export function stashCodeVerifier(codeVerifier: string): string {
  const state = randomUUID();
  pending.set(state, { codeVerifier, expiresAt: Date.now() + TTL_MS });
  return state;
}

export function popCodeVerifier(state: string): string | undefined {
  const entry = pending.get(state);
  pending.delete(state);
  if (!entry || entry.expiresAt < Date.now()) return undefined;
  return entry.codeVerifier;
}
