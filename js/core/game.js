import { createGameConfig, MIGRATION_STATUS } from './config.js';
import { createInitialState, resetState } from './state.js';
import { createAssetRegistry } from '../assets/assets.js';
import { applyInputCommands } from '../input/input.js';
import { updateNavigation } from '../navigation/navigation.js';
import { updateUnits } from '../units/units.js';
import { updateEnemies } from '../enemies/enemies.js';
import { updateTowers } from '../towers/towers.js';
import { updateCombat } from '../combat/combat.js';
import { updateBuildings } from '../buildings/buildings.js';
import { updateEconomy } from '../economy/economy.js';
import { updateFog } from '../fog/fog.js';

export const CLEAN_RUNTIME_STATUS = MIGRATION_STATUS.SKELETON_CREATED;

// Coarse future ownership only. Prompt 3 still does not execute this pipeline.
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

export function createGame({ canvas = null, ctx = null, now = () => 0 } = {}) {
  const config = createGameConfig();
  const viewport = canvas
    ? { width: canvas.width, height: canvas.height }
    : { width: config.viewport.width, height: config.viewport.height };
  const services = Object.freeze({ now });
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
