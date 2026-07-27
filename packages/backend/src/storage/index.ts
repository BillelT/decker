import { env } from '../env.js';
import type { AssetStore } from './assetStore.js';
import { LocalDiskAssetStore } from './localDiskAssetStore.js';

export * from './assetStore.js';
export { LocalDiskAssetStore } from './localDiskAssetStore.js';

let instance: AssetStore | undefined;

export function getAssetStore(): AssetStore {
  if (instance) return instance;
  switch (env.assets.driver) {
    case 'local-disk':
      instance = new LocalDiskAssetStore();
      return instance;
    case 's3':
      throw new Error(
        'ASSET_STORAGE_DRIVER=s3 is not implemented yet — implement S3AssetStore against the AssetStore ' +
          'interface (spec §5.3) and wire it in here before using this driver.',
      );
    default:
      throw new Error(`Unknown ASSET_STORAGE_DRIVER: ${env.assets.driver}`);
  }
}
