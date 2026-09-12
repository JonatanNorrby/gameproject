import { MIGRATION_STATUS } from '../core/config.js';

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

// Prompt 6 migrates foundation helpers only. Attack loops, projectiles, healing,
// repair, enemy AI, tower combat and lifecycle cleanup intentionally remain legacy.
export function updateCombat(_game, _dt) {}
