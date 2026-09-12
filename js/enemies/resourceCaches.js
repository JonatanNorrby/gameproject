import { isNavigationPointBlocked } from '../navigation/pathfinding.js';
import { isNavigationTerrainBlocked } from '../navigation/terrain.js';
import { applyEnemyMeleeDamage, canEnemyMeleeTarget } from './enemyCombat.js';
import { removeEnemyWithoutReward } from './enemyLifecycle.js';
import { movementSpeedAt, stepCacheGuard } from './enemyMovement.js';
import { spawnEnemy, enemyElapsedSeconds } from './enemySpawning.js';
import { effectiveEnemySpeed, tickEnemyStatuses } from './enemyStatus.js';
import {
  canCacheGuardTargetUnit,
  canUnitActivateCache,
  canUnitCaptureCache,
} from './enemyTargeting.js';

function random(game) {
  const source = game?.services?.random;
  return typeof source === 'function' ? source() : Math.random();
}

function cacheConfig(game) {
  return game?.config?.resourceCaches || {};
}

function distanceSquared(a, b) {
  const dx = (Number(a?.x) || 0) - (Number(b?.x) || 0);
  const dy = (Number(a?.y) || 0) - (Number(b?.y) || 0);
  return dx * dx + dy * dy;
}

export function isCacheGuard(enemy) {
  return Boolean(enemy?.cacheGuard?.cacheId);
}

export function cacheForGuard(game, guard) {
  const id = guard?.cacheGuard?.cacheId;
  return (game?.state?.entities?.resourceCaches || []).find(cache => cache.id === id) || null;
}

function cacheSpotBlocked(game, x, y) {
  const config = cacheConfig(game);
  const base = game.state.base;
  const minBase = Number(config.minBaseDistance) || 760;
  if ((x - base.x) ** 2 + (y - base.y) ** 2 < minBase ** 2) return true;
  if (isNavigationTerrainBlocked(game, x, y, 48, { allTerrainKinds: true })) return true;
  for (const depot of game.state.entities.depots || []) {
    const radius = (Number(depot.r) || 34) + 100;
    if ((x - depot.x) ** 2 + (y - depot.y) ** 2 < radius ** 2) return true;
  }
  for (const structure of game.state.entities.structures || []) {
    if (!Number.isFinite(structure?.x) || !Number.isFinite(structure?.y)) continue;
    if ((x - structure.x) ** 2 + (y - structure.y) ** 2 < 150 ** 2) return true;
  }
  return false;
}

export function generateResourceCaches(game) {
  const config = cacheConfig(game);
  const count = Number(config.count) || 6;
  const radius = Number(config.radius) || 30;
  const minBase = Number(config.minBaseDistance) || 760;
  const maxBase = Number(config.maxBaseDistance) || 2850;
  const separation = Number(config.separation) || 760;
  const base = game.state.base;
  const width = Number(game.config.world.width) || 0;
  const height = Number(game.config.world.height) || 0;
  const caches = [];
  let tries = 0;

  while (caches.length < count && tries++ < 1600) {
    const angle = random(game) * Math.PI * 2;
    const distance = minBase + random(game) * (maxBase - minBase);
    const x = base.x + Math.cos(angle) * distance;
    const y = base.y + Math.sin(angle) * distance;
    if (x < 120 || y < 120 || x > width - 120 || y > height - 120) continue;
    if (cacheSpotBlocked(game, x, y)) continue;
    if (caches.some(cache => (x - cache.x) ** 2 + (y - cache.y) ** 2 < separation ** 2)) continue;
    caches.push({
      id: `cache-${caches.length}-${Math.floor(random(game) * 60_466_176).toString(36)}`,
      x,
      y,
      r: radius,
      capture: 0,
      captured: false,
      guardsSpawned: false,
      guardIds: [],
    });
  }
  return caches;
}

export function initializeResourceCaches(game, { force = false } = {}) {
  const entities = game?.state?.entities;
  if (!entities) throw new TypeError('initializeResourceCaches requires state.entities');
  if (!force && Array.isArray(entities.resourceCaches) && entities.resourceCaches.length) return entities.resourceCaches;
  entities.resourceCaches = generateResourceCaches(game);
  return entities.resourceCaches;
}

export function cacheReward(game) {
  const fade = Math.max(0.35, 1 - Math.min(1, enemyElapsedSeconds(game) / 900) * 0.65);
  return {
    gold: Math.round((50 + random(game) * 26) * fade),
    metal: Math.max(1, Math.round((3 + random(game) * 3) * fade)),
  };
}

function grantCacheReward(game, cache, reward) {
  const service = game?.services?.resourceCaches?.grantReward;
  if (typeof service === 'function') {
    const result = service(game, cache, reward);
    if (result !== undefined) return result;
  }
  const resources = game?.state?.resources;
  if (resources) {
    if (!game.state.debug?.unlimitedCash) resources.gold = (Number(resources.gold) || 0) + reward.gold;
    resources.metal = (Number(resources.metal) || 0) + reward.metal;
  }
  return reward;
}

function guardTypesForTime(game) {
  return Math.floor(enemyElapsedSeconds(game) / 60) >= 4
    ? ['ravager', 'runner', 'brute']
    : ['ravager', 'ravager', 'runner'];
}

export function guardSpawnPoint(game, cache, index, count) {
  const width = Number(game.config.world.width) || 0;
  const height = Number(game.config.world.height) || 0;
  for (let attempt = 0; attempt < 14; attempt++) {
    const angle = index / count * Math.PI * 2 + attempt * 0.47 + random(game) * 0.25;
    const distance = 155 + random(game) * 70;
    const x = cache.x + Math.cos(angle) * distance;
    const y = cache.y + Math.sin(angle) * distance;
    if (x < 20 || y < 20 || x > width - 20 || y > height - 20) continue;
    if (isNavigationPointBlocked(game, x, y, 12)) continue;
    return { x, y };
  }
  return { x: cache.x + 150, y: cache.y };
}

export function spawnCacheGuards(game, cache) {
  if (!cache || cache.guardsSpawned || cache.captured) return [];
  cache.guardsSpawned = true;
  const types = guardTypesForTime(game);
  const guards = [];
  for (let index = 0; index < types.length; index++) {
    const position = guardSpawnPoint(game, cache, index, types.length);
    const guard = spawnEnemy(game, types[index], {
      position,
      horde: false,
      cacheGuard: { cacheId: cache.id, homeX: position.x, homeY: position.y },
    });
    guards.push(guard);
  }
  cache.guardIds = guards.map(guard => guard.id);
  const callback = game?.services?.resourceCaches?.onGuardsSpawned;
  if (typeof callback === 'function') callback(game, cache, guards);
  return guards;
}

function nearestUnitForCache(game, cache, maxDistance, predicate) {
  const limit = Number(maxDistance) || 0;
  let best = null;
  let bestDistance = limit * limit;
  for (const unit of game?.state?.entities?.units || []) {
    if (!predicate(unit)) continue;
    const distance = distanceSquared(unit, cache);
    if (distance < bestDistance) {
      best = unit;
      bestDistance = distance;
    }
  }
  return best;
}

export function nearestCacheActivator(game, cache) {
  return nearestUnitForCache(game, cache, cacheConfig(game).activationRadius, canUnitActivateCache);
}

export function nearestCacheCapturer(game, cache) {
  return nearestUnitForCache(game, cache, cacheConfig(game).captureRadius, canUnitCaptureCache);
}

export function nearestGuardTarget(game, cache, guard) {
  return nearestUnitForCache(
    game,
    cache,
    cacheConfig(game).guardAggroRadius,
    unit => canCacheGuardTargetUnit(game, guard, unit),
  );
}

export function isCacheContested(game, cache) {
  const radius = Number(cacheConfig(game).contestRadius) || 145;
  const rr = radius * radius;
  return (game?.state?.entities?.enemies || []).some(enemy => (
    isCacheGuard(enemy)
    && enemy.cacheGuard.cacheId === cache.id
    && Number(enemy.hp) > 0
    && distanceSquared(enemy, cache) <= rr
  ));
}

export function updateCacheGuards(game, dt) {
  const step = Math.max(0, Number(dt) || 0);
  let updated = 0;
  for (const guard of [...(game?.state?.entities?.enemies || [])]) {
    if (!isCacheGuard(guard) || Number(guard.hp) <= 0) continue;
    if (!tickEnemyStatuses(game, guard, step)) continue;
    const cache = cacheForGuard(game, guard);
    if (!cache || cache.captured) {
      removeEnemyWithoutReward(game, guard);
      continue;
    }

    const target = nearestGuardTarget(game, cache, guard);
    let tx = Number(guard.cacheGuard.homeX) || cache.x;
    let ty = Number(guard.cacheGuard.homeY) || cache.y;
    if (target) {
      tx = target.x;
      ty = target.y;
    } else {
      const leash = Number(cacheConfig(game).guardLeashRadius) || 680;
      if (distanceSquared(guard, cache) > leash * leash) {
        tx = cache.x;
        ty = cache.y;
      }
    }

    if (target && canEnemyMeleeTarget(game, guard, target)) {
      applyEnemyMeleeDamage(game, guard, target, step);
      updated++;
      continue;
    }

    if ((guard.x - tx) ** 2 + (guard.y - ty) ** 2 > 100) {
      const speed = movementSpeedAt(game, guard, effectiveEnemySpeed(guard));
      stepCacheGuard(game, guard, tx, ty, speed, step);
    }
    updated++;
  }
  return updated;
}

function completeCacheCapture(game, cache) {
  if (cache.captured) return false;
  cache.captured = true;
  const reward = cacheReward(game);
  grantCacheReward(game, cache, reward);
  for (const enemy of [...(game?.state?.entities?.enemies || [])]) {
    if (isCacheGuard(enemy) && enemy.cacheGuard.cacheId === cache.id) removeEnemyWithoutReward(game, enemy);
  }
  cache.guardIds = [];
  const callback = game?.services?.resourceCaches?.onCaptured;
  if (typeof callback === 'function') callback(game, cache, reward);
  return true;
}

export function updateCacheCapture(game, dt) {
  const step = Math.max(0, Number(dt) || 0);
  const config = cacheConfig(game);
  const captureSeconds = Number(config.captureSeconds) || 4.5;
  let completed = 0;

  for (const cache of game?.state?.entities?.resourceCaches || []) {
    if (cache.captured) continue;
    const activator = nearestCacheActivator(game, cache);
    if (activator && !cache.guardsSpawned) spawnCacheGuards(game, cache);

    const capturer = nearestCacheCapturer(game, cache);
    const contested = isCacheContested(game, cache);
    if (capturer && !contested) {
      cache.capture = Math.min(captureSeconds, (Number(cache.capture) || 0) + step);
      if (cache.capture >= captureSeconds && completeCacheCapture(game, cache)) completed++;
    } else if (!capturer) {
      cache.capture = Math.max(0, (Number(cache.capture) || 0) - step * 0.35);
    }
  }
  return completed;
}

export function updateResourceCaches(game, dt) {
  updateCacheGuards(game, dt);
  return updateCacheCapture(game, dt);
}
