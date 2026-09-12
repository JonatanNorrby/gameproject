import { MIGRATION_STATUS } from '../core/config.js';
import { ensureMainBaseRuntime, initializeBuildingRuntime, updateEconomicBuildingConstruction } from './buildingRuntime.js';
export { BUILDING_CONFIG, BUILDING_TYPES, getBuildingConfig, getBuildingRadius, normalizeBuildingType, wallBuildTime, wallCost, wallHp } from './buildingConfig.js';
export * from './buildingRuntime.js';

export const BUILDING_SYSTEM_STATUS = MIGRATION_STATUS.PARTIALLY_MIGRATED;

// Placement/input, tower construction and Wall construction intentionally remain
// outside this migration. This owner normalizes the runtime state of already-created
// economic buildings and owns their construction progress after placement.
export function updateBuildings(game, dt) {
  if (!game?.state?.entities) return { initialized: 0, completed: 0 };
  ensureMainBaseRuntime(game);
  let initialized = 0;
  for (const structure of game.state.entities.structures || []) {
    if (!['mine', 'oremine', 'refinery', 'landingpad'].includes(structure.type)) continue;
    initializeBuildingRuntime(game, structure);
    initialized++;
  }
  const completed = updateEconomicBuildingConstruction(game, dt);
  return { initialized, completed };
}
