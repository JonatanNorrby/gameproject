import { getEnemyConfig } from './enemyConfig.js';
import { canEnemyMeleeTarget, applyEnemyMeleeDamage, applyEnemyDamage, applyAcidAttack, targetWithinDistance } from './enemyCombat.js';
import {
  approachBlockingWall,
  enemyRadius,
  findBlockingWall,
  navigateGroundEnemy,
  nearestPointOnWall,
  stepDirectTerrainOnly,
  wallThickness,
} from './enemyMovement.js';
import { findNearestOpenDestination } from '../navigation/pathfinding.js';

function emitEffect(game, effect) {
  const adapter = game?.services?.enemyAI?.emitEffect;
  if (typeof adapter === 'function') adapter(game, effect);
  else if (Array.isArray(game?.state?.entities?.effects)) game.state.entities.effects.push(effect);
}

export function moveOrAttackBlockingWall(game, enemy, tx, ty, speed, dt, wallDamageMultiplier = 1) {
  const beforeX = enemy.x, beforeY = enemy.y;
  const wall = navigateGroundEnemy(game, enemy, tx, ty, speed, dt);
  if (!wall) return { moved: enemy.x !== beforeX || enemy.y !== beforeY, attacked: false, wall: null };
  if (canEnemyMeleeTarget(game, enemy, wall)) {
    applyEnemyMeleeDamage(game, enemy, wall, dt, wallDamageMultiplier);
    return { moved: false, attacked: true, wall };
  }
  const reach = (Number(game?.config?.towerDurability?.enemyMeleeAttackRange) || 20)
    + enemyRadius(enemy) + wallThickness(game, wall) / 2;
  const moved = approachBlockingWall(game, enemy, wall, speed, dt, reach);
  return { moved, attacked: false, wall };
}

export function updateSiegeBeast(game, enemy, context) {
  const { target, tx, ty, speed, dt } = context;
  const multiplier = Number(getEnemyConfig('siegebeast').wallDamageMultiplier) || 2.2;
  if (target && canEnemyMeleeTarget(game, enemy, target)) {
    applyEnemyMeleeDamage(game, enemy, target, dt, multiplier);
    return true;
  }
  moveOrAttackBlockingWall(game, enemy, target ? tx : game.state.base.x, target ? ty : game.state.base.y, speed, dt, multiplier);
  return false;
}

export function updateBurrower(game, enemy, context) {
  const { target, tx, ty, speed, dt } = context;
  const config = getEnemyConfig('burrower').burrow;
  enemy.burrowCooldown = Math.max(0, (Number(enemy.burrowCooldown) || 0) - dt);

  if (enemy.burrowed) {
    enemy.burrowTimer = (Number(enemy.burrowTimer) || 0) - dt;
    if (enemy.burrowTimer <= 0 && enemy.burrowExit) {
      enemy.x = enemy.burrowExit.x;
      enemy.y = enemy.burrowExit.y;
      enemy.burrowed = false;
      enemy.burrowCooldown = config.cooldown;
      emitEffect(game, { kind: 'emerge', x: enemy.x, y: enemy.y, durationMs: 260, legacyChannel: 'v24Effects' });
    }
    return false;
  }

  // Current v24 Burrower only explicitly melee-attacks its Landing Pad lure;
  // otherwise local units/structures are not substituted into `target`.
  if (target && canEnemyMeleeTarget(game, enemy, target)) {
    applyEnemyMeleeDamage(game, enemy, target, dt);
    return true;
  }

  const wall = findBlockingWall(game, enemy, tx, ty, config.distance);
  if (wall && enemy.burrowCooldown <= 0) {
    const dx = tx - enemy.x;
    const dy = ty - enemy.y;
    const distance = Math.hypot(dx, dy) || 1;
    const point = nearestPointOnWall(enemy, wall);
    const push = wallThickness(game, wall) / 2 + enemyRadius(enemy) + 48;
    const world = game.config.world;
    const rawX = Math.max(enemy.r, Math.min(world.width - enemy.r, point.x + dx / distance * push));
    const rawY = Math.max(enemy.r, Math.min(world.height - enemy.r, point.y + dy / distance * push));
    // The old v24 check only considered shaped terrain, so a Burrower could emerge
    // inside the Base, a depot, a building, or another Wall. Repair the intended
    // exit with the same full blocker used by Step 2 navigation, but never extend
    // the actual burrow beyond its configured maximum distance.
    const exit = findNearestOpenDestination(game, rawX, rawY, enemyRadius(enemy) + 2);
    if (exit && Math.hypot(exit.x - enemy.x, exit.y - enemy.y) <= config.distance) {
      enemy.burrowed = true;
      enemy.burrowTimer = config.time;
      enemy.burrowExit = exit;
      emitEffect(game, { kind: 'burrow', x: enemy.x, y: enemy.y, durationMs: 320, legacyChannel: 'v24Effects' });
      return false;
    }
  }

  moveOrAttackBlockingWall(game, enemy, tx, ty, speed, dt);
  return false;
}

export function updateClimber(game, enemy, context) {
  const { target, tx, ty, speed, dt } = context;
  if (target && canEnemyMeleeTarget(game, enemy, target)) {
    applyEnemyMeleeDamage(game, enemy, target, dt);
    return true;
  }
  const config = getEnemyConfig('climber').climb;
  const step = speed * dt;
  const wall = findBlockingWall(game, enemy, tx, ty, step + enemyRadius(enemy) + 6);
  if (wall) {
    enemy.climbing = true;
    stepDirectTerrainOnly(game, enemy, tx, ty, speed * config.speedFactor, dt);
    return false;
  }
  enemy.climbing = false;
  moveOrAttackBlockingWall(game, enemy, tx, ty, speed, dt);
  return false;
}

export function updateCrusher(game, enemy, context) {
  const { target, tx, ty, speed, dt } = context;
  const config = getEnemyConfig('crusher').charge;
  enemy.chargeCooldown = Math.max(0, (Number(enemy.chargeCooldown) || 0) - dt);

  if (target && target.type !== 'wall' && canEnemyMeleeTarget(game, enemy, target)) {
    applyEnemyMeleeDamage(game, enemy, target, dt);
    return true;
  }

  if ((Number(enemy.chargeWindup) || 0) > 0) {
    enemy.chargeWindup = Math.max(0, enemy.chargeWindup - dt);
    if (enemy.chargeWindup <= 0) enemy.charging = true;
    return false;
  }

  if (enemy.charging) {
    const wall = (game.state.entities.structures || []).find(structure => (
      structure.id === enemy.chargeWallId && structure.type === 'wall' && structure.built !== false && Number(structure.hp) > 0
    ));
    if (!wall) {
      enemy.charging = false;
      enemy.chargeCooldown = config.cooldown;
      return false;
    }
    const point = nearestPointOnWall(enemy, wall);
    const distance = Math.hypot(enemy.x - point.x, enemy.y - point.y);
    if (distance <= enemyRadius(enemy) + wallThickness(game, wall) / 2 + 7) {
      applyEnemyDamage(game, enemy, wall, config.damage, { attackKind: 'crusher-charge' });
      enemy.charging = false;
      enemy.chargeCooldown = config.cooldown;
      emitEffect(game, { kind: 'impact', x: point.x, y: point.y, r: 46, durationMs: 250, legacyChannel: 'v24Effects' });
      return false;
    }
    stepDirectTerrainOnly(game, enemy, point.x, point.y, speed * config.speedMultiplier, dt);
    return false;
  }

  const wall = findBlockingWall(game, enemy, tx, ty, config.scanRange);
  if (wall && enemy.chargeCooldown <= 0) {
    enemy.chargeWallId = wall.id;
    enemy.chargeWindup = config.windup;
    emitEffect(game, { kind: 'charge', x: enemy.x, y: enemy.y, durationMs: config.windup * 1000, legacyChannel: 'v24Effects' });
    return false;
  }

  moveOrAttackBlockingWall(game, enemy, tx, ty, speed, dt);
  return false;
}

export function updateAcidLobber(game, enemy, context) {
  const { target, tx, ty, speed, dt } = context;
  const config = getEnemyConfig('acidlobber').acidAttack;
  if (target && targetWithinDistance(game, enemy, target, config.range)) {
    enemy.specialCooldown = (Number(enemy.specialCooldown) || 0) - dt;
    if (enemy.specialCooldown <= 0) {
      applyAcidAttack(game, enemy, target);
      enemy.specialCooldown = config.fireInterval;
      const x = target.type === 'wall' ? (target.x1 + target.x2) / 2 : target.x;
      const y = target.type === 'wall' ? (target.y1 + target.y2) / 2 : target.y;
      emitEffect(game, { kind: 'acid', x1: enemy.x, y1: enemy.y, x2: x, y2: y, durationMs: 260, legacyChannel: 'v24Effects' });
    }
    return true;
  }
  moveOrAttackBlockingWall(game, enemy, target ? tx : game.state.base.x, target ? ty : game.state.base.y, speed, dt);
  return false;
}

export function updatePriorityMelee(game, enemy, context) {
  const { target, tx, ty, speed, dt } = context;
  if (target && canEnemyMeleeTarget(game, enemy, target)) {
    applyEnemyMeleeDamage(game, enemy, target, dt);
    return true;
  }
  moveOrAttackBlockingWall(game, enemy, target ? tx : game.state.base.x, target ? ty : game.state.base.y, speed, dt);
  return false;
}

export const SPECIAL_ENEMY_HANDLERS = Object.freeze({
  siegebeast: updateSiegeBeast,
  burrower: updateBurrower,
  climber: updateClimber,
  acidlobber: updateAcidLobber,
  crusher: updateCrusher,
  harvesterhunter: updatePriorityMelee,
  saboteur: updatePriorityMelee,
});
