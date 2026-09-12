import { getEnemyConfig } from '../enemies/enemyConfig.js';
import { canAttackTarget, TARGETING_MODES } from './targeting.js';
import { isInAttackRange } from './range.js';
import { squaredDistance } from '../utils/math.js';

function isEnemyRevealed(game, target, attacker) {
  if (!target?.cloaked) return true;
  const external = game?.services?.playerCombat?.isEnemyRevealed;
  if (typeof external === 'function' && external(target, attacker, game)) return true;
  const revealRange = Number(getEnemyConfig(target.type).stealth?.revealRange) || 0;
  return revealRange > 0 && squaredDistance(target.x, target.y, attacker.x, attacker.y) <= revealRange * revealRange;
}

function visibilityPredicate(game) {
  const direct = game?.services?.playerCombat?.isEnemyVisible;
  if (typeof direct === 'function') return (target, attacker) => direct(target, attacker, game);
  const fog = game?.services?.fog?.isVisible;
  if (typeof fog === 'function') return (target, attacker) => fog(target.x, target.y, target, attacker, game);
  return null;
}

function eligible(game, unit, enemy, options) {
  const isVisible = options.requireVisible === false ? null : visibilityPredicate(game);
  return canAttackTarget(game, unit, enemy, {
    targeting: options.targeting,
    isRevealed: isEnemyRevealed,
    ...(isVisible ? { isVisible } : {}),
  }) && (!options.predicate || options.predicate(enemy));
}

export function findBestEnemyTarget(game, unit, options = {}) {
  const range = Number(options.range);
  if (!Number.isFinite(range) || range < 0 || !unit) return null;
  const minRange = Math.max(0, Number(options.minRange) || 0);
  let best = null;
  let bestDistance = Infinity;
  for (const enemy of game?.state?.entities?.enemies || []) {
    if (!eligible(game, unit, enemy, options)) continue;
    if (!isInAttackRange(game, unit, enemy, range, {
      minRange,
      inclusive: options.inclusiveMax === true,
      minInclusive: options.minInclusive !== false,
    })) continue;
    const d2 = squaredDistance(unit.x, unit.y, enemy.x, enemy.y);
    if (d2 < bestDistance) {
      best = enemy;
      bestDistance = d2;
    }
  }
  return best;
}

export function findNearestEnemyTargets(game, unit, options = {}) {
  const count = Math.max(0, Math.floor(Number(options.count) || 0));
  const range = Number(options.range);
  if (!count || !Number.isFinite(range) || range < 0 || !unit) return [];
  const minRange = Math.max(0, Number(options.minRange) || 0);
  const matches = [];
  for (const enemy of game?.state?.entities?.enemies || []) {
    if (!eligible(game, unit, enemy, options)) continue;
    if (!isInAttackRange(game, unit, enemy, range, {
      minRange,
      inclusive: options.inclusiveMax !== false,
      minInclusive: options.minInclusive !== false,
    })) continue;
    matches.push({ enemy, d2: squaredDistance(unit.x, unit.y, enemy.x, enemy.y) });
  }
  matches.sort((a, b) => a.d2 - b.d2);
  return matches.slice(0, count).map(entry => entry.enemy);
}

export function canPlayerUnitAffectEnemy(game, unit, enemy, {
  targeting = TARGETING_MODES.ANY,
  requireVisible = false,
} = {}) {
  return eligible(game, unit, enemy, { targeting, requireVisible });
}
