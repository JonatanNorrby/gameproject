import { TOWER_CONFIG } from '../towers/towerConfig.js';
import { isFlyingEnemy, isGroundEnemy } from '../core/entities.js';
import { pointSegmentDistance } from '../utils/geometry.js';
import { squaredDistance, TAU } from '../utils/math.js';
import { tickCooldown, isCooldownReady, resetCooldown } from './cooldowns.js';
import { isAlive } from './damage.js';
import { applyPlayerEnemyDamage } from './playerDamage.js';
import { TARGETING_MODES } from './targeting.js';
import { getEffectiveTowerStats } from './towerStats.js';
import { canTowerAffectEnemy, findTowerTarget, findTowerTargets } from './towerTargeting.js';

function stateModifiers(game) {
  return game?.state?.modifiers || game?.state?.mods || {};
}

function randomValue(game) {
  const random = game?.services?.random;
  return typeof random === 'function' ? random() : Math.random();
}

function nowMs(game) {
  const now = game?.services?.now;
  return typeof now === 'function' ? Number(now()) || 0 : (typeof performance !== 'undefined' ? performance.now() : Date.now());
}

function emitEffect(game, effect) {
  const service = game?.services?.towerCombat?.emitEffect;
  if (typeof service === 'function') return service(game, effect);
  const effects = game?.state?.entities?.effects;
  if (Array.isArray(effects)) effects.push(effect);
  return effect;
}

function emitProjectile(game, tower, target, shot) {
  const jitter = Number(shot.jitter) || 0;
  const angle = Math.atan2(target.y - shot.y, target.x - shot.x) + (randomValue(game) - 0.5) * jitter;
  const speed = Number(shot.speed) || 0;
  const projectile = {
    x: shot.x,
    y: shot.y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    dmg: Number(shot.damage) || 0,
    life: 2.2,
    type: shot.type,
    sourceId: tower.id ?? null,
  };
  const service = game?.services?.towerCombat?.fireProjectile;
  if (typeof service === 'function') service(game, projectile, { tower, target });
  else if (Array.isArray(game?.state?.entities?.projectiles)) game.state.entities.projectiles.push(projectile);
  return projectile;
}

function damageEnemy(game, tower, enemy, amount, attackKind) {
  const lifecycle = game?.services?.towerCombat?.onEnemyDestroyed;
  return applyPlayerEnemyDamage(game, enemy, amount, {
    source: tower,
    attackKind,
    ...(typeof lifecycle === 'function' ? { onDestroyed: lifecycle } : {}),
  });
}

function enemies(game) {
  return game?.state?.entities?.enemies || [];
}

function activeTower(tower) {
  return Boolean(tower?.built && isAlive(tower) && TOWER_CONFIG[tower.type]);
}

function areaEnemies(game, x, y, radius, predicate = () => true) {
  const rr = radius * radius;
  return enemies(game).filter(enemy => isAlive(enemy)
    && predicate(enemy)
    && squaredDistance(enemy.x, enemy.y, x, y) <= rr);
}

function visibleTarget(game, tower, stats, options = {}) {
  return findTowerTarget(game, tower, {
    stats,
    targeting: options.targeting ?? stats.targeting,
    predicate: options.predicate,
    minRange: options.minRange,
    inclusiveMax: options.inclusiveMax,
    minInclusive: options.minInclusive,
    replaceOnEqual: options.replaceOnEqual,
  });
}

function visibleTargets(game, tower, stats, count, options = {}) {
  return findTowerTargets(game, tower, {
    stats,
    count,
    targeting: options.targeting ?? stats.targeting,
    predicate: options.predicate,
    minRange: options.minRange,
    inclusiveMax: options.inclusiveMax,
    minInclusive: options.minInclusive,
  });
}

function updateLaser(game, tower, stats) {
  const target = visibleTarget(game, tower, stats, { inclusiveMax: false });
  if (!target) return 0;
  if ((Number(stats.pierce) || 1) <= 1) {
    emitProjectile(game, tower, target, {
      x: tower.x, y: tower.y, type: 'laser', damage: stats.damage, speed: stats.bulletSpeed, jitter: 0,
    });
  } else {
    const dx = target.x - tower.x, dy = target.y - tower.y, d = Math.hypot(dx, dy) || 1;
    const endX = tower.x + dx / d * stats.range, endY = tower.y + dy / d * stats.range;
    const hits = enemies(game).filter(enemy => {
      if (!isAlive(enemy)) return false;
      const along = ((enemy.x - tower.x) * dx + (enemy.y - tower.y) * dy) / d;
      return along >= 0 && along <= stats.range
        && pointSegmentDistance(enemy.x, enemy.y, tower.x, tower.y, endX, endY) <= (Number(enemy.r) || 0) + 9;
    }).sort((a, b) => squaredDistance(tower.x, tower.y, a.x, a.y) - squaredDistance(tower.x, tower.y, b.x, b.y))
      .slice(0, stats.pierce);
    for (const enemy of hits) damageEnemy(game, tower, enemy, stats.damage, 'laser-prism');
    emitEffect(game, { kind: 'prism', x1: tower.x, y1: tower.y, x2: endX, y2: endY, durationMs: 130, legacyChannel: 'v21Effects' });
  }
  tower.cool = resetCooldown(stats.fireInterval * (Number(stateModifiers(game).laserRate) || 1));
  return 1;
}

function updateFlame(game, tower, stats) {
  const targets = findTowerTargets(game, tower, {
    stats,
    count: stats.targets,
    targeting: TARGETING_MODES.ANY,
    inclusiveMax: true,
    requireVisible: false,
    allowBurrowedTarget: true,
    allowCloakedTarget: true,
  });
  if (!targets.length) return 0;
  const duration = stats.burnDuration * (Number(stateModifiers(game).burnDuration) || 1);
  for (const enemy of targets) {
    enemy.burn = Math.max(Number(enemy.burn) || 0, duration);
    enemy.burnTick = Math.min(Number.isFinite(Number(enemy.burnTick)) ? Number(enemy.burnTick) : 0, 0.01);
  }
  tower.cool = resetCooldown(stats.fireInterval);
  return targets.length;
}

function updateRailgun(game, tower, stats) {
  const target = visibleTarget(game, tower, stats, { inclusiveMax: false });
  if (!target) return 0;
  const dx = target.x - tower.x, dy = target.y - tower.y, d = Math.hypot(dx, dy) || 1;
  const endX = tower.x + dx / d * stats.range, endY = tower.y + dy / d * stats.range;
  const hits = enemies(game).filter(enemy => {
    if (!isAlive(enemy)) return false;
    const along = ((enemy.x - tower.x) * dx + (enemy.y - tower.y) * dy) / d;
    return along >= 0 && along <= stats.range
      && pointSegmentDistance(enemy.x, enemy.y, tower.x, tower.y, endX, endY) <= stats.pierceWidth;
  }).sort((a, b) => squaredDistance(tower.x, tower.y, a.x, a.y) - squaredDistance(tower.x, tower.y, b.x, b.y))
    .slice(0, stats.pierce);
  for (const enemy of hits) damageEnemy(game, tower, enemy, stats.damage, 'railgun');
  emitEffect(game, { kind: 'rail', x1: tower.x, y1: tower.y, x2: endX, y2: endY, durationMs: 125, legacyChannel: 'v17Effects' });
  tower.cool = resetCooldown(stats.fireInterval);
  return hits.length;
}

function nextTeslaTarget(game, point, used, stats) {
  const proxy = { x: point.x, y: point.y, targeting: stats.targeting };
  let best = null, bestDistance = stats.chainRange * stats.chainRange;
  for (const enemy of enemies(game)) {
    if (used.has(enemy)) continue;
    if (!canTowerAffectEnemy(game, proxy, enemy, { targeting: stats.targeting })) continue;
    const distance = squaredDistance(point.x, point.y, enemy.x, enemy.y);
    if (distance < bestDistance) { best = enemy; bestDistance = distance; }
  }
  return best;
}

function updateTesla(game, tower, stats) {
  const first = visibleTarget(game, tower, stats, { inclusiveMax: false });
  if (!first) return 0;
  const used = new Set(), points = [{ x: tower.x, y: tower.y }];
  let current = first, damage = stats.damage, hits = 0;
  for (let i = 0; i < stats.chains && current; i++) {
    used.add(current); points.push({ x: current.x, y: current.y });
    damageEnemy(game, tower, current, damage, 'tesla');
    hits++; damage *= stats.chainDamageMultiplier;
    current = nextTeslaTarget(game, points[points.length - 1], used, stats);
  }
  emitEffect(game, { kind: 'tesla', points, durationMs: 150, legacyChannel: 'v17Effects' });
  tower.cool = resetCooldown(stats.fireInterval);
  return hits;
}

function updateAntiAir(game, tower, stats) {
  const target = visibleTarget(game, tower, stats, {
    targeting: TARGETING_MODES.AIR, inclusiveMax: true, replaceOnEqual: true,
  });
  if (!target) return 0;
  for (let i = 0; i < stats.shots; i++) {
    emitProjectile(game, tower, target, {
      x: tower.x + (i - (stats.shots - 1) / 2) * 5,
      y: tower.y, type: 'antiair', damage: stats.damage, speed: stats.bulletSpeed, jitter: 0.025,
    });
  }
  if (stats.splashRadius > 0) {
    for (const enemy of areaEnemies(game, target.x, target.y, stats.splashRadius, e => e !== target && isFlyingEnemy(e))) {
      damageEnemy(game, tower, enemy, stats.damage * 0.45, 'antiair-flak');
    }
    emitEffect(game, { kind: 'flak', x: target.x, y: target.y, r: stats.splashRadius, durationMs: 150, legacyChannel: 'v22Effects' });
  }
  tower.cool = resetCooldown(stats.fireInterval);
  return stats.shots;
}

function updateCryo(game, tower, stats) {
  const targets = visibleTargets(game, tower, stats, stats.targets, { inclusiveMax: true });
  if (!targets.length) return 0;
  for (const enemy of targets) {
    damageEnemy(game, tower, enemy, stats.damage, 'cryo');
    if (isAlive(enemy)) {
      enemy.slowFactor = Math.min(Number(enemy.slowFactor ?? 1), stats.slowFactor);
      enemy.slowTime = Math.max(Number(enemy.slowTime) || 0, stats.slowDuration);
    }
    emitEffect(game, { kind: 'cryo', x1: tower.x, y1: tower.y, x2: enemy.x, y2: enemy.y, durationMs: 135, legacyChannel: 'v22Effects' });
  }
  tower.cool = resetCooldown(stats.fireInterval);
  return targets.length;
}

function updateMortar(game, tower, stats) {
  const target = visibleTarget(game, tower, stats, {
    targeting: TARGETING_MODES.GROUND,
    minRange: stats.minRange,
    inclusiveMax: true,
    minInclusive: true,
    replaceOnEqual: true,
  });
  if (!target) return 0;
  for (const enemy of areaEnemies(game, target.x, target.y, stats.splashRadius, isGroundEnemy)) {
    damageEnemy(game, tower, enemy, stats.damage, 'mortar');
  }
  emitEffect(game, { kind: 'blast', x: target.x, y: target.y, r: stats.splashRadius, durationMs: 220, legacyChannel: 'v22Effects' });
  if (stats.clusters) {
    for (let i = 0; i < stats.clusters; i++) {
      const angle = i / stats.clusters * TAU + 0.35;
      const offset = stats.splashRadius * 0.62;
      const x = target.x + Math.cos(angle) * offset, y = target.y + Math.sin(angle) * offset;
      const radius = stats.splashRadius * 0.48;
      for (const enemy of areaEnemies(game, x, y, radius, isGroundEnemy)) {
        damageEnemy(game, tower, enemy, stats.damage * 0.42, 'mortar-cluster');
      }
      emitEffect(game, { kind: 'cluster', x, y, r: radius, durationMs: 250, legacyChannel: 'v22Effects' });
    }
  }
  tower.cool = resetCooldown(stats.fireInterval);
  return 1;
}

function updateMinigun(game, tower, stats) {
  const target = visibleTarget(game, tower, stats, { inclusiveMax: true, replaceOnEqual: true });
  if (!target) return 0;
  for (let i = 0; i < stats.barrels; i++) {
    emitProjectile(game, tower, target, {
      x: tower.x + (i ? 5 : -2), y: tower.y, type: 'minigun', damage: stats.damage, speed: stats.bulletSpeed, jitter: 0.035,
    });
  }
  tower.cool = resetCooldown(stats.fireInterval);
  return stats.barrels;
}

function updateMissile(game, tower, stats) {
  const targets = visibleTargets(game, tower, stats, stats.salvo, { inclusiveMax: true });
  if (!targets.length) return 0;
  for (const target of targets) {
    for (const enemy of areaEnemies(game, target.x, target.y, stats.splashRadius)) {
      damageEnemy(game, tower, enemy, stats.damage, 'missile');
    }
    emitEffect(game, { kind: 'missile', x1: tower.x, y1: tower.y, x2: target.x, y2: target.y, r: stats.splashRadius, durationMs: 210, legacyChannel: 'v22Effects' });
  }
  tower.cool = resetCooldown(stats.fireInterval);
  return targets.length;
}

function updateDroneBay(game, tower, stats) {
  let fired = 0;
  const time = nowMs(game);
  for (let i = 0; i < stats.drones; i++) {
    const angle = time / 850 + i / stats.drones * TAU;
    const origin = {
      x: tower.x + Math.cos(angle) * stats.orbitRadius,
      y: tower.y + Math.sin(angle) * stats.orbitRadius,
      targeting: stats.targeting,
    };
    const target = findTowerTarget(game, origin, {
      range: stats.range, targeting: stats.targeting, inclusiveMax: true, replaceOnEqual: true,
    });
    if (!target) continue;
    emitProjectile(game, tower, target, {
      x: origin.x, y: origin.y, type: 'drone', damage: stats.damage, speed: stats.bulletSpeed, jitter: 0.025,
    });
    fired++;
  }
  if (!fired) return 0;
  tower.cool = resetCooldown(stats.fireInterval);
  return fired;
}

const TOWER_HANDLERS = Object.freeze({
  laser: updateLaser,
  flame: updateFlame,
  railgun: updateRailgun,
  tesla: updateTesla,
  antiair: updateAntiAir,
  cryo: updateCryo,
  mortar: updateMortar,
  minigun: updateMinigun,
  missile: updateMissile,
  dronebay: updateDroneBay,
});

export function assertTowerCombatCoverage() {
  const configured = Object.keys(TOWER_CONFIG).sort();
  const handled = Object.keys(TOWER_HANDLERS).sort();
  if (configured.length !== handled.length || configured.some((type, i) => type !== handled[i])) {
    throw new Error(`Tower combat coverage mismatch: configured=${configured.join(',')} handled=${handled.join(',')}`);
  }
  return true;
}

export function updateTowerCombat(game, dt) {
  const step = Math.max(0, Number(dt) || 0);
  let actions = 0;
  for (const tower of game?.state?.entities?.structures || []) {
    if (!activeTower(tower)) continue;
    if (!tower.level) tower.level = 1;
    tower.cool = tickCooldown(tower.cool, step);
    if (!isCooldownReady(tower.cool)) continue;
    const stats = getEffectiveTowerStats(tower);
    actions += TOWER_HANDLERS[tower.type](game, tower, stats) || 0;
  }
  return actions;
}
