import { MIGRATION_STATUS } from '../core/config.js';
export { TOWER_CONFIG, TOWER_TYPES, getTowerConfig, getTowerLevelStats, normalizeTowerType } from './towerConfig.js';

export const TOWER_SYSTEM_STATUS = MIGRATION_STATUS.SKELETON_CREATED;

// Future owner: tower lifecycle and combat. Static tower/upgrades data is migrated;
// active tower combat behavior remains legacy-owned.
export function updateTowers(_game, _dt) {
  // Prompt 3 still provides interface only.
}
