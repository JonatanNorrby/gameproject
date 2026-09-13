import { getEnemyConfig } from '../enemies/enemyConfig.js';
import { applyDamage } from './damage.js';

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
