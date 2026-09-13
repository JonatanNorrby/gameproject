import { getTowerConfig } from '../towers/towerConfig.js';
import { applyPlayerEnemyDamage, markEnemy } from './playerDamage.js';
import { isAlive } from './damage.js';

export { markEnemy } from './playerDamage.js';

export function applyBurn(target, duration) {
  if (!isAlive(target)) return false;
  const time = Number(duration);
  if (!Number.isFinite(time) || time <= 0) return false;
  target.burn = Math.max(Number(target.burn) || 0, time);
  const existing = Number.isFinite(Number(target.burnTick)) ? Number(target.burnTick) : 0;
  target.burnTick = Math.min(existing, 0.01);
  return true;
}

export function applySlow(target, factor, duration) {
  if (!isAlive(target)) return false;
  const slow = Number(factor), time = Number(duration);
  if (!Number.isFinite(slow) || slow <= 0 || !Number.isFinite(time) || time <= 0) return false;
  target.slowFactor = Math.min(Number(target.slowFactor ?? 1), slow);
  target.slowTime = Math.max(Number(target.slowTime) || 0, time);
  return true;
}

export function applyCorrosion(target, duration) {
  if (!isAlive(target)) return false;
  const time = Number(duration);
  if (!Number.isFinite(time) || time <= 0) return false;
  target.acidTime = Math.max(Number(target.acidTime) || 0, time);
  return true;
}

export function effectiveEnemySpeed(enemy) {
  const slow = (Number(enemy?.slowTime) || 0) > 0 ? (Number(enemy.slowFactor) || 1) : 1;
  return Math.max(0, Number(enemy?.speed) || 0) * slow;
}

function tickMark(enemy, step) {
  const time = Number(enemy.markTime) || 0;
  if (time <= 0) return;
  enemy.markTime = Math.max(0, time - step);
  if (enemy.markTime <= 0) enemy.markMult = 1;
}

function tickBurn(game, enemy, step) {
  if ((Number(enemy.burn) || 0) <= 0 || !isAlive(enemy)) return;
  enemy.burn = Math.max(0, Number(enemy.burn) - step);
  enemy.burnTick = (Number(enemy.burnTick) || 0) - step;
  if (enemy.burnTick > 0) return;
  const flame = getTowerConfig('flame').burn;
  const modifier = Number(game?.state?.modifiers?.flameDamage ?? game?.state?.mods?.flameDamage) || 1;
  applyPlayerEnemyDamage(game, enemy, flame.tickDamage * modifier, { attackKind: 'burn' });
  enemy.burnTick = flame.tickInterval;
}

function tickSlow(enemy, step) {
  if ((Number(enemy.slowTime) || 0) > 0) enemy.slowTime = Math.max(0, Number(enemy.slowTime) - step);
  else enemy.slowFactor = 1;
}

export function updateStatusEffects(game, dt, { tickMarks = true } = {}) {
  const step = Math.max(0, Number(dt) || 0);
  let enemiesUpdated = 0, structuresUpdated = 0;
  for (const structure of game?.state?.entities?.structures || []) {
    const acid = Number(structure.acidTime) || 0;
    if (acid <= 0) continue;
    structure.acidTime = Math.max(0, acid - step);
    structuresUpdated++;
  }
  for (const enemy of game?.state?.entities?.enemies || []) {
    if (!isAlive(enemy)) continue;
    if (tickMarks) tickMark(enemy, step);
    tickBurn(game, enemy, step);
    if (!isAlive(enemy)) { enemiesUpdated++; continue; }
    tickSlow(enemy, step);
    enemiesUpdated++;
  }
  return { enemiesUpdated, structuresUpdated };
}
