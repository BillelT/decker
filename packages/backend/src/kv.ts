import { Redis } from '@upstash/redis';

/**
 * Store persistant partagé (sessions, jobs d'export, PKCE en attente) — les
 * `Map` en mémoire ne survivent pas d'une invocation de fonction serverless
 * à l'autre sur Vercel, ni même entre deux requêtes du même flow OAuth si
 * elles atterrissent sur des instances différentes.
 *
 * En dev local sans credentials Redis configurés (cas normal — `npm run
 * dev` doit continuer à marcher sans dépendance externe), on retombe
 * silencieusement sur un store en mémoire équivalent : mêmes garanties que
 * l'ancien code, juste extrait derrière cette interface. Dès que les
 * variables d'environnement Redis sont présentes (cas Vercel une fois le
 * store lié au projet, voir README §8), le vrai client Redis prend le
 * relais automatiquement.
 */
export interface KvStore {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, opts: { ex: number }): Promise<unknown>;
  del(key: string): Promise<unknown>;
}

class InMemoryKvStore implements KvStore {
  private readonly store = new Map<string, { value: unknown; expiresAt: number }>();

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() >= entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async set(key: string, value: unknown, opts: { ex: number }): Promise<'OK'> {
    this.store.set(key, { value, expiresAt: Date.now() + opts.ex * 1000 });
    return 'OK';
  }

  async del(key: string): Promise<number> {
    return this.store.delete(key) ? 1 : 0;
  }
}

function hasRedisCredentials(): boolean {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return Boolean(url && token);
}

let client: KvStore | undefined;

export function getRedis(): KvStore {
  if (client) return client;
  if (hasRedisCredentials()) {
    client = Redis.fromEnv();
  } else {
    // eslint-disable-next-line no-console
    console.warn(
      "[kv] Aucun credential Redis trouvé (UPSTASH_REDIS_REST_URL/TOKEN ou KV_REST_API_URL/TOKEN) — " +
        'utilisation d\'un store en mémoire pour cette session de dev. Ne survit ni à un redémarrage, ni ' +
        '(sur Vercel) entre invocations serverless : lie un store Redis au projet avant de déployer (README §8).',
    );
    client = new InMemoryKvStore();
  }
  return client;
}
