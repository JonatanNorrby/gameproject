import { MIGRATION_STATUS } from '../core/config.js';
import { ENEMY_CONFIG } from './enemyConfig.js';
import { updateEnemyActor, assertEnemyAiCoverage } from './enemyAi.js';
import { damageBaseAndConsumeEnemy } from './enemyCombat.js';
import { updateEnemyDirector, ensureEnemyDirector } from './enemyDirector.js';
import { effectiveEnemySpeed, tickEnemyStatuses } from './enemyStatus.js';
import { updateStatusEffects } from '../combat/statusEffects.js';
import { cleanupDestroyedEntities } from '../combat/lifecycle.js';
import {
  initializeResourceCaches,
  isCacheGuard,
  updateCacheCapture,
  updateCacheGuards,
} from './resourceCaches.js';

export {
  ENEMY_CONFIG,
  ENEMY_TYPES,
  getEnemyConfig,
  hasEnemyTrait,
  normalizeEnemyType,
} from './enemyConfig.js';
export {
  createEnemy,
  enemyElapsedSeconds,
  enemyLevel,
  hordeSpawnPoint,
  randomEdgeSpawnPoint,
  spawnEnemy,
} from './enemySpawning.js';
export {
  baseHordeSize,
  chooseHordeEnemyType,
  currentHordeRadius,
  enemyThreatSnapshot,
  ensureEnemyDirector,
  nextHordeGap,
  spawnHordeEnemy,
  updateEnemyDirector,
} from './enemyDirector.js';
export {
  generateResourceCaches,
  initializeResourceCaches,
  isCacheContested,
  isCacheGuard,
  nearestCacheActivator,
  nearestCacheCapturer,
  nearestGuardTarget,
  spawnCacheGuards,
  updateCacheCapture,
  updateCacheGuards,
  updateResourceCaches,
} from './resourceCaches.js';
export { ENEMY_AI_HANDLERS, assertEnemyAiCoverage, updateEnemyActor } from './enemyAi.js';

export const ENEMY_SYSTEM_STATUS = MIGRATION_STATUS.MIGRATED;

export function initializeEnemyRuntime(game, { forceCaches = false } = {}) {
  if (!game?.state?.entities) throw new TypeError('initializeEnemyRuntime requires a game context');
  assertEnemyAiCoverage(ENEMY_CONFIG);
  ensureEnemyDirector(game);
  initializeResourceCaches(game, { force: forceCaches });
  game.state.enemyRuntime = {
    ...(game.state.enemyRuntime || {}),
    initialized: true,
  };
  return game.state.enemyRuntime;
}

// Split from the director only so the final runtime can preserve the effective
// legacy frame order: spawn/director first, then construction/economy/movement,
// then player/tower attacks, then enemy actor decisions, then projectiles.
export function updateEnemyActors(game, dt, { tickMarks = true } = {}) {
  const step = Math.max(0, Number(dt) || 0);
  if (!game?.state?.entities || step <= 0) return { actors: 0, guards: 0, removed: 0, cachesCompleted: 0 };
  if (!game.state.enemyRuntime?.initialized) initializeEnemyRuntime(game);

  updateStatusEffects(game, step, { tickMarks });
  let actors = 0;
  for (const enemy of [...game.state.entities.enemies]) {
    if (isCacheGuard(enemy) || Number(enemy?.hp) <= 0) continue;
    if (!tickEnemyStatuses(game, enemy)) continue;
    enemy.effectiveSpeed = effectiveEnemySpeed(enemy);
    const result = updateEnemyActor(game, enemy, step);
    actors++;
    if (Number(enemy.hp) <= 0) continue;
    if (!result.lure && !result.attacked) damageBaseAndConsumeEnemy(game, enemy);
  }

  const guards = updateCacheGuards(game, step);
  const lifecycle = cleanupDestroyedEntities(game);
  const cachesCompleted = updateCacheCapture(game, step);
  return { actors, guards, removed: lifecycle.enemies, cachesCompleted };
}

export function updateEnemies(game, dt) {
  const step = Math.max(0, Number(dt) || 0);
  if (!game?.state?.entities || step <= 0) {
    return { spawned: 0, actors: 0, guards: 0, removed: 0, cachesCompleted: 0 };
  }
  if (!game.state.enemyRuntime?.initialized) initializeEnemyRuntime(game);
  const directorResult = updateEnemyDirector(game, step);
  return {
    spawned: directorResult.spawned,
    hordeLaunched: directorResult.launched,
    ...updateEnemyActors(game, step),
  };
}
