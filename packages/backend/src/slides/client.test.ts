import { afterEach, describe, expect, it, vi } from 'vitest';
import { SlidesApiError, batchUpdate } from './client.js';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('callApi error messages', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('includes the Google API error detail in the thrown message, not just the bare status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(400, {
          error: {
            code: 400,
            message: 'Invalid requests[0].createImage: A size dimension of a page element must be positive.',
            status: 'INVALID_ARGUMENT',
          },
        }),
      ),
    );

    try {
      await batchUpdate('token', 'pres1', [{ deleteObject: { objectId: 'x' } }]);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(SlidesApiError);
      expect((err as Error).message).toContain('Slides API 400');
      expect((err as Error).message).toContain('A size dimension of a page element must be positive');
    }
  });

  it('falls back to the bare status when the body has no error.message', async () => {
    // 400 (not 429/500/503) so withRetry doesn't retry and slow the test down.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(400, {})));

    try {
      await batchUpdate('token', 'pres1', [{ deleteObject: { objectId: 'x' } }]);
      expect.unreachable();
    } catch (err) {
      expect((err as Error).message).toBe('Slides API 400 on /presentations/pres1:batchUpdate');
    }
  });
});
