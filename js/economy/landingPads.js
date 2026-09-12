import { applyDamage } from '../combat/damage.js';
import { getBuildingConfig } from '../buildings/buildingConfig.js';
import { getStorageCapacity, initializeBuildingRuntime } from '../buildings/buildingRuntime.js';
import {
  addResource,
  createResourceStore,
  discardStoredResource,
  getStoredResource,
  RESOURCE_TYPES,
  transferResource,
} from './resources.js';

export const EXPORT_SHIP_STATES = Object.freeze({ COOLDOWN: 'cooldown', LANDED: 'landed' });

export function ensureExportShipRuntime(game, pad) {
  initializeBuildingRuntime(game, pad);
  const config = getBuildingConfig('landingpad').exportShip;
  pad.exportShip ||= {
    state: EXPORT_SHIP_STATES.COOLDOWN,
    cooldown: config.initialCooldown,
    hp: 0,
    maxHp: config.maxHp,
    cargoStore: createResourceStore(RESOURCE_TYPES.CRYSTAL, 0, { lockedType: true }),
  };
  return pad.exportShip;
}

export function landExportShip(game, pad) {
  const ship = ensureExportShipRuntime(game, pad);
  const config = getBuildingConfig('landingpad').exportShip;
  ship.state = EXPORT_SHIP_STATES.LANDED;
  ship.cooldown = 0;
  ship.hp = ship.maxHp = config.maxHp;
  discardStoredResource(ship.cargoStore, RESOURCE_TYPES.CRYSTAL);
  pad.landingFlash = 2.5;
  const callback = game?.services?.landingPads?.onShipLanded;
  if (typeof callback === 'function') callback(game, pad, { ship, attractRadius: config.attractRadius });
  return ship;
}

export function destroyExportShip(game, pad, context = {}) {
  const ship = ensureExportShipRuntime(game, pad);
  if (ship.state !== EXPORT_SHIP_STATES.LANDED) return { destroyed: false, cargoLost: 0 };
  const config = getBuildingConfig('landingpad').exportShip;
  const cargoLost = discardStoredResource(ship.cargoStore, RESOURCE_TYPES.CRYSTAL);
  ship.state = EXPORT_SHIP_STATES.COOLDOWN;
  ship.cooldown = config.cooldown;
  ship.hp = 0;
  const callback = game?.services?.landingPads?.onShipDestroyed;
  if (typeof callback === 'function') callback(game, pad, { ship, cargoLost, ...context });
  return { destroyed: true, cargoLost };
}

export function launchExportShip(game, pad) {
  const ship = ensureExportShipRuntime(game, pad);
  const config = getBuildingConfig('landingpad').exportShip;
  const loaded = getStoredResource(ship.cargoStore, RESOURCE_TYPES.CRYSTAL);
  if (ship.state !== EXPORT_SHIP_STATES.LANDED || loaded < config.capacity - 0.001) return { launched: false, gold: 0 };
  const sold = config.capacity;
  discardStoredResource(ship.cargoStore, RESOURCE_TYPES.CRYSTAL);
  const gold = Math.round(sold * Number(game?.config?.economy?.crystal?.goldPerExportedCrystal || 0));
  addResource(game, RESOURCE_TYPES.GOLD, gold);
  ship.state = EXPORT_SHIP_STATES.COOLDOWN;
  ship.cooldown = config.cooldown;
  ship.hp = 0;
  const callback = game?.services?.landingPads?.onShipLaunched;
  if (typeof callback === 'function') callback(game, pad, { ship, sold, gold });
  return { launched: true, sold, gold };
}

export function damageLandingPadOrShip(game, pad, amount, context = {}) {
  if (!pad || pad.type !== 'landingpad') return undefined;
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) return { applied: false, destroyed: false };
  const ship = ensureExportShipRuntime(game, pad);
  if (ship.state === EXPORT_SHIP_STATES.LANDED && Number(ship.hp) > 0) {
    const result = applyDamage(game, ship, value, { source: context.enemy || context.source, attackKind: context.attackKind || 'landing-pad-ship' });
    if (result.destroyed) destroyExportShip(game, pad, context);
    return { ...result, target: 'export-ship' };
  }
  return { ...applyDamage(game, pad, value, { source: context.enemy || context.source, attackKind: context.attackKind || 'landing-pad' }), target: 'landing-pad' };
}

export function updateLandingPads(game, dt) {
  const step = Math.max(0, Number(dt) || 0);
  let landed = 0, launched = 0, loaded = 0;
  for (const pad of game?.state?.entities?.structures || []) {
    if (pad.type !== 'landingpad' || !pad.built || Number(pad.hp) <= 0) continue;
    initializeBuildingRuntime(game, pad);
    const ship = ensureExportShipRuntime(game, pad);
    const config = getBuildingConfig('landingpad').exportShip;
    pad.landingFlash = Math.max(0, (Number(pad.landingFlash) || 0) - step);

    if (ship.state === EXPORT_SHIP_STATES.LANDED && Number(ship.hp) <= 0) {
      destroyExportShip(game, pad, { reason: 'hp-depleted' });
      continue;
    }

    if (ship.state === EXPORT_SHIP_STATES.COOLDOWN) {
      ship.cooldown = Math.max(0, Number(ship.cooldown) - step);
      if (ship.cooldown <= 0) {
        landExportShip(game, pad);
        landed++;
      }
    }

    if (ship.state === EXPORT_SHIP_STATES.LANDED) {
      const moved = transferResource({
        from: pad.resourceStore,
        to: ship.cargoStore,
        type: RESOURCE_TYPES.CRYSTAL,
        amount: config.loadRate * step,
        toCapacity: config.capacity,
      });
      loaded += moved;
      if (getStoredResource(ship.cargoStore, RESOURCE_TYPES.CRYSTAL) >= config.capacity - 0.001) {
        if (launchExportShip(game, pad).launched) launched++;
      }
    }
  }
  return { landed, launched, loaded };
}
