import {
  getEntityKind,
  getUnitDefinition,
  getUnitRole,
  isFlyingEnemy,
  isFlyingUnit,
  isGroundEnemy,
  isGroundUnit,
  isTower,
} from '../core/entities.js';
import { getTowerConfig } from '../towers/towerConfig.js';
import { hasUnitTrait } from '../units/unitConfig.js';
import { isAlive } from './damage.js';

export const TARGETING_MODES = Object.freeze({
  ANY: 'any',
  GROUND: 'ground',
  AIR: 'air',
});

export const MOVEMENT_CLASSES = Object.freeze({
  GROUND: 'ground',
  AIR: 'air',
});

function normalizeTargetingMode(value) {
  return Object.values(TARGETING_MODES).includes(value) ? value : null;
}

export function getTargetMovementClass(game, target) {
  if (!target) return null;
  if (target === game?.state?.base) return MOVEMENT_CLASSES.GROUND;
  if (isFlyingUnit(target) || isFlyingEnemy(target)) return MOVEMENT_CLASSES.AIR;
  if (isGroundUnit(target) || isGroundEnemy(target)) return MOVEMENT_CLASSES.GROUND;
  const kind = getEntityKind(target);
  if (kind === 'tower' || kind === 'building') return MOVEMENT_CLASSES.GROUND;
  return null;
}

export function getAttackerTargetingMode(attacker, explicitMode = null) {
  const explicit = normalizeTargetingMode(explicitMode);
  if (explicit) return explicit;

  const direct = normalizeTargetingMode(attacker?.targeting)
    || normalizeTargetingMode(attacker?.combat?.targeting);
  if (direct) return direct;

  const unitDefinition = getUnitDefinition(attacker);
  const unitMode = normalizeTargetingMode(unitDefinition?.combat?.targeting);
  if (unitMode) return unitMode;

  if (isTower(attacker)) {
    return normalizeTargetingMode(getTowerConfig(attacker.type).targeting);
  }

  // Enemy target-mode selection is still AI-owned. Later enemy migration should
  // pass an explicit mode instead of making this shared foundation guess intent.
  return null;
}

export function targetingModeAllows(mode, movementClass) {
  const normalized = normalizeTargetingMode(mode);
  if (!normalized || !movementClass) return false;
  return normalized === TARGETING_MODES.ANY || normalized === movementClass;
}

export function isActiveWorldEntity(game, target) {
  if (!game || !target) return false;
  if (target === game.state?.base) return true;
  const entities = game.state?.entities;
  if (!entities) return false;
  return (entities.units || []).includes(target)
    || (entities.enemies || []).includes(target)
    || (entities.structures || []).includes(target);
}

export function canAttackTarget(game, attacker, target, options = {}) {
  if (!target || !isAlive(target)) return false;
  if (attacker && Object.prototype.hasOwnProperty.call(attacker, 'hp') && !isAlive(attacker)) return false;

  if (options.requireActiveWorld !== false) {
    const active = typeof options.isActive === 'function'
      ? options.isActive(target, game)
      : isActiveWorldEntity(game, target);
    if (!active) return false;
  }

  const role = getUnitRole(target);
  if (role) {
    if (target.transportedIn || target.garrisonedIn) return false;
    // Current enemy targeting deliberately ignores the Sneaky Spotter. Keep the
    // rule here via its canonical stealth trait, without migrating Spotter AI/UI.
    if (hasUnitTrait(role, 'stealth') && options.allowStealthTarget !== true) return false;
  }

  if (target.burrowed && options.allowBurrowedTarget !== true) return false;
  if (target.cloaked && options.allowCloakedTarget !== true) {
    if (typeof options.isRevealed !== 'function' || !options.isRevealed(target, attacker, game)) return false;
  }
  if (target.protected && options.allowProtectedTarget === false) return false;
  if (typeof options.isVisible === 'function' && !options.isVisible(target, attacker, game)) return false;

  const movementClass = options.targetMovementClass || getTargetMovementClass(game, target);
  const mode = getAttackerTargetingMode(attacker, options.targeting);
  return targetingModeAllows(mode, movementClass);
}
