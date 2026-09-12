import { getEnemyConfig } from '../enemies/enemyConfig.js';
import { squaredDistance } from '../utils/math.js';
import { canAttackTarget } from './targeting.js';
import { isInAttackRange } from './range.js';
import { getEffectiveTowerStats } from './towerStats.js';

function visibilityPredicate(game) {
  const tower = game?.services?.towerCombat?.isEnemyVisible;
  if (typeof tower === 'function') return (target, attacker) => tower(target, attacker, game);
  const player = game?.services?.playerCombat?.isEnemyVisible;
  if (typeof player === 'function') return (target, attacker) => player(target, attacker, game);
  const fog = game?.services?.fog?.isVisible;
  if (typeof fog === 'function') return (target, attacker) => fog(target.x, target.y, target, attacker, game);
  return null;
}

function isEnemyRevealed(game, target, attacker) {
  if (!target?.cloaked) return true;
  const tower = game?.services?.towerCombat?.isEnemyRevealed;
  if (typeof tower === 'function' && tower(target, attacker, game)) return true;
  const player = game?.services?.playerCombat?.isEnemyRevealed;
  if (typeof player === 'function' && player(target, attacker, game)) return true;
  const revealRange = Number(getEnemyConfig(target.type).stealth?.revealRange) || 0;
  return revealRange > 0 && squaredDistance(target.x, target.y, attacker.x, attacker.y) <= revealRange * revealRange;
}

export function canTowerAffectEnemy(game, tower, enemy, options = {}) {
  const isVisible = options.requireVisible === false ? null : visibilityPredicate(game);
  return canAttackTarget(game, tower, enemy, {
    targeting: options.targeting,
    isRevealed: isEnemyRevealed,
    allowBurrowedTarget: options.allowBurrowedTarget === true,
    allowCloakedTarget: options.allowCloakedTarget === true,
    ...(isVisible ? { isVisible } : {}),
  }) && (!options.predicate || options.predicate(enemy));
}

export function findTowerTarget(game, tower, options = {}) {
  if (!tower) return null;
  const stats = options.stats || (tower?.type ? getEffectiveTowerStats(tower) : null);
  const range = Number(options.range ?? stats?.range);
  const minRange = Math.max(0, Number(options.minRange ?? stats?.minRange) || 0);
  if (!Number.isFinite(range) || range < 0) return null;
  let best = null;
  let bestDistance = Infinity;
  for (const enemy of game?.state?.entities?.enemies || []) {
    if (!canTowerAffectEnemy(game, tower, enemy, {
      targeting: options.targeting ?? stats?.targeting,
      predicate: options.predicate,
      requireVisible: options.requireVisible,
      allowBurrowedTarget: options.allowBurrowedTarget,
      allowCloakedTarget: options.allowCloakedTarget,
    })) continue;
    if (!isInAttackRange(game, tower, enemy, range, {
      minRange,
      inclusive: options.inclusiveMax === true,
      minInclusive: options.minInclusive !== false,
    })) continue;
    const distance = squaredDistance(tower.x, tower.y, enemy.x, enemy.y);
    const replace = options.replaceOnEqual === true ? distance <= bestDistance : distance < bestDistance;
    if (replace) {
      best = enemy;
      bestDistance = distance;
    }
  }
  return best;
}

export function findTowerTargets(game, tower, options = {}) {
  if (!tower) return [];
  const stats = options.stats || (tower?.type ? getEffectiveTowerStats(tower) : null);
  const count = Math.max(0, Math.floor(Number(options.count) || 0));
  const range = Number(options.range ?? stats?.range);
  const minRange = Math.max(0, Number(options.minRange ?? stats?.minRange) || 0);
  if (!count || !Number.isFinite(range) || range < 0) return [];
  const matches = [];
  for (const enemy of game?.state?.entities?.enemies || []) {
    if (!canTowerAffectEnemy(game, tower, enemy, {
      targeting: options.targeting ?? stats?.targeting,
      predicate: options.predicate,
      requireVisible: options.requireVisible,
      allowBurrowedTarget: options.allowBurrowedTarget,
      allowCloakedTarget: options.allowCloakedTarget,
    })) continue;
    if (!isInAttackRange(game, tower, enemy, range, {
      minRange,
      inclusive: options.inclusiveMax !== false,
      minInclusive: options.minInclusive !== false,
    })) continue;
    matches.push({ enemy, distance: squaredDistance(tower.x, tower.y, enemy.x, enemy.y) });
  }
  matches.sort((a, b) => a.distance - b.distance);
  return matches.slice(0, count).map(entry => entry.enemy);
}
