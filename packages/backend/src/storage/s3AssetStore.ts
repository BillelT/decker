import { DeleteObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { env } from '../env.js';
import type { AssetStore } from './assetStore.js';
import { AssetNotFoundError } from './assetStore.js';

let client: S3Client | undefined;

function getClient(): S3Client {
  if (!client) {
    client = new S3Client({
      region: env.s3.region,
      endpoint: env.s3.endpoint,
      credentials: { accessKeyId: env.s3.accessKeyId, secretAccessKey: env.s3.secretAccessKey },
    });
  }
  return client;
}

/**
 * Implémentation générique S3 (spec §5.3, option recommandée) — testée
 * contre Cloudflare R2 : egress gratuit contrairement à `VercelBlobAssetStore`.
 * La clé est le chemin objet exact (pas de suffixe aléatoire côté provider
 * comme sur Vercel Blob), donc l'URL publique est prévisible à partir de
 * `S3_PUBLIC_BASE_URL` — pas besoin de la faire transiter par Redis.
 * `getSignedUrl` fait un HEAD pour distinguer un asset réellement présent
 * d'une clé jamais uploadée (même contrat d'erreur que les autres stores :
 * l'appelant traite l'échec comme "asset absent", cf. routes/export.ts).
 */
export class S3AssetStore implements AssetStore {
  async put(key: string, data: Buffer, contentType: string): Promise<void> {
    await getClient().send(new PutObjectCommand({ Bucket: env.s3.bucket, Key: key, Body: data, ContentType: contentType }));
  }

  async getSignedUrl(key: string): Promise<string> {
    try {
      await getClient().send(new HeadObjectCommand({ Bucket: env.s3.bucket, Key: key }));
    } catch {
      throw new AssetNotFoundError(key);
    }
    return `${env.s3.publicBaseUrl}/${encodeURIComponent(key)}`;
  }

  async delete(key: string): Promise<void> {
    await getClient().send(new DeleteObjectCommand({ Bucket: env.s3.bucket, Key: key }));
  }
}
