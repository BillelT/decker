import { describe, expect, it } from 'vitest';
import { stashCodeVerifier, popCodeVerifier } from './pendingAuth.js';

// Pas de credentials Redis dans l'environnement de test → `kv.ts` retombe
// sur son store en mémoire (voir kv.test.ts pour la logique de dispatch
// elle-même) ; ce fichier teste juste le comportement de pendingAuth.ts.

describe('pendingAuth (PKCE store)', () => {
  it('round-trips a code_verifier through its generated state', async () => {
    const state = await stashCodeVerifier('my-code-verifier');
    expect(await popCodeVerifier(state)).toBe('my-code-verifier');
  });

  it('is single-use: a second pop for the same state returns undefined', async () => {
    const state = await stashCodeVerifier('my-code-verifier');
    await popCodeVerifier(state);
    expect(await popCodeVerifier(state)).toBeUndefined();
  });

  it('returns undefined for an unknown state', async () => {
    expect(await popCodeVerifier('unknown-state')).toBeUndefined();
  });

  it('generates a distinct state per call', async () => {
    const state1 = await stashCodeVerifier('verifier-1');
    const state2 = await stashCodeVerifier('verifier-2');
    expect(state1).not.toBe(state2);
    expect(await popCodeVerifier(state1)).toBe('verifier-1');
    expect(await popCodeVerifier(state2)).toBe('verifier-2');
  });
});
