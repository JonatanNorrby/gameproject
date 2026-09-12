import { MIGRATION_STATUS } from '../core/config.js';
export { BUILDING_CONFIG, BUILDING_TYPES, getBuildingConfig, getBuildingRadius, normalizeBuildingType, wallBuildTime, wallCost, wallHp } from './buildingConfig.js';

export const BUILDING_SYSTEM_STATUS = MIGRATION_STATUS.SKELETON_CREATED;

// Future owner: active building lifecycle/placement. Static definitions are
// migrated; placement/runtime logic remains legacy-owned.
export function updateBuildings(_game, _dt) {
  // Prompt 3 still provides interface only.
}
