import { env } from '../env.js';
import type { AssetStore } from './assetStore.js';
import { LocalDiskAssetStore } from './localDiskAssetStore.js';
import { S3AssetStore } from './s3AssetStore.js';
import { VercelBlobAssetStore } from './vercelBlobAssetStore.js';

export * from './assetStore.js';
export { LocalDiskAssetStore } from './localDiskAssetStore.js';
export { S3AssetStore } from './s3AssetStore.js';
export { VercelBlobAssetStore } from './vercelBlobAssetStore.js';

let instance: AssetStore | undefined;

export function getAssetStore(): AssetStore {
  if (instance) return instance;
  switch (env.assets.driver) {
    case 'local-disk':
      instance = new LocalDiskAssetStore();
      return instance;
    case 'vercel-blob':
      instance = new VercelBlobAssetStore();
      return instance;
    case 's3':
      instance = new S3AssetStore();
      return instance;
    default:
      throw new Error(`Unknown ASSET_STORAGE_DRIVER: ${env.assets.driver}`);
  }
}
