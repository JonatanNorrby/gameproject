import { isAlive } from '../combat/damage.js';
import { effectiveEnemySpeed } from '../combat/statusEffects.js';
import { isSaboteurDetected } from './enemyTargeting.js';

// Status durations/damage are advanced once by combat/statusEffects.js. This
// enemy-specific hook now owns only the Saboteur's detection-driven cloak state.
export function tickEnemyStatuses(game, enemy) {
  if (!enemy || !isAlive(enemy)) return false;
  if (enemy.type === 'saboteur') enemy.cloaked = !isSaboteurDetected(game, enemy);
  return isAlive(enemy);
}

export { effectiveEnemySpeed } from '../combat/statusEffects.js';
