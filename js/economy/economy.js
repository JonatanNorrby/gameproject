import { MIGRATION_STATUS } from '../core/config.js';
import { ensureMainBaseRuntime, initializeBuildingRuntime } from '../buildings/buildingRuntime.js';
import { initializeResourceDepotRuntime } from './depots.js';
import { updateResourceMines } from './mining.js';
import { updateTruckLogistics, ensureTruckLogistics } from './truckLogistics.js';
import { updateRefineries } from './refinery.js';
import { updateLandingPads } from './landingPads.js';

export { ECONOMY_CONFIG } from './economyConfig.js';
export * from './resources.js';
export * from './depots.js';
export * from './mining.js';
export * from './truckLogistics.js';
export * from './refinery.js';
export * from './landingPads.js';

export const ECONOMY_SYSTEM_STATUS = MIGRATION_STATUS.MIGRATED;

export function initializeEconomyRuntime(game) {
  if (!game?.state?.entities) throw new TypeError('initializeEconomyRuntime requires a game context');
  ensureMainBaseRuntime(game);
  for (const depot of game.state.entities.depots || []) initializeResourceDepotRuntime(game, depot);
  for (const structure of game.state.entities.structures || []) {
    if (['mine', 'oremine', 'refinery', 'landingpad'].includes(structure.type)) initializeBuildingRuntime(game, structure);
  }
  for (const unit of game.state.entities.units || []) if (unit.type === 'truck') ensureTruckLogistics(game, unit);
  game.state.economyRuntime = { ...(game.state.economyRuntime || {}), initialized: true };
  return game.state.economyRuntime;
}

// Authoritative clean economy/logistics update for the future single-module
// pipeline. Production migration step 1 reuses these same clean subsystem passes
// through js/migration/economyLegacyBridge.js, split around legacy unit movement
// to preserve the current frame order.
export function updateEconomy(game, dt) {
  const step = Math.max(0, Number(dt) || 0);
  if (!game?.state?.entities || step <= 0) return { extracted: 0, trucksServiced: 0, oreProcessed: 0, metalProduced: 0, pads: { landed: 0, launched: 0, loaded: 0 } };
  if (!game.state.economyRuntime?.initialized) initializeEconomyRuntime(game);
  // Legacy frame parity: mining/refining/export updates happened before unit
  // movement, then Truck servicing happened after movement in the same frame.
  // The future clean pipeline calls economy after unit movement, so keep the
  // economy-internal order as mines -> refinery -> pads -> Trucks.
  const extracted = updateResourceMines(game, step);
  const refinery = updateRefineries(game, step);
  const pads = updateLandingPads(game, step);
  const trucksServiced = updateTruckLogistics(game);
  return { extracted, trucksServiced, ...refinery, pads };
}
