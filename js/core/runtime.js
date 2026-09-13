import { resetState } from './state.js';
import { applyInputCommands } from '../input/input.js';
import { updateNavigation } from '../navigation/navigation.js';
import { updateUnits } from '../units/units.js';
import { initializeEnemyRuntime, updateEnemyActors, updateEnemyDirector } from '../enemies/enemies.js';
import { updateTowers } from '../towers/towers.js';
import { updatePlayerUnitCombat } from '../combat/unitCombat.js';
import { updateProjectiles } from '../combat/projectiles.js';
import { cleanupDestroyedEntities } from '../combat/lifecycle.js';
import { updateBuildings } from '../buildings/buildings.js';
import { initializeEconomyRuntime, updateEconomy } from '../economy/economy.js';
import { ensureFogState, refreshFog, updateFog } from '../fog/fog.js';
import { renderFrame } from '../rendering/renderer.js';
import { initializeWorld } from '../world/world.js';

export const MAX_FRAME_DT = 0.033;
export const RUNTIME_PHASES = Object.freeze([
  'input',
  'director',
  'buildings',
  'units',
  'economy',
  'player-combat',
  'towers',
  'enemy-actors',
  'projectiles',
  'lifecycle',
  'fog',
]);

function nowMs(game) {
  const now = game?.services?.now;
  return typeof now === 'function' ? Number(now()) || 0 : (typeof performance !== 'undefined' ? performance.now() : Date.now());
}

function updateParticles(game, dt) {
  const particles = game?.state?.entities?.particles;
  if (!Array.isArray(particles)) return 0;
  for (let i = particles.length - 1; i >= 0; i--) {
    const particle = particles[i];
    particle.x += (Number(particle.vx) || 0) * dt;
    particle.y += (Number(particle.vy) || 0) * dt;
    particle.life = (Number(particle.life) || 0) - dt;
    if (particle.life <= 0) particles.splice(i, 1);
  }
  return particles.length;
}

export function initializeRuntime(game, { forceWorld = false } = {}) {
  if (!game?.state) throw new TypeError('initializeRuntime requires a game context');
  initializeWorld(game, { force: forceWorld });
  initializeEconomyRuntime(game);
  initializeEnemyRuntime(game, { forceCaches: forceWorld });
  ensureFogState(game);
  refreshFog(game, { forceExplore: true });
  game.state.runtime = { initialized: true, phases: RUNTIME_PHASES };
  return game.state.runtime;
}

export function resetRuntime(game, { preserveSession = true } = {}) {
  if (!game?.state) throw new TypeError('resetRuntime requires a game context');
  const prior = preserveSession ? {
    gameStarted: Boolean(game.state.ui?.gameStarted),
    titleMenuOpen: Boolean(game.state.ui?.titleMenuOpen),
    options: { ...(game.state.ui?.options || {}) },
    showReach: Boolean(game.state.view?.showReach),
  } : null;

  resetState(game.state, {
    config: game.config,
    viewport: game.viewport,
    now: game.services.now,
  });
  initializeRuntime(game, { forceWorld: true });

  if (prior) {
    game.state.ui.options = { ...game.state.ui.options, ...prior.options };
    game.state.view.showReach = prior.showReach;
    if (prior.gameStarted) {
      game.state.ui.gameStarted = true;
      game.state.ui.titleMenuOpen = prior.titleMenuOpen;
      game.state.session.paused = prior.titleMenuOpen;
    }
  }
  game.state.session.lastFrameTime = nowMs(game);
  game.input?.cancelGesture?.();
  renderRuntime(game);
  return game.state;
}

export function stepRuntime(game, dt) {
  if (!game?.state) throw new TypeError('stepRuntime requires a game context');
  if (!game.state.runtime?.initialized) initializeRuntime(game);
  const step = Math.min(MAX_FRAME_DT, Math.max(0, Number(dt) || 0));

  const input = applyInputCommands(game, step);
  updateNavigation(game, step);
  const blocked = game.state.session.gameOver || game.state.session.choosing || game.state.session.paused;
  if (blocked || step <= 0) {
    const fog = updateFog(game, step);
    return { step, simulated: false, input, fog };
  }

  game.state.time.elapsed += step;
  const director = updateEnemyDirector(game, step);
  const buildings = updateBuildings(game, step);
  const unitMovement = updateUnits(game, step);
  const economy = updateEconomy(game, step);
  const playerCombat = updatePlayerUnitCombat(game, step);
  const towers = updateTowers(game, step);
  // Player combat owns mark timers in the current clean combat contract. The
  // enemy status pass therefore advances burn/slow/corrosion but not marks here.
  const enemies = updateEnemyActors(game, step, { tickMarks: false });
  const projectiles = updateProjectiles(game, step);
  const lifecycle = cleanupDestroyedEntities(game);
  const particles = updateParticles(game, step);

  if (game.state.debug?.unlimitedLives && game.state.base) game.state.base.hp = game.state.base.maxHp;
  const fog = updateFog(game, step);
  return {
    step,
    simulated: true,
    director,
    buildings,
    unitMovement,
    economy,
    playerCombat,
    towers,
    enemies,
    projectiles,
    lifecycle,
    particles,
    fog,
  };
}

export function renderRuntime(game, alpha = 0) {
  game?.ui?.render?.();
  return renderFrame(game, alpha);
}

export function runRuntimeFrame(game, timestampMs) {
  const timestamp = Number(timestampMs);
  const now = Number.isFinite(timestamp) ? timestamp : nowMs(game);
  const last = Number(game.state.session.lastFrameTime);
  const dt = Number.isFinite(last) ? Math.max(0, (now - last) / 1000) : 0;
  game.state.session.lastFrameTime = now;
  const update = stepRuntime(game, dt);
  const render = renderRuntime(game);
  return { update, render };
}

function frameApi(game) {
  const runtime = game?.services?.runtime || {};
  const request = runtime.requestFrame || (typeof requestAnimationFrame === 'function' ? requestAnimationFrame.bind(globalThis) : null);
  const cancel = runtime.cancelFrame || (typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame.bind(globalThis) : null);
  return { request, cancel };
}

export function startRuntimeLoop(game) {
  if (!game) throw new TypeError('startRuntimeLoop requires a game context');
  const api = frameApi(game);
  if (typeof api.request !== 'function') return { started: false, reason: 'no-frame-api' };
  if (game.runtimeLoop?.running) return { started: true, alreadyRunning: true };

  const loop = { running: true, frameId: null };
  const tick = timestamp => {
    if (!loop.running) return;
    runRuntimeFrame(game, timestamp);
    loop.frameId = api.request(tick);
  };
  game.state.session.lastFrameTime = nowMs(game);
  loop.frameId = api.request(tick);
  game.runtimeLoop = loop;
  return { started: true, loop };
}

export function stopRuntimeLoop(game) {
  const loop = game?.runtimeLoop;
  if (!loop?.running) return false;
  loop.running = false;
  const api = frameApi(game);
  if (loop.frameId != null && typeof api.cancel === 'function') api.cancel(loop.frameId);
  loop.frameId = null;
  return true;
}
