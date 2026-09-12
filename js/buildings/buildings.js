import { MIGRATION_STATUS } from '../core/config.js';

export const BUILDING_SYSTEM_STATUS = MIGRATION_STATUS.SKELETON_CREATED;

// Bunker and safe-spot IDs are intentionally excluded: the current live runtime
// removes those features. Wall remains a structure but is owned by placement/navigation.
export const BUILDING_TYPES = Object.freeze([
  'mine', 'oremine', 'refinery', 'landingpad',
]);

export function updateBuildings(_game, _dt) {
  // Prompt 2 interface only.
}
