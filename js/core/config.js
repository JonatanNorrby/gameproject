// Future clean-runtime configuration root. This module has no legacy-runtime side effects.

export const MIGRATION_STATUS = Object.freeze({
  NOT_STARTED: 'NOT STARTED',
  SKELETON_CREATED: 'SKELETON CREATED',
  PARTIALLY_MIGRATED: 'PARTIALLY MIGRATED',
  MIGRATED: 'MIGRATED',
});

// Values below are the current authoritative core/runtime values after the active
// legacy overrides (not the older defaults in config.js).
export const GAME_CONFIG = Object.freeze({
  game: Object.freeze({
    startingGold: 125,
    startingMetal: 0,
    startingBaseHp: 300,
    workerCount: 3,
  }),
  world: Object.freeze({
    width: 10120,
    height: 7590,
    baseRadius: 68,
    cameraSpeed: 1200,
    viewportWidth: 1280,
    viewportHeight: 800,
    minZoom: 0.18,
    maxZoom: 1.35,
    zoomStep: 0.10,
  }),
  pathfinding: Object.freeze({
    cellSize: 48,
    maxVisited: 50000,
  }),
});

// Prompt 2 establishes category ownership without copying the legacy balance
// tables prematurely. Numeric balance stays authoritative in the old runtime
// until the owning system is migrated and verified value-for-value.
export const CONFIG_OWNERSHIP = Object.freeze({
  core: 'js/core/config.js',
  units: 'js/units/units.js',
  enemies: 'js/enemies/enemies.js',
  towers: 'js/towers/towers.js',
  buildings: 'js/buildings/buildings.js',
  economy: 'js/economy/economy.js',
  navigation: 'js/navigation/navigation.js',
  fog: 'js/fog/fog.js',
  rendering: 'js/rendering/renderer.js',
  input: 'js/input/input.js',
  ui: 'js/ui/ui.js',
  assets: 'js/assets/assets.js',
});

export function createGameConfig() {
  // Return the immutable source object for now. When balance tables are migrated,
  // this creator becomes the single composition point for those category configs.
  return GAME_CONFIG;
}
