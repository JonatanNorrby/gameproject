import { MIGRATION_STATUS } from '../core/config.js';
import { ENEMY_CONFIG } from './enemyConfig.js';
import { updateEnemyActor, assertEnemyAiCoverage } from './enemyAi.js';
import { damageBaseAndConsumeEnemy } from './enemyCombat.js';
import { updateEnemyDirector, ensureEnemyDirector } from './enemyDirector.js';
import { cleanupDeadEnemies } from './enemyLifecycle.js';
import { effectiveEnemySpeed, tickEnemyStatuses, tickStructureCorrosion } from './enemyStatus.js';
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

// Authoritative clean enemy subsystem update. Production still runs the legacy
// loop until a later integration prompt; this function never calls legacy AI.
export function updateEnemies(game, dt) {
  const step = Math.max(0, Number(dt) || 0);
  if (!game?.state?.entities || step <= 0) {
    return { spawned: 0, actors: 0, guards: 0, removed: 0, cachesCompleted: 0 };
  }
  if (!game.state.enemyRuntime?.initialized) initializeEnemyRuntime(game);

  // Current runtime launches/schedules hordes before the frame's enemy actor pass,
  // so a batch emitted this frame can participate in this same enemy update.
  const directorResult = updateEnemyDirector(game, step);
  tickStructureCorrosion(game, step);

  let actors = 0;
  for (const enemy of [...game.state.entities.enemies]) {
    if (isCacheGuard(enemy) || Number(enemy?.hp) <= 0) continue;
    if (!tickEnemyStatuses(game, enemy, step)) continue;
    enemy.effectiveSpeed = effectiveEnemySpeed(enemy);
    const result = updateEnemyActor(game, enemy, step);
    actors++;
    if (Number(enemy.hp) <= 0) continue;
    if (!result.lure && !result.attacked) damageBaseAndConsumeEnemy(game, enemy);
  }

  // Guards intentionally use their cache-specific defend/leash policy, but shared
  // status, target eligibility, melee damage and navigation blockers.
  const guards = updateCacheGuards(game, step);

  // Remove dead enemies before evaluating cache contest so a dead defender cannot
  // pause capture for one extra frame.
  const removed = cleanupDeadEnemies(game);
  const cachesCompleted = updateCacheCapture(game, step);

  return {
    spawned: directorResult.spawned,
    hordeLaunched: directorResult.launched,
    actors,
    guards,
    removed,
    cachesCompleted,
  };
}
