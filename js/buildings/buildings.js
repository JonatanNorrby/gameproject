import { MIGRATION_STATUS } from '../core/config.js';
import { ensureMainBaseRuntime, initializeBuildingRuntime } from './buildingRuntime.js';
import { updateConstruction } from './construction.js';
export { BUILDING_CONFIG, BUILDING_TYPES, getBuildingConfig, getBuildingRadius, normalizeBuildingType, wallBuildTime, wallCost, wallHp } from './buildingConfig.js';
export * from './buildingRuntime.js';
export * from './construction.js';
export * from './placement.js';

export const BUILDING_SYSTEM_STATUS = MIGRATION_STATUS.MIGRATED;

// Runtime normalization remains type-specific for economic storage buildings,
// while one shared construction owner advances economic buildings, towers and
// multi-segment Wall groups exactly once.
export function updateBuildings(game, dt) {
  if (!game?.state?.entities) return { initialized: 0, construction: { groups: 0, completedGroups: 0, completedStructures: 0 } };
  ensureMainBaseRuntime(game);
  let initialized = 0;
  for (const structure of game.state.entities.structures || []) {
    if (!['mine', 'oremine', 'refinery', 'landingpad'].includes(structure.type)) continue;
    initializeBuildingRuntime(game, structure);
    initialized++;
  }
  const construction = updateConstruction(game, dt);
  return { initialized, construction };
}
