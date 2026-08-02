import { afterEach, describe, expect, it, vi } from 'vitest';
import { SlidesApiError, batchUpdate, createPresentation } from './client.js';

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

describe('createPresentation', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('omits pageSize when none is given (Slides defaults to 16:9)', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { presentationId: 'p1', slides: [{ objectId: 's1' }], masters: [{ objectId: 'm1' }] }));
    vi.stubGlobal('fetch', fetchMock);

    await createPresentation('token', 'My deck');

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toEqual({ title: 'My deck' });
  });

  it('passes pageSize in points so the presentation matches the source frame ratio', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { presentationId: 'p1', slides: [{ objectId: 's1' }], masters: [{ objectId: 'm1' }] }));
    vi.stubGlobal('fetch', fetchMock);

    await createPresentation('token', 'My deck', { widthPt: 720, heightPt: 460 });

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toEqual({
      title: 'My deck',
      pageSize: { width: { magnitude: 720, unit: 'PT' }, height: { magnitude: 460, unit: 'PT' } },
    });
  });

  it('returns the master objectId from the same create response (audit 2026-08 — no extra getPresentation call needed)', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { presentationId: 'p1', slides: [{ objectId: 's1' }], masters: [{ objectId: 'm1' }] }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await createPresentation('token', 'My deck');

    expect(result).toEqual({ presentationId: 'p1', firstSlideObjectId: 's1', masterObjectId: 'm1' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
