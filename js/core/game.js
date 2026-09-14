import { createGameConfig, MIGRATION_STATUS } from './config.js';
import { createInitialState, resetState } from './state.js';
import { createAssetRegistry } from '../assets/assets.js';
import { emitPlayerProjectile } from '../combat/projectiles.js';
import { isPointVisible } from '../fog/fog.js';

export const CLEAN_RUNTIME_STATUS = MIGRATION_STATUS.MIGRATED;

function setUiMessage(game, message) {
  if (game?.state?.ui) game.state.ui.message = message;
}

function runtimeServices(externalServices) {
  const defaultFirePlayerProjectile = (game, projectile) => emitPlayerProjectile(game, projectile);
  const defaultFogVisible = (x, y, _target, _attacker, game) => isPointVisible(game, x, y);
  const defaultShipLanded = (game, pad, event) => {
    const radius = Number(event?.attractRadius) || 0;
    let attracted = 0;
    for (const enemy of game?.state?.entities?.enemies || []) {
      if (Number(enemy.hp) <= 0 || Math.hypot(enemy.x - pad.x, enemy.y - pad.y) > radius) continue;
      enemy.attractedTo = pad.id;
      attracted++;
    }
    setUiMessage(game, `Supply ship landed — ${attracted} nearby aliens were attracted to the Landing Pad.`);
    return attracted;
  };
  const defaultShipDestroyed = (game, _pad, event) => {
    setUiMessage(game, `Export ship destroyed — ${Math.floor(Number(event?.cargoLost) || 0)} loaded Crystal was lost.`);
  };
  const defaultShipLaunched = (game, _pad, event) => {
    setUiMessage(game, `Export ship launched full: ${event?.sold || 0} Crystal sold for ${event?.gold || 0} Gold.`);
  };
  const defaultCacheGuards = game => setUiMessage(game, 'Resource cache disturbed — local aliens are defending it.');
  const defaultCacheCaptured = (game, _cache, reward) => setUiMessage(game, `Resource cache secured: +${reward?.gold || 0} gold, +${reward?.metal || 0} metal.`);
  const defaultBaseDestroyed = game => setUiMessage(game, 'THE BASE HAS FALLEN — press RESTART.');

  return {
    ...externalServices,
    playerCombat: Object.freeze({
      fireProjectile: defaultFirePlayerProjectile,
      ...(externalServices.playerCombat || {}),
    }),
    towerCombat: Object.freeze({
      fireProjectile: defaultFirePlayerProjectile,
      ...(externalServices.towerCombat || {}),
    }),
    fog: Object.freeze({
      isVisible: defaultFogVisible,
      ...(externalServices.fog || {}),
    }),
    landingPads: Object.freeze({
      onShipLanded: defaultShipLanded,
      onShipDestroyed: defaultShipDestroyed,
      onShipLaunched: defaultShipLaunched,
      ...(externalServices.landingPads || {}),
    }),
    resourceCaches: Object.freeze({
      onGuardsSpawned: defaultCacheGuards,
      onCaptured: defaultCacheCaptured,
      ...(externalServices.resourceCaches || {}),
    }),
    lifecycle: Object.freeze({
      onBaseDestroyed: defaultBaseDestroyed,
      ...(externalServices.lifecycle || {}),
    }),
  };
}

export function createGame({ canvas = null, ctx = null, now = () => 0, services: externalServices = {} } = {}) {
  const config = createGameConfig();
  const viewport = canvas
    ? { width: canvas.width, height: canvas.height }
    : { width: config.viewport.width, height: config.viewport.height };
  const services = Object.freeze({ ...runtimeServices(externalServices), now });
  const state = createInitialState({ config, viewport, now });

  const game = {
    config,
    state,
    canvas,
    ctx,
    viewport,
    assets: createAssetRegistry(),
    services,
    migration: Object.freeze({ status: CLEAN_RUNTIME_STATUS, active: true, productionOwner: 'js/core/runtime.js' }),
    resetState() {
      return resetState(state, { config, viewport, now });
    },
    reset() {
      return this.resetState();
    },
  };

  return game;
}
