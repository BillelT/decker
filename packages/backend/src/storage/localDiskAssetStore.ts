import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../env.js';
import type { AssetStore } from './assetStore.js';
import { AssetNotFoundError } from './assetStore.js';
import { sign } from './signedUrl.js';

/**
 * Implémentation de développement : sert les fichiers depuis le disque local
 * via une route signée (voir routes/assetsPublic.ts). NE PAS utiliser en
 * production multi-instance ou derrière un load balancer sans disque
 * partagé — remplacer par un `S3AssetStore` respectant la même interface
 * (spec §5.3, option recommandée).
 */
export class LocalDiskAssetStore implements AssetStore {
  private readonly dir = path.resolve(env.assets.localDir);

  async put(key: string, data: Buffer): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    await writeFile(this.resolvePath(key), data);
  }

  async getSignedUrl(key: string): Promise<string> {
    const expiresAt = Date.now() + env.assets.ttlMs;
    const signature = sign(key, expiresAt, env.sessionEncryptionKey);
    const params = new URLSearchParams({ exp: String(expiresAt), sig: signature });
    return `${env.publicBackendUrl}/assets/${encodeURIComponent(key)}?${params.toString()}`;
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolvePath(key), { force: true });
  }

  async read(key: string): Promise<Buffer> {
    try {
      return await readFile(this.resolvePath(key));
    } catch {
      throw new AssetNotFoundError(key);
    }
  }

  private resolvePath(key: string): string {
    const safe = key.replace(/[^a-zA-Z0-9_.-]/g, '_');
    return path.join(this.dir, safe);
  }
}
