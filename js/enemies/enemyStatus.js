import { getTowerConfig } from '../towers/towerConfig.js';
import { applyPlayerEnemyDamage } from '../combat/playerDamage.js';
import { isAlive } from '../combat/damage.js';
import { isSaboteurDetected } from './enemyTargeting.js';

export function tickStructureCorrosion(game, dt) {
  const step = Math.max(0, Number(dt) || 0);
  for (const structure of game?.state?.entities?.structures || []) {
    const acid = Number(structure.acidTime) || 0;
    if (acid > 0) structure.acidTime = Math.max(0, acid - step);
  }
}

export function tickEnemyStatuses(game, enemy, dt) {
  if (!enemy || !isAlive(enemy)) return false;
  const step = Math.max(0, Number(dt) || 0);
  const flame = getTowerConfig('flame').burn;

  if ((Number(enemy.burn) || 0) > 0) {
    enemy.burn = Math.max(0, Number(enemy.burn) - step);
    enemy.burnTick = (Number(enemy.burnTick) || 0) - step;
    if (enemy.burnTick <= 0) {
      const modifier = Number(game?.state?.modifiers?.flameDamage ?? game?.state?.mods?.flameDamage) || 1;
      applyPlayerEnemyDamage(game, enemy, flame.tickDamage * modifier, { attackKind: 'burn' });
      enemy.burnTick = flame.tickInterval;
      if (!isAlive(enemy)) return false;
    }
  }

  if ((Number(enemy.slowTime) || 0) > 0) enemy.slowTime = Math.max(0, Number(enemy.slowTime) - step);
  else enemy.slowFactor = 1;

  if (enemy.type === 'saboteur') enemy.cloaked = !isSaboteurDetected(game, enemy);
  return isAlive(enemy);
}

export function effectiveEnemySpeed(enemy) {
  const slow = (Number(enemy?.slowTime) || 0) > 0 ? (Number(enemy.slowFactor) || 1) : 1;
  return Math.max(0, Number(enemy?.speed) || 0) * slow;
}
