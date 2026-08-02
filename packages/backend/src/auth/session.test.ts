import { describe, expect, it } from 'vitest';
import { createSession, getRefreshToken, cacheAccessToken, getCachedAccessToken, destroySession } from './session.js';

// Pas de credentials Redis dans l'environnement de test → `kv.ts` retombe
// sur son store en mémoire (voir kv.test.ts pour la logique de dispatch
// elle-même) ; ce fichier teste juste le comportement de session.ts.
const TEST_KEY = 'c70ec06f0e1ea8cf9866668138c10db01c048b4281c4d37a41f86ec44af5458f'; // 32 bytes hex-encoded, generated for this test only
process.env.SESSION_ENCRYPTION_KEY = TEST_KEY;

describe('session store', () => {
  it('round-trips a refresh token through encryption', async () => {
    const sessionToken = await createSession('my-refresh-token');
    expect(await getRefreshToken(sessionToken)).toBe('my-refresh-token');
  });

  it('returns undefined for an unknown session token', async () => {
    expect(await getRefreshToken('does-not-exist')).toBeUndefined();
  });

  it('caches and returns a still-valid access token', async () => {
    const sessionToken = await createSession('refresh');
    await cacheAccessToken(sessionToken, 'access-123', 3600);
    expect(await getCachedAccessToken(sessionToken)).toBe('access-123');
  });

  it('treats an expired cached access token as absent', async () => {
    const sessionToken = await createSession('refresh');
    await cacheAccessToken(sessionToken, 'access-123', -1); // already expired
    expect(await getCachedAccessToken(sessionToken)).toBeUndefined();
  });

  it('destroySession removes the session entirely', async () => {
    const sessionToken = await createSession('refresh');
    await destroySession(sessionToken);
    expect(await getRefreshToken(sessionToken)).toBeUndefined();
  });
});
