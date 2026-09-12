import { getEnemyConfig } from '../enemies/enemyConfig.js';
import { applyDamage, isAlive } from './damage.js';

function currentMarkMultiplier(target) {
  return (Number(target?.markTime) || 0) > 0 ? Math.max(1, Number(target?.markMult) || 1) : 1;
}

export function getPlayerDamageMultiplier(target) {
  if (!target) return 1;
  let multiplier = currentMarkMultiplier(target);
  if (target.type === 'climber' && target.climbing) {
    multiplier *= Number(getEnemyConfig('climber').climb?.vulnerabilityMultiplier) || 1;
  }
  if (target.burrowed) multiplier *= 0.2;
  return multiplier;
}

export function applyPlayerEnemyDamage(game, target, amount, context = {}) {
  const baseAmount = Number(amount);
  if (!Number.isFinite(baseAmount) || baseAmount <= 0) {
    return applyDamage(game, target, amount, context);
  }
  const multiplier = getPlayerDamageMultiplier(target);
  const lifecycle = context.onDestroyed ?? game?.services?.playerCombat?.onEnemyDestroyed;
  const result = applyDamage(game, target, baseAmount * multiplier, {
    ...context,
    onDestroyed: lifecycle,
  });
  return { ...result, baseAmount, multiplier };
}

export function markEnemy(target, multiplier, duration) {
  if (!isAlive(target)) return false;
  const markMultiplier = Number(multiplier);
  const markDuration = Number(duration);
  if (!Number.isFinite(markMultiplier) || markMultiplier < 1 || !Number.isFinite(markDuration) || markDuration <= 0) return false;
  target.markMult = Math.max(Number(target.markMult) || 1, markMultiplier);
  target.markTime = Math.max(Number(target.markTime) || 0, markDuration);
  return true;
}

export function tickEnemyMarks(game, dt) {
  const step = Math.max(0, Number(dt) || 0);
  for (const enemy of game?.state?.entities?.enemies || []) {
    const time = Number(enemy.markTime) || 0;
    if (time <= 0) continue;
    enemy.markTime = Math.max(0, time - step);
    if (enemy.markTime <= 0) enemy.markMult = 1;
  }
}
