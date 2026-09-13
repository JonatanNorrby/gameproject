import { MIGRATION_STATUS } from '../core/config.js';
import { updatePlayerUnitCombat } from './unitCombat.js';
import { updateProjectiles } from './projectiles.js';
import { cleanupDestroyedEntities } from './lifecycle.js';

export const COMBAT_SYSTEM_STATUS = MIGRATION_STATUS.MIGRATED;

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
export { applyPlayerEnemyDamage, getPlayerDamageMultiplier } from './playerDamage.js';
export {
  applyBurn,
  applyCorrosion,
  applySlow,
  effectiveEnemySpeed,
  markEnemy,
  updateStatusEffects,
} from './statusEffects.js';
export {
  PROJECTILE_TEAM,
  emitEnemyProjectile,
  emitPlayerProjectile,
  emitProjectile,
  updateProjectiles,
} from './projectiles.js';
export { applyBaseDamage, cleanupDestroyedEntities, ejectDestroyedApcPassenger } from './lifecycle.js';
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
export { MAX_TOWER_LEVEL, getEffectiveTowerStats, getTowerLevel } from './towerStats.js';
export { canTowerAffectEnemy, findTowerTarget, findTowerTargets } from './towerTargeting.js';
export { assertTowerCombatCoverage, updateTowerCombat } from './towerCombat.js';

// Enemy and tower attack decisions execute in their own system owners. By the
// time this clean combat pass runs, all persistent player/tower/enemy shots are
// in the shared projectile collection; update it once, then dispatch deaths.
export function updateCombat(game, dt) {
  const actions = updatePlayerUnitCombat(game, dt);
  const projectiles = updateProjectiles(game, dt);
  const lifecycle = cleanupDestroyedEntities(game);
  return { actions, projectiles, lifecycle };
}
