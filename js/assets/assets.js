import { MIGRATION_STATUS } from '../core/config.js';

export const ASSET_SYSTEM_STATUS = MIGRATION_STATUS.MIGRATED;

export const ASSET_KEYS = Object.freeze({
  RIFLE_SOLDIER: 'rifle-soldier',
  MECH_STRIDER: 'mech-strider',
});

export const ASSET_MANIFEST = Object.freeze({
  [ASSET_KEYS.RIFLE_SOLDIER]: Object.freeze({ src: 'rifle_soldier.png', kind: 'image' }),
  [ASSET_KEYS.MECH_STRIDER]: Object.freeze({ src: 'mech_strider.png', kind: 'image' }),
});

function makeEntry(id, definition) {
  return { id, ...definition, image: null, status: 'unloaded', error: null };
}

export function createAssetRegistry({ ImageCtor = typeof Image !== 'undefined' ? Image : null } = {}) {
  const assets = new Map(Object.entries(ASSET_MANIFEST).map(([id, def]) => [id, makeEntry(id, def)]));
  return {
    set(id, asset) { if (!id) throw new TypeError('Asset id is required'); assets.set(id, asset); return asset; },
    get(id) { return assets.get(id) ?? null; },
    has(id) { return assets.has(id); },
    entries() { return [...assets.values()]; },
    clear() { assets.clear(); },
    load(id) {
      const entry = assets.get(id);
      if (!entry) throw new Error(`Unknown asset: ${id}`);
      if (entry.status === 'loaded') return Promise.resolve(entry);
      if (!ImageCtor) { entry.status = 'unsupported'; return Promise.resolve(entry); }
      return new Promise(resolve => {
        const image = new ImageCtor();
        entry.image = image; entry.status = 'loading';
        image.onload = () => { entry.status = 'loaded'; entry.error = null; resolve(entry); };
        image.onerror = error => { entry.status = 'error'; entry.error = error || new Error(`Failed to load ${entry.src}`); resolve(entry); };
        image.src = entry.src;
      });
    },
    loadAll() { return Promise.all([...assets.keys()].map(id => this.load(id))); },
  };
}
