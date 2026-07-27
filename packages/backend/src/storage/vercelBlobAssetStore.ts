import { del, put } from '@vercel/blob';
import type { AssetStore } from './assetStore.js';

/**
 * Spec §5.3 — stockage objet recommandé pour la production (Vercel n'a pas
 * de disque persistant/partagé entre invocations serverless, contrairement
 * à `LocalDiskAssetStore`). `put()` renvoie directement une URL publique —
 * pas besoin de signer quoi que ce soit nous-mêmes comme pour le disque
 * local (voir routes/assets.ts, route de service désactivée pour ce driver).
 *
 * `put()` puis `getSignedUrl()` doivent être appelés pour la même clé au
 * sein de la même requête (c'est déjà le cas partout dans ce backend,
 * voir routes/assets.ts et routes/export.ts) : l'URL réelle générée par
 * Blob n'est pas prévisible à l'avance, on la garde donc en mémoire entre
 * les deux appels.
 */
export class VercelBlobAssetStore implements AssetStore {
  private readonly urls = new Map<string, string>();

  async put(key: string, data: Buffer, contentType: string): Promise<void> {
    const blob = await put(key, data, { access: 'public', contentType, addRandomSuffix: true });
    this.urls.set(key, blob.url);
  }

  async getSignedUrl(key: string): Promise<string> {
    const url = this.urls.get(key);
    if (!url) throw new Error(`VercelBlobAssetStore: no uploaded URL for key "${key}" — call put() first`);
    return url;
  }

  async delete(key: string): Promise<void> {
    const url = this.urls.get(key);
    if (url) await del(url);
    this.urls.delete(key);
  }
}
