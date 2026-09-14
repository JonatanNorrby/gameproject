import { updateBuildings } from '../buildings/buildings.js';
import { cleanupDeadPlayerUnits, cleanupDeadStructures } from '../combat/lifecycle.js';
import { updatePlayerUnitCombat } from '../combat/unitCombat.js';
import { updateProjectiles } from '../combat/projectiles.js';
import { initializeEconomyRuntime } from '../economy/economy.js';
import { updateLandingPads } from '../economy/landingPads.js';
import { updateResourceMines } from '../economy/mining.js';
import { updateRefineries } from '../economy/refinery.js';
import { updateTruckLogistics } from '../economy/truckLogistics.js';
import { initializeEnemyRuntime, updateEnemyActors, updateEnemyDirector } from '../enemies/enemies.js';
import { updateCacheCapture } from '../enemies/resourceCaches.js';
import { refreshFog } from '../fog/fog.js';
import { applyInputCommands } from '../input/input.js';
import { updateMovementRuntime } from '../movement/runtime.js';
import { renderFrame } from '../rendering/renderer.js';
import { updateVisualEffects } from '../rendering/visualEffects.js';
import { updateTowers } from '../towers/towers.js';
import { renderUI } from '../ui/ui.js';
import { initializeWorld } from '../world/world.js';
import { resetState } from './state.js';

export const MAX_SIMULATION_STEP = 0.033;
export const RUNTIME_PHASES = Object.freeze([
  'input',
  'enemy-director',
  'buildings',
  'economy-mines',
  'economy-refineries',
  'economy-landing-pads',
  'movement',
  'economy-trucks',
  'player-combat',
  'tower-combat',
  'enemy-actors',
  'projectiles',
  'player-structure-cleanup',
  'particles',
  'resource-cache-capture',
  'resource-cache-prune',
  'fog',
  'visual-effects',
]);

function now(game) {
  const clock = game?.services?.now;
  return typeof clock === 'function' ? Number(clock()) || 0 : 0;
}

function phase(game, id, action) {
  const callback = game?.services?.runtime?.onPhase;
  if (typeof callback === 'function') callback(id, game);
  return action();
}

function updateParticles(game, dt) {
  const particles = game?.state?.entities?.particles;
  if (!Array.isArray(particles)) return 0;
  const step = Math.max(0, Number(dt) || 0);
  let removed = 0;
  for (let index = particles.length - 1; index >= 0; index--) {
    const particle = particles[index];
    if (!particle || typeof particle !== 'object') { particles.splice(index, 1); removed++; continue; }
    if (Number.isFinite(Number(particle.vx))) particle.x = (Number(particle.x) || 0) + Number(particle.vx) * step;
    if (Number.isFinite(Number(particle.vy))) particle.y = (Number(particle.y) || 0) + Number(particle.vy) * step;
    if (Number.isFinite(Number(particle.life))) particle.life = Number(particle.life) - step;
    if (!Number.isFinite(Number(particle.x)) || !Number.isFinite(Number(particle.y)) || (Number.isFinite(Number(particle.life)) && Number(particle.life) <= 0)) {
      particles.splice(index, 1); removed++;
    }
  }
  return removed;
}

function pruneCapturedCaches(game) {
  const caches = game?.state?.entities?.resourceCaches;
  if (!Array.isArray(caches)) return 0;
  const before = caches.length;
  game.state.entities.resourceCaches = caches.filter(cache => !cache?.captured);
  return before - game.state.entities.resourceCaches.length;
}

export function initializeRuntime(game, { forceWorld = false } = {}) {
  if (!game?.state) throw new TypeError('initializeRuntime requires a game context');
  initializeWorld(game, { force: forceWorld });
  initializeEconomyRuntime(game);
  initializeEnemyRuntime(game, { forceCaches: forceWorld });
  refreshFog(game, { forceExplore: true, now: now(game) });
  game.state.runtime = {
    ...(game.state.runtime || {}),
    initialized: true,
    owner: 'js/core/runtime.js',
    phases: RUNTIME_PHASES,
  };
  return game.state.runtime;
}

export function resetRuntime(game, { preserveSession = true } = {}) {
  if (!game?.state) throw new TypeError('resetRuntime requires a game context');
  const previous = game.state;
  const options = { ...(previous.ui?.options || {}) };
  const showReach = Boolean(previous.view?.showReach);
  const gameStarted = Boolean(previous.ui?.gameStarted);
  const titleMenuOpen = Boolean(previous.ui?.titleMenuOpen);
  const titlePanel = previous.ui?.titlePanel ?? null;
  const wasPaused = Boolean(previous.session?.paused);

  resetState(previous, {
    config: game.config,
    viewport: game.viewport,
    now: game.services.now,
  });

  previous.ui.options = { ...previous.ui.options, ...options };
  previous.view.showReach = showReach;
  if (preserveSession && gameStarted) {
    previous.ui.gameStarted = true;
    previous.ui.titleMenuOpen = false;
    previous.ui.titlePanel = null;
    previous.ui.commandMenuOpen = false;
    previous.session.paused = false;
    previous.ui.message = 'Run restarted. Survive, expand logistics, and defend the base.';
  } else if (preserveSession && titleMenuOpen) {
    previous.ui.titleMenuOpen = true;
    previous.ui.titlePanel = titlePanel;
    previous.session.paused = true;
  } else if (preserveSession) {
    previous.session.paused = wasPaused;
  }

  initializeRuntime(game, { forceWorld: true });
  game.input?.cancelGesture?.();
  renderUI(game);
  return previous;
}

export function stepRuntime(game, dt) {
  if (!game?.state) throw new TypeError('stepRuntime requires a game context');
  if (!game.state.runtime?.initialized) initializeRuntime(game);
  const step = Math.max(0, Math.min(MAX_SIMULATION_STEP, Number(dt) || 0));
  const clock = now(game);

  phase(game, 'input', () => applyInputCommands(game, step));

  if (game.state.session?.paused || game.state.session?.gameOver || step <= 0) {
    phase(game, 'fog', () => refreshFog(game, { now: clock }));
    phase(game, 'visual-effects', () => updateVisualEffects(game, clock));
    return { simulated: false, step, elapsed: Number(game.state.time?.elapsed) || 0 };
  }

  game.state.time.elapsed = (Number(game.state.time.elapsed) || 0) + step;

  const results = {};
  results.director = phase(game, 'enemy-director', () => updateEnemyDirector(game, step));
  results.buildings = phase(game, 'buildings', () => updateBuildings(game, step));

  // Preserve Step 1 production timing: mines/refineries/pads advance before
  // movement, while Truck service advances after movement at the unit's new
  // position. Do not collapse these phases into updateEconomy().
  results.mines = phase(game, 'economy-mines', () => updateResourceMines(game, step));
  results.refineries = phase(game, 'economy-refineries', () => updateRefineries(game, step));
  results.landingPads = phase(game, 'economy-landing-pads', () => updateLandingPads(game, step));
  results.movement = phase(game, 'movement', () => updateMovementRuntime(game, step));
  results.trucks = phase(game, 'economy-trucks', () => updateTruckLogistics(game, step));

  results.playerCombat = phase(game, 'player-combat', () => updatePlayerUnitCombat(game, step));
  results.towers = phase(game, 'tower-combat', () => updateTowers(game, step));
  results.enemies = phase(game, 'enemy-actors', () => updateEnemyActors(game, step, { manageCacheCapture: false }));
  results.projectiles = phase(game, 'projectiles', () => updateProjectiles(game, step));
  results.cleanup = phase(game, 'player-structure-cleanup', () => ({
    units: cleanupDeadPlayerUnits(game),
    structures: cleanupDeadStructures(game),
  }));
  results.particlesRemoved = phase(game, 'particles', () => updateParticles(game, step));

  // v47/v51 effective order captured resource caches after the inner simulation
  // frame, then removed completed cache visuals. Keep that late-frame ownership.
  results.cachesCompleted = phase(game, 'resource-cache-capture', () => updateCacheCapture(game, step));
  results.cachesPruned = phase(game, 'resource-cache-prune', () => pruneCapturedCaches(game));
  phase(game, 'fog', () => refreshFog(game, { now: clock }));
  results.visualEffects = phase(game, 'visual-effects', () => updateVisualEffects(game, clock));

  return { simulated: true, step, elapsed: game.state.time.elapsed, results };
}

function requestFrame(game, callback) {
  const service = game?.services?.runtime?.requestFrame;
  if (typeof service === 'function') return service(callback);
  if (typeof requestAnimationFrame === 'function') return requestAnimationFrame(callback);
  return null;
}
function cancelFrame(game, handle) {
  const service = game?.services?.runtime?.cancelFrame;
  if (typeof service === 'function') return service(handle);
  if (typeof cancelAnimationFrame === 'function' && handle != null) cancelAnimationFrame(handle);
}

export function startRuntimeLoop(game) {
  if (!game) throw new TypeError('startRuntimeLoop requires a game context');
  if (game.runtimeLoop?.running) return game.runtimeLoop;
  const loop = { running: true, handle: null };
  let last = now(game);
  const frame = timestamp => {
    if (!loop.running) return;
    const current = Number.isFinite(Number(timestamp)) ? Number(timestamp) : now(game);
    const dt = Math.max(0, (current - last) / 1000);
    last = current;
    game.state.session.lastFrameTime = current;
    stepRuntime(game, dt);
    renderFrame(game);
    renderUI(game);
    loop.handle = requestFrame(game, frame);
  };
  loop.handle = requestFrame(game, frame);
  game.runtimeLoop = loop;
  return loop;
}

export function stopRuntimeLoop(game) {
  const loop = game?.runtimeLoop;
  if (!loop) return false;
  loop.running = false;
  cancelFrame(game, loop.handle);
  game.runtimeLoop = null;
  return true;
}
