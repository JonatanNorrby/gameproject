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
  if (!Number.isFinite(baseAmount) || baseAmount <= 0) return applyDamage(game, target, amount, context);
  const multiplier = getPlayerDamageMultiplier(target);
  const lifecycle = context.onDestroyed ?? game?.services?.playerCombat?.onEnemyDestroyed;
  const result = applyDamage(game, target, baseAmount * multiplier, {
    ...context,
    onDestroyed: lifecycle,
  });
  return { ...result, baseAmount, multiplier };
}

// Application remains callable from Prompt-7 weapons. Expiry/ticking moved to
// statusEffects.js; this helper does not own any per-frame update.
export function markEnemy(target, multiplier, duration) {
  if (!isAlive(target)) return false;
  const mult = Number(multiplier), time = Number(duration);
  if (!Number.isFinite(mult) || mult < 1 || !Number.isFinite(time) || time <= 0) return false;
  target.markMult = Math.max(Number(target.markMult) || 1, mult);
  target.markTime = Math.max(Number(target.markTime) || 0, time);
  return true;
}

// Compatibility entry point for Prompt-7's existing call site. Status timing is
// advanced exactly once by updateStatusEffects(), so this intentionally does nothing.
export function tickEnemyMarks() { return 0; }
