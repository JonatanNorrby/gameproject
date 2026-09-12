import { getEnemyConfig, hasEnemyTrait } from './enemyConfig.js';
import {
  getUnitRole,
  isFlyingUnit,
  isTower,
} from '../core/entities.js';
import { getUnitConfig } from '../units/unitConfig.js';
import { canAttackTarget, TARGETING_MODES } from '../combat/targeting.js';
import { attackDistance } from '../combat/range.js';
import { squaredDistance } from '../utils/math.js';

const ECONOMY_STRUCTURE_TYPES = new Set(['mine', 'oremine', 'refinery', 'landingpad']);

export function isActivePlayerUnit(unit) {
  return !!unit && Number(unit.hp) > 0 && !unit.transportedIn && !unit.garrisonedIn;
}

export function isActiveStructure(structure, { builtOnly = false } = {}) {
  return !!structure && Number(structure.hp) > 0 && (!builtOnly || structure.built !== false);
}

export function targetDistance(game, enemy, target) {
  return attackDistance(game, enemy, target);
}

function unitTargetingMode(enemy) {
  if (hasEnemyTrait(enemy, 'ranged')) return TARGETING_MODES.ANY;
  return TARGETING_MODES.GROUND;
}

export function canEnemyTargetUnit(game, enemy, unit, { targeting = unitTargetingMode(enemy) } = {}) {
  if (!isActivePlayerUnit(unit)) return false;
  return canAttackTarget(game, enemy, unit, { targeting });
}

export function canEnemyTargetStructure(game, enemy, structure, { builtOnly = false } = {}) {
  if (!isActiveStructure(structure, { builtOnly })) return false;
  return canAttackTarget(game, enemy, structure, { targeting: TARGETING_MODES.GROUND });
}

export function findOrdinaryEnemyTarget(game, enemy, maxRange, { includeProtected = false, targeting = unitTargetingMode(enemy) } = {}) {
  const limit = Number(maxRange);
  if (!enemy || !Number.isFinite(limit) || limit <= 0) return null;
  let best = null;
  let bestDistance = limit;

  // Current v47 priority: structures are scanned before units. Equal-distance
  // units therefore do not replace a structure already selected.
  for (const structure of game?.state?.entities?.structures || []) {
    if (!canEnemyTargetStructure(game, enemy, structure)) continue;
    if (!includeProtected && structure.protected) continue;
    const distance = targetDistance(game, enemy, structure);
    if (distance < bestDistance) {
      best = structure;
      bestDistance = distance;
    }
  }

  for (const unit of game?.state?.entities?.units || []) {
    if (!canEnemyTargetUnit(game, enemy, unit, { targeting })) continue;
    const distance = targetDistance(game, enemy, unit);
    if (distance < bestDistance) {
      best = unit;
      bestDistance = distance;
    }
  }
  return best;
}

export function nearestTargetFrom(game, enemy, list, { builtOnly = false } = {}) {
  let best = null;
  let bestDistance = Infinity;
  for (const target of list || []) {
    const unitRole = getUnitRole(target);
    const valid = unitRole
      ? canEnemyTargetUnit(game, enemy, target, { targeting: TARGETING_MODES.GROUND })
      : canEnemyTargetStructure(game, enemy, target, { builtOnly });
    if (!valid) continue;
    const distance = targetDistance(game, enemy, target);
    if (distance < bestDistance) {
      best = target;
      bestDistance = distance;
    }
  }
  return best;
}

export function getEnemyLureTarget(game, enemy) {
  if (!enemy?.attractedTo) return null;
  const target = (game?.state?.entities?.structures || []).find(structure => (
    structure.id === enemy.attractedTo
    && structure.type === 'landingpad'
    && structure.built
    && Number(structure.hp) > 0
  ));
  if (!target) enemy.attractedTo = null;
  return target || null;
}

export function economyStructures(game) {
  return (game?.state?.entities?.structures || []).filter(structure => (
    isActiveStructure(structure, { builtOnly: true }) && ECONOMY_STRUCTURE_TYPES.has(structure.type)
  ));
}

export function combatStructures(game) {
  return (game?.state?.entities?.structures || []).filter(structure => (
    isActiveStructure(structure, { builtOnly: true }) && isTower(structure)
  ));
}

export function builtWalls(game) {
  return (game?.state?.entities?.structures || []).filter(structure => (
    isActiveStructure(structure, { builtOnly: true }) && structure.type === 'wall'
  ));
}

export function findStrategicEnemyTarget(game, enemy) {
  if (!enemy) return null;
  if (enemy.type === 'siegebeast') {
    // Current behavior prioritizes any surviving Wall globally before considering
    // towers/economy, even when another structure is nearer.
    return nearestTargetFrom(game, enemy, builtWalls(game), { builtOnly: true })
      || nearestTargetFrom(game, enemy, [...combatStructures(game), ...economyStructures(game)], { builtOnly: true });
  }
  if (enemy.type === 'harvesterhunter') {
    const trucks = (game?.state?.entities?.units || []).filter(unit => getUnitRole(unit) === 'truck' && isActivePlayerUnit(unit));
    return nearestTargetFrom(game, enemy, trucks) || nearestTargetFrom(game, enemy, economyStructures(game), { builtOnly: true });
  }
  if (enemy.type === 'saboteur') {
    return nearestTargetFrom(game, enemy, economyStructures(game), { builtOnly: true })
      || nearestTargetFrom(game, enemy, combatStructures(game), { builtOnly: true });
  }
  if (enemy.type === 'acidlobber') {
    return nearestTargetFrom(game, enemy, [...builtWalls(game), ...combatStructures(game), ...economyStructures(game)], { builtOnly: true });
  }
  return null;
}

export function isSaboteurDetected(game, enemy) {
  if (!enemy || enemy.type !== 'saboteur') return true;
  const reveal = Number(getEnemyConfig('saboteur').stealth?.revealRange) || 145;
  const base = game?.state?.base;
  if (base && squaredDistance(enemy.x, enemy.y, base.x, base.y) <= (base.radius + reveal) ** 2) return true;

  for (const structure of game?.state?.entities?.structures || []) {
    if (!isActiveStructure(structure, { builtOnly: true })) continue;
    if (squaredDistance(enemy.x, enemy.y, structure.x, structure.y) <= reveal ** 2) return true;
  }

  for (const unit of game?.state?.entities?.units || []) {
    if (!isActivePlayerUnit(unit)) continue;
    const role = getUnitRole(unit);
    let range = reveal;
    if (role === 'scout') range = Math.max(range, Number(getUnitConfig(role).detectionRange) || 0);
    if (role === 'spotter') range = Math.max(range, Number(getUnitConfig(role).spotting?.range) || 0);
    if (squaredDistance(enemy.x, enemy.y, unit.x, unit.y) <= range ** 2) return true;
  }
  return false;
}

export function cacheGuardTargetingMode(guard) {
  // Current guards are Ravager/Runner/Brute, but derive this from canonical
  // traits so a future genuinely ranged guard can opt into air attacks explicitly.
  return hasEnemyTrait(guard, 'ranged') ? TARGETING_MODES.ANY : TARGETING_MODES.GROUND;
}

export function canCacheGuardTargetUnit(game, guard, unit) {
  return canEnemyTargetUnit(game, guard, unit, { targeting: cacheGuardTargetingMode(guard) });
}

export function canUnitActivateCache(unit) {
  return isActivePlayerUnit(unit);
}

export function canUnitCaptureCache(unit) {
  if (!isActivePlayerUnit(unit) || isFlyingUnit(unit)) return false;
  const role = getUnitRole(unit);
  if (!role) return false;
  // Spotter's canonical stealth trait is the reason it remains untargetable to
  // ordinary enemies. Capture eligibility is deliberately separate: stealth
  // scouts may observe/activate a cache but cannot capture it alone.
  return !getUnitConfig(role).traits.includes('stealth');
}
