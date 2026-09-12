import { MIGRATION_STATUS } from '../core/config.js';
import { updatePlayerUnitCombat } from './unitCombat.js';

export const COMBAT_SYSTEM_STATUS = MIGRATION_STATUS.PARTIALLY_MIGRATED;

export { applyDamage, hasFiniteHp, isAlive, isDamageable } from './damage.js';
export { tickCooldown, isCooldownReady, resetCooldown } from './cooldowns.js';
export {
  MOVEMENT_CLASSES,
  TARGETING_MODES,
  canAttackTarget,
  getAttackerTargetingMode,
  getTargetMovementClass,
  isActiveWorldEntity,
  targetingModeAllows,
} from './targeting.js';
export { RANGE_MODES, attackDistance, getCombatRadius, isInAttackRange } from './range.js';
export { applyPlayerEnemyDamage, getPlayerDamageMultiplier, markEnemy, tickEnemyMarks } from './playerDamage.js';
export { findBestEnemyTarget, findNearestEnemyTargets } from './unitTargeting.js';
export { applyHealing, findMedicHealTarget, updateMedicSupport } from './healing.js';
export {
  applyRepair,
  findEngineerRepairTarget,
  findRepairVehicleTarget,
  isValidRepairTarget,
  updateEngineerRepair,
  updateRepairVehicleSupport,
} from './repair.js';
export { updatePlayerMines } from './unitMines.js';
export {
  PLAYER_UNIT_COMBAT_KIND,
  PLAYER_UNIT_COMBAT_PROFILES,
  assertPlayerCombatCoverage,
  updatePlayerUnitCombat,
} from './unitCombat.js';

// Prompt 7 migrates player-unit combat/support ownership only. Tower combat,
// enemy attacks/AI, projectile travel/impact, burn ticking and enemy-death
// lifecycle remain outside this update.
export function updateCombat(game, dt) {
  return updatePlayerUnitCombat(game, dt);
}
