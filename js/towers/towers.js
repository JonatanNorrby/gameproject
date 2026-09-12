import { MIGRATION_STATUS } from '../core/config.js';
import { updateTowerCombat } from '../combat/towerCombat.js';

export { TOWER_CONFIG, TOWER_TYPES, getTowerConfig, getTowerLevelStats, normalizeTowerType } from './towerConfig.js';
export { MAX_TOWER_LEVEL, getEffectiveTowerStats, getTowerLevel } from '../combat/towerStats.js';
export { canTowerAffectEnemy, findTowerTarget, findTowerTargets } from '../combat/towerTargeting.js';
export { assertTowerCombatCoverage, updateTowerCombat } from '../combat/towerCombat.js';

export const TOWER_SYSTEM_STATUS = MIGRATION_STATUS.PARTIALLY_MIGRATED;

// Prompt 8 makes this the clean tower-system entry point. Production still uses
// the legacy updateTowers chain until the later runtime activation prompt.
export function updateTowers(game, dt) {
  return updateTowerCombat(game, dt);
}
