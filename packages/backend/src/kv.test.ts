import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fakeRedisInstance = { get: vi.fn(), set: vi.fn(), del: vi.fn() };
const fromEnvMock = vi.fn(() => fakeRedisInstance);
vi.mock('@upstash/redis', () => ({ Redis: { fromEnv: fromEnvMock } }));

const ENV_KEYS = ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'KV_REST_API_URL', 'KV_REST_API_TOKEN'] as const;

beforeEach(() => {
  vi.resetModules();
  fromEnvMock.mockClear();
  for (const k of ENV_KEYS) delete process.env[k];
});

afterEach(() => {
  for (const k of ENV_KEYS) delete process.env[k];
});

describe('getRedis dispatch', () => {
  it('falls back to an in-memory store when no Redis credentials are set (plain local dev)', async () => {
    const { getRedis } = await import('./kv.js');
    const store = getRedis();
    expect(fromEnvMock).not.toHaveBeenCalled();

    await store.set('k', 'v', { ex: 60 });
    expect(await store.get('k')).toBe('v');
  });

  it('uses Redis.fromEnv when UPSTASH_REDIS_REST_URL/TOKEN are present', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'token';
    const { getRedis } = await import('./kv.js');
    const store = getRedis();
    expect(fromEnvMock).toHaveBeenCalledTimes(1);
    expect(store).toBe(fakeRedisInstance);
  });

  it('also accepts the legacy KV_REST_API_URL/TOKEN naming', async () => {
    process.env.KV_REST_API_URL = 'https://example.upstash.io';
    process.env.KV_REST_API_TOKEN = 'token';
    const { getRedis } = await import('./kv.js');
    getRedis();
    expect(fromEnvMock).toHaveBeenCalledTimes(1);
  });

  it('an in-memory value expires after its TTL', async () => {
    vi.useFakeTimers();
    const { getRedis } = await import('./kv.js');
    const store = getRedis();
    await store.set('k', 'v', { ex: 1 }); // 1 second
    expect(await store.get('k')).toBe('v');
    vi.advanceTimersByTime(1500);
    expect(await store.get('k')).toBeNull();
    vi.useRealTimers();
  });
});
