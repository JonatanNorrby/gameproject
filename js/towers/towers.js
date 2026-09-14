import { MIGRATION_STATUS } from '../core/config.js';
import { updateTowerCombat } from '../combat/towerCombat.js';

export { TOWER_CONFIG, TOWER_TYPES, getTowerConfig, getTowerLevelStats, normalizeTowerType } from './towerConfig.js';
export { MAX_TOWER_LEVEL, getEffectiveTowerStats, getTowerLevel } from '../combat/towerStats.js';
export { canTowerAffectEnemy, findTowerTarget, findTowerTargets } from '../combat/towerTargeting.js';
export { assertTowerCombatCoverage, updateTowerCombat } from '../combat/towerCombat.js';

export const TOWER_SYSTEM_STATUS = MIGRATION_STATUS.MIGRATED;

// Step 5 installs this clean tower-system entry point into the production frame
// through js/migration/towerProjectileLegacyBridge.js. Placement, upgrades and
// rendering remain on their existing owners until their dedicated migration steps.
export function updateTowers(game, dt) {
  return updateTowerCombat(game, dt);
}
