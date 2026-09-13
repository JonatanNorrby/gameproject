import { createGameConfig, MIGRATION_STATUS } from './config.js';
import { createInitialState, resetState } from './state.js';
import { createAssetRegistry } from '../assets/assets.js';
import { applyInputCommands } from '../input/input.js';
import { updateNavigation } from '../navigation/navigation.js';
import { updateUnits } from '../units/units.js';
import { updateEnemies } from '../enemies/enemies.js';
import { updateTowers } from '../towers/towers.js';
import { updateCombat } from '../combat/combat.js';
import { emitPlayerProjectile } from '../combat/projectiles.js';
import { updateBuildings } from '../buildings/buildings.js';
import { updateEconomy } from '../economy/economy.js';
import { updateFog, isPointVisible } from '../fog/fog.js';

export const CLEAN_RUNTIME_STATUS = MIGRATION_STATUS.MIGRATED;

// Historical extraction registry retained for compatibility/documentation. The
// authoritative integrated scheduler is js/core/runtime.js; this list must not be
// executed as a second frame loop.
export const FUTURE_UPDATE_PIPELINE = Object.freeze([
  Object.freeze({ id: 'input', run: applyInputCommands }),
  Object.freeze({ id: 'navigation', run: updateNavigation }),
  Object.freeze({ id: 'units', run: updateUnits }),
  Object.freeze({ id: 'enemies', run: updateEnemies }),
  Object.freeze({ id: 'towers', run: updateTowers }),
  Object.freeze({ id: 'combat', run: updateCombat }),
  Object.freeze({ id: 'buildings', run: updateBuildings }),
  Object.freeze({ id: 'economy', run: updateEconomy }),
  Object.freeze({ id: 'fog', run: updateFog }),
]);

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
    migration: Object.freeze({ status: CLEAN_RUNTIME_STATUS, active: false }),
    reset() {
      return resetState(state, { config, viewport, now });
    },
  };

  return game;
}
