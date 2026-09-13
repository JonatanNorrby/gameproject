import { applyDamage, isAlive } from '../combat/damage.js';
import { isInAttackRange, RANGE_MODES } from '../combat/range.js';
import { TARGETING_MODES } from '../combat/targeting.js';
import { emitEnemyProjectile as emitSharedEnemyProjectile } from '../combat/projectiles.js';
import { applyCorrosion } from '../combat/statusEffects.js';
import { applyBaseDamage } from '../combat/lifecycle.js';
import { getEnemyConfig } from './enemyConfig.js';
import { canEnemyTargetStructure, canEnemyTargetUnit, targetDistance } from './enemyTargeting.js';

export function enemyMeleeRange(game) {
  return Number(game?.config?.towerDurability?.enemyMeleeAttackRange) || 20;
}

export function enemyMeleeDamageMultiplier(game) {
  return Number(game?.config?.towerDurability?.enemyMeleeDamageMultiplier) || 1;
}

export function canEnemyMeleeTarget(game, enemy, target) {
  if (!enemy || !target || !isAlive(enemy)) return false;
  const unit = (game?.state?.entities?.units || []).includes(target);
  const valid = unit
    ? canEnemyTargetUnit(game, enemy, target, { targeting: TARGETING_MODES.GROUND })
    : canEnemyTargetStructure(game, enemy, target);
  if (!valid) return false;
  return isInAttackRange(game, enemy, target, enemyMeleeRange(game), { mode: RANGE_MODES.FOOTPRINT });
}

export function applyEnemyDamage(game, enemy, target, amount, context = {}) {
  const value = Number(amount);
  if (!target || !Number.isFinite(value) || value <= 0) return { applied: false, destroyed: false };
  const isStructure = (game?.state?.entities?.structures || []).includes(target);
  const corrosionMultiplier = isStructure && (Number(target.acidTime) || 0) > 0
    ? Number(getEnemyConfig('acidlobber').acidAttack?.armorDamageMultiplier) || 1.4
    : 1;
  const effectiveAmount = value * corrosionMultiplier;
  const external = game?.services?.enemyCombat?.damageTarget;
  if (typeof external === 'function') {
    const result = external(target, effectiveAmount, { game, enemy, corrosionMultiplier, ...context });
    if (result !== undefined) return result;
  }
  return applyDamage(game, target, effectiveAmount, {
    source: enemy,
    attackKind: context.attackKind || enemy?.type,
    onDestroyed: context.onDestroyed ?? game?.services?.enemyCombat?.onTargetDestroyed,
  });
}

export function applyEnemyMeleeDamage(game, enemy, target, dt, multiplier = 1) {
  if (!canEnemyMeleeTarget(game, enemy, target)) return { applied: false, destroyed: false };
  const amount = (Number(enemy.damage) || 0)
    * enemyMeleeDamageMultiplier(game)
    * Math.max(0, Number(dt) || 0)
    * Math.max(0, Number(multiplier) || 0);
  return applyEnemyDamage(game, enemy, target, amount, { attackKind: 'melee' });
}

export function emitEnemyProjectile(game, enemy, target, { damage, speed, life = 3, type = 'enemy' } = {}) {
  if (!enemy || !target || !Number.isFinite(enemy.x) || !Number.isFinite(target.x)) return null;
  const dx = target.x - enemy.x, dy = target.y - enemy.y;
  const distance = Math.hypot(dx, dy) || 1;
  const projectile = {
    x: enemy.x, y: enemy.y,
    vx: dx / distance * (Number(speed) || 0),
    vy: dy / distance * (Number(speed) || 0),
    dmg: Number(damage) || 0,
    life: Number(life) || 3,
    target,
    type,
    sourceId: enemy.id ?? null,
  };
  const adapter = game?.services?.enemyCombat?.fireProjectile;
  if (typeof adapter === 'function') {
    const result = adapter(game, projectile, { enemy, target });
    if (result !== undefined) return result;
  }
  return emitSharedEnemyProjectile(game, projectile);
}

export function fireSpitter(game, enemy, target) {
  const attack = getEnemyConfig('spitter').rangedAttack;
  return emitEnemyProjectile(game, enemy, target, {
    damage: attack.damage,
    speed: attack.projectileSpeed,
    life: 3,
    type: 'spitter',
  });
}

export function applyAcidAttack(game, enemy, target) {
  const attack = getEnemyConfig('acidlobber').acidAttack;
  const result = applyEnemyDamage(game, enemy, target, attack.damage, { attackKind: 'acid' });
  if ((game?.state?.entities?.structures || []).includes(target) && Number(target.hp) > 0) {
    applyCorrosion(target, attack.acidDuration);
  }
  return result;
}

export function targetWithinDistance(game, enemy, target, distance) {
  return !!target && targetDistance(game, enemy, target) <= Number(distance);
}

export function damageBaseAndConsumeEnemy(game, enemy) {
  const base = game?.state?.base;
  const enemies = game?.state?.entities?.enemies;
  if (!base || !Array.isArray(enemies) || !enemy) return false;
  const distance = Math.hypot(enemy.x - base.x, enemy.y - base.y);
  if (distance >= base.radius + (Number(enemy.r) || getEnemyConfig(enemy.type).radius)) return false;
  const index = enemies.indexOf(enemy);
  if (index >= 0) enemies.splice(index, 1);
  enemy.removedWithoutReward = true;
  applyBaseDamage(game, Number(enemy.damage) || 0, { source: enemy, attackKind: 'base-impact' });
  return true;
}
