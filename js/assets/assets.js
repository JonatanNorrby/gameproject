import { MIGRATION_STATUS } from '../core/config.js';

export const ASSET_SYSTEM_STATUS = MIGRATION_STATUS.SKELETON_CREATED;

export function createAssetRegistry() {
  const assets = new Map();
  return {
    set(id, asset) {
      if (!id) throw new TypeError('Asset id is required');
      assets.set(id, asset);
      return asset;
    },
    get(id) {
      return assets.get(id) ?? null;
    },
    has(id) {
      return assets.has(id);
    },
    clear() {
      assets.clear();
    },
  };
}
