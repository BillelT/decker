import { del, put } from '@vercel/blob';
import type { AssetStore } from './assetStore.js';
import { getRedis } from '../kv.js';

const URL_TTL_SEC = 3600;

function redisKey(key: string): string {
  return `asset-url:${key}`;
}

/**
 * Spec §5.3 — stockage objet recommandé pour la production (Vercel n'a pas
 * de disque persistant/partagé entre invocations serverless, contrairement
 * à `LocalDiskAssetStore`). `put()` renvoie directement une URL publique —
 * pas besoin de signer quoi que ce soit nous-mêmes comme pour le disque
 * local (voir routes/assets.ts, route de service désactivée pour ce driver).
 *
 * L'URL réelle générée par Blob n'est pas prévisible à l'avance : on la
 * garde donc dans le même store Redis partagé que sessions/jobs (`kv.ts`),
 * pas dans une simple `Map` en mémoire — un gros export peut pré-uploader
 * ses assets via POST /assets puis les référencer depuis POST /export, deux
 * requêtes qui atterrissent sur des invocations serverless distinctes.
 */
export class VercelBlobAssetStore implements AssetStore {
  async put(key: string, data: Buffer, contentType: string): Promise<void> {
    const blob = await put(key, data, { access: 'public', contentType, addRandomSuffix: true });
    await getRedis().set(redisKey(key), blob.url, { ex: URL_TTL_SEC });
  }

  async getSignedUrl(key: string): Promise<string> {
    const url = await getRedis().get<string>(redisKey(key));
    if (!url) throw new Error(`VercelBlobAssetStore: no uploaded URL for key "${key}" — call put() first`);
    return url;
  }

  async delete(key: string): Promise<void> {
    const url = await getRedis().get<string>(redisKey(key));
    if (url) await del(url);
    await getRedis().del(redisKey(key));
  }
}
