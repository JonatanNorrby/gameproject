import { getEnemyConfig } from './enemyConfig.js';
import {
  applyEnemyMeleeDamage,
  canEnemyMeleeTarget,
  fireSpitter,
  targetWithinDistance,
} from './enemyCombat.js';
import {
  findOrdinaryEnemyTarget,
  findStrategicEnemyTarget,
  getEnemyLureTarget,
} from './enemyTargeting.js';
import { movementSpeedAt, stepDirectTerrainOnly } from './enemyMovement.js';
import { SPECIAL_ENEMY_HANDLERS, moveOrAttackBlockingWall } from './specialEnemies.js';

function basePoint(game) {
  return { x: game.state.base.x, y: game.state.base.y };
}

function normalAggroRange(game) {
  return Number(game?.config?.towerDurability?.enemyMeleeAggroRange) || 105;
}

function updateBasicMelee(game, enemy, dt, lure) {
  const localTarget = lure || findOrdinaryEnemyTarget(game, enemy, normalAggroRange(game), {
    includeProtected: false,
    targeting: 'ground',
  });
  if (localTarget && canEnemyMeleeTarget(game, enemy, localTarget)) {
    applyEnemyMeleeDamage(game, enemy, localTarget, dt);
    return { attacked: true, lure };
  }
  // Final v24 behavior uses nearby targets only as an attack opportunity. If a
  // target is inside aggro but still outside melee reach, ordinary enemies keep
  // advancing toward the Landing Pad lure or Main Base rather than chasing it.
  const destination = lure || basePoint(game);
  const speed = movementSpeedAt(game, enemy, enemy.effectiveSpeed);
  moveOrAttackBlockingWall(game, enemy, destination.x, destination.y, speed, dt);
  return { attacked: false, lure };
}

function updateSpitter(game, enemy, dt, lure) {
  const config = getEnemyConfig('spitter');
  const attack = config.rangedAttack;
  const target = lure || findOrdinaryEnemyTarget(game, enemy, attack.range, {
    includeProtected: true,
    targeting: 'any',
  });
  enemy.rangeCooldown = (Number(enemy.rangeCooldown) || 0) - dt;
  if (target && targetWithinDistance(game, enemy, target, attack.range)) {
    if (enemy.rangeCooldown <= 0) {
      fireSpitter(game, enemy, target);
      enemy.rangeCooldown = attack.fireInterval;
    }
    return { attacked: true, lure };
  }
  const destination = lure || basePoint(game);
  const speed = movementSpeedAt(game, enemy, enemy.effectiveSpeed * 0.78);
  moveOrAttackBlockingWall(game, enemy, destination.x, destination.y, speed, dt);
  return { attacked: false, lure };
}

function updateFlyer(game, enemy, dt, lure) {
  if (lure && canEnemyMeleeTarget(game, enemy, lure)) {
    applyEnemyMeleeDamage(game, enemy, lure, dt);
    return { attacked: true, lure };
  }
  const destination = lure || basePoint(game);
  // Current final v24 behavior is direct (no ground A*) and ignores Walls and
  // structures, while still consulting terrain through moveDirectIgnoringWalls.
  stepDirectTerrainOnly(game, enemy, destination.x, destination.y, enemy.effectiveSpeed, dt);
  return { attacked: false, lure };
}

function updateSpecial(game, enemy, dt, lure) {
  let strategicTarget = lure;
  if (!strategicTarget) strategicTarget = findStrategicEnemyTarget(game, enemy);
  let attackTarget = strategicTarget;

  // Climber/Crusher retain current local aggro when they have no strategic target,
  // but that nearby unit is only an attack opportunity; it does not replace the
  // Base as their movement destination unless already in melee reach.
  if (!attackTarget && (enemy.type === 'climber' || enemy.type === 'crusher')) {
    attackTarget = findOrdinaryEnemyTarget(game, enemy, normalAggroRange(game), {
      includeProtected: false,
      targeting: 'ground',
    });
  }

  const destination = strategicTarget
    ? (strategicTarget.type === 'wall'
      ? (() => {
          const dx = strategicTarget.x2 - strategicTarget.x1, dy = strategicTarget.y2 - strategicTarget.y1;
          const vv = dx * dx + dy * dy || 1;
          const t = Math.max(0, Math.min(1, ((enemy.x - strategicTarget.x1) * dx + (enemy.y - strategicTarget.y1) * dy) / vv));
          return { x: strategicTarget.x1 + dx * t, y: strategicTarget.y1 + dy * t };
        })()
      : { x: strategicTarget.x, y: strategicTarget.y })
    : basePoint(game);

  const speed = movementSpeedAt(game, enemy, enemy.effectiveSpeed);
  const handler = SPECIAL_ENEMY_HANDLERS[enemy.type];
  const attacked = handler?.(game, enemy, {
    target: attackTarget,
    strategicTarget,
    tx: destination.x,
    ty: destination.y,
    speed,
    dt,
    lure,
  }) === true;
  return { attacked, lure };
}

export const ENEMY_AI_HANDLERS = Object.freeze({
  ravager: updateBasicMelee,
  swarm: updateBasicMelee,
  runner: updateBasicMelee,
  brute: updateBasicMelee,
  spitter: updateSpitter,
  flyer: updateFlyer,
  siegebeast: updateSpecial,
  burrower: updateSpecial,
  climber: updateSpecial,
  acidlobber: updateSpecial,
  crusher: updateSpecial,
  harvesterhunter: updateSpecial,
  saboteur: updateSpecial,
});

export function assertEnemyAiCoverage(config) {
  const missing = Object.keys(config || {}).filter(type => typeof ENEMY_AI_HANDLERS[type] !== 'function');
  if (missing.length) throw new Error(`Missing enemy AI handlers: ${missing.join(', ')}`);
  return true;
}

export function updateEnemyActor(game, enemy, dt) {
  const handler = ENEMY_AI_HANDLERS[enemy?.type];
  if (!handler) return { attacked: false, lure: null };
  const lure = getEnemyLureTarget(game, enemy);
  return handler(game, enemy, dt, lure);
}
