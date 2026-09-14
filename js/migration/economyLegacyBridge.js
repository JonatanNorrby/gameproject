import { createGameConfig } from '../core/config.js';
import { initializeBuildingRuntime } from '../buildings/buildingRuntime.js';
import { initializeResourceDepotRuntime } from '../economy/depots.js';
import { updateResourceMines } from '../economy/mining.js';
import { updateRefineries } from '../economy/refinery.js';
import { updateLandingPads } from '../economy/landingPads.js';
import { ensureTruckLogistics, updateTruckLogistics } from '../economy/truckLogistics.js';

const ECONOMIC_BUILDING_TYPES = new Set(['mine', 'oremine', 'refinery', 'landingpad']);
const MIGRATION_ID = 'economy-logistics-step1';

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function nonNegative(value, fallback = 0) {
  return Math.max(0, finite(value, fallback));
}

function requireHost(host) {
  if (!host || typeof host.getState !== 'function') throw new TypeError('Legacy economy bridge requires getState()');
  if (typeof host.setUpdateMines !== 'function') throw new TypeError('Legacy economy bridge requires setUpdateMines()');
  if (typeof host.setUpdateTruckEconomy !== 'function') throw new TypeError('Legacy economy bridge requires setUpdateTruckEconomy()');
  return host;
}

function defineLiveProperty(target, key, get, set) {
  Object.defineProperty(target, key, {
    configurable: false,
    enumerable: true,
    get,
    set,
  });
}

function bindLegacyAlias(target, key, get, set) {
  const descriptor = Object.getOwnPropertyDescriptor(target, key);
  if (descriptor?.get && descriptor?.set && descriptor.get.__apdEconomyAlias) return;
  const getter = () => get();
  getter.__apdEconomyAlias = true;
  Object.defineProperty(target, key, {
    configurable: true,
    enumerable: true,
    get: getter,
    set,
  });
}

function bindExportShipAliases(pad) {
  const ship = pad?.exportShip;
  if (!ship?.cargoStore) return;
  bindLegacyAlias(pad, 'shipState', () => ship.state, value => { ship.state = value === 'landed' ? 'landed' : 'cooldown'; });
  bindLegacyAlias(pad, 'shipCooldown', () => ship.cooldown, value => { ship.cooldown = nonNegative(value); });
  bindLegacyAlias(pad, 'shipHp', () => ship.hp, value => { ship.hp = finite(value); });
  bindLegacyAlias(pad, 'shipMaxHp', () => ship.maxHp, value => { ship.maxHp = Math.max(1, finite(value, 1)); });
  bindLegacyAlias(pad, 'shipCargo', () => ship.cargoStore.amount, value => { ship.cargoStore.amount = nonNegative(value); });
}

export function createLegacyEconomyGame(hostInput) {
  const host = requireHost(hostInput);
  const config = createGameConfig();
  const resources = {};
  const modifiers = {};
  const debug = {};
  const entities = {};
  const base = {};

  const current = () => host.getState();

  defineLiveProperty(resources, 'gold',
    () => nonNegative(current()?.credits),
    value => { const state = current(); if (state) state.credits = nonNegative(value); });
  defineLiveProperty(resources, 'metal',
    () => nonNegative(current()?.metal),
    value => { const state = current(); if (state) state.metal = nonNegative(value); });

  for (const key of ['mineRate', 'mineStorage', 'truckCapacity']) {
    defineLiveProperty(modifiers, key,
      () => {
        const value = Number(current()?.mods?.[key]);
        return Number.isFinite(value) ? value : 1;
      },
      value => {
        const state = current();
        if (!state) return;
        state.mods ||= {};
        state.mods[key] = finite(value, 1);
      });
  }

  defineLiveProperty(debug, 'unlimitedCash',
    () => Boolean(current()?.debug?.unlimitedCash),
    value => {
      const state = current();
      if (!state) return;
      state.debug ||= {};
      state.debug.unlimitedCash = Boolean(value);
    });

  for (const key of ['units', 'structures', 'depots']) {
    defineLiveProperty(entities, key,
      () => Array.isArray(current()?.[key]) ? current()[key] : [],
      value => { const state = current(); if (state) state[key] = Array.isArray(value) ? value : []; });
  }
  defineLiveProperty(entities, 'rivers',
    () => Array.isArray(current()?.rivers) ? current().rivers : [],
    value => { const state = current(); if (state) state.rivers = Array.isArray(value) ? value : []; });

  defineLiveProperty(base, 'x', () => finite(host.baseX), () => {});
  defineLiveProperty(base, 'y', () => finite(host.baseY), () => {});
  defineLiveProperty(base, 'radius', () => nonNegative(host.baseRadius), () => {});
  defineLiveProperty(base, 'hp',
    () => nonNegative(current()?.baseHp),
    value => { const state = current(); if (state) state.baseHp = nonNegative(value); });
  defineLiveProperty(base, 'maxHp',
    () => Math.max(1, nonNegative(current()?.maxBaseHp, 1)),
    value => { const state = current(); if (state) state.maxBaseHp = Math.max(1, nonNegative(value, 1)); });

  const game = {
    config,
    state: { resources, modifiers, debug, entities, base },
    services: {
      now: () => (typeof host.now === 'function' ? host.now() : 0),
      random: () => (typeof host.random === 'function' ? host.random() : Math.random()),
      logistics: {
        issueMove: (_game, unit, x, y, options) => {
          if (typeof host.issueMove !== 'function') return { ok: false };
          const result = host.issueMove(unit, x, y, options);
          return typeof result === 'boolean' ? { ok: result } : (result || { ok: false });
        },
      },
      landingPads: {
        onShipLanded: (_game, pad, event) => {
          if (typeof host.attractEnemiesToPad === 'function') host.attractEnemiesToPad(pad, event);
        },
        onShipLaunched: (_game, _pad, event) => {
          if (typeof host.message === 'function') host.message(`Export ship launched full: ${event.sold} crystal sold for ${event.gold} gold.`);
        },
        onShipDestroyed: (_game, _pad, event) => {
          if (typeof host.message === 'function') host.message(`Export ship destroyed — ${Math.floor(event.cargoLost || 0)} loaded crystal was lost. Landing Pad cooldown restarted.`);
        },
      },
    },
  };

  return game;
}

export function normalizeLegacyEconomyState(game) {
  for (const depot of game?.state?.entities?.depots || []) initializeResourceDepotRuntime(game, depot);
  for (const structure of game?.state?.entities?.structures || []) {
    if (!ECONOMIC_BUILDING_TYPES.has(structure?.type)) continue;
    initializeBuildingRuntime(game, structure);
    if (structure.type === 'landingpad') bindExportShipAliases(structure);
  }
  for (const unit of game?.state?.entities?.units || []) if (unit?.type === 'truck') ensureTruckLogistics(game, unit);
}

export function installLegacyEconomyBridge(hostInput) {
  const host = requireHost(hostInput);
  const game = createLegacyEconomyGame(host);

  const updateBeforeMovement = dt => {
    normalizeLegacyEconomyState(game);
    const extracted = updateResourceMines(game, dt);
    const refinery = updateRefineries(game, dt);
    const pads = updateLandingPads(game, dt);
    return { extracted, ...refinery, pads };
  };

  const updateAfterMovement = () => {
    normalizeLegacyEconomyState(game);
    return updateTruckLogistics(game);
  };

  // The legacy frame already has the correct two call sites: updateMines() before
  // movement and updateTruckEconomy() after movement. Replace those owners only;
  // placement, rendering, selection and UI remain legacy until later migration steps.
  host.setUpdateMines(updateBeforeMovement);
  host.setUpdateTruckEconomy(updateAfterMovement);
  normalizeLegacyEconomyState(game);

  const audit = {
    id: MIGRATION_ID,
    active: true,
    owner: 'js/economy/*',
    frameOrder: ['mining', 'refinery', 'landing-pads', 'unit-movement', 'truck-logistics'],
  };
  if (typeof globalThis !== 'undefined') {
    globalThis.__apdEconomyMigration = audit;
    globalThis.__apdAudit = { ...(globalThis.__apdAudit || {}), economyOwner: audit.owner, economyMigration: MIGRATION_ID };
  }
  if (typeof host.markReady === 'function') host.markReady(audit);
  return { game, updateBeforeMovement, updateAfterMovement, audit };
}
