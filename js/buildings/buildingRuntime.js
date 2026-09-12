import { BUILDING_CONFIG, getBuildingConfig } from './buildingConfig.js';
import { createResourceStore, RESOURCE_TYPES, spendResources } from '../economy/resources.js';
import { getUnitRole } from '../core/entities.js';
import { getUnitConfig } from '../units/unitConfig.js';

function serviceId(game, type) {
  const external = game?.services?.buildings?.createBuildingId;
  if (typeof external === 'function') return external(type, game);
  const now = typeof game?.services?.now === 'function' ? game.services.now() : Date.now();
  const random = typeof game?.services?.random === 'function' ? game.services.random() : Math.random();
  return `s${now}-${type}-${String(random).replace('.', '')}`;
}

function bindAmountAlias(target, key, store) {
  const descriptor = Object.getOwnPropertyDescriptor(target, key);
  if (descriptor?.get && descriptor?.set) return;
  Object.defineProperty(target, key, {
    configurable: true,
    enumerable: true,
    get: () => store.amount,
    set: value => { store.amount = Math.max(0, Number(value) || 0); },
  });
}

function legacyStoredAmount(building, type) {
  if (type === RESOURCE_TYPES.CRYSTAL) return Number(building?.crystalStored ?? building?.stored) || 0;
  if (type === RESOURCE_TYPES.ORE) return Number(building?.oreStored ?? building?.stored) || 0;
  return 0;
}

export function ensureMainBaseRuntime(game) {
  const base = game?.state?.base;
  if (!base) throw new TypeError('Game base state is required');
  const config = BUILDING_CONFIG.base;
  base.id = base.id || 'base';
  base.type = 'base';
  base.built = true;
  base.maxHp = Number(base.maxHp) || config.maxHp;
  base.hp = Number.isFinite(Number(base.hp)) ? Number(base.hp) : base.maxHp;
  base.radius = Number(base.radius) || config.collisionRadius;
  return base;
}

export function getStorageLevel(building) {
  return Math.max(1, Math.min(3, Math.floor(Number(building?.storageLevel) || 1)));
}

export function getStorageCapacity(building) {
  const definition = building ? getBuildingConfig(building.type) : null;
  const levels = definition?.storage?.levels;
  if (!Array.isArray(levels) || !levels.length) return 0;
  return Number(levels[getStorageLevel(building) - 1]) || 0;
}

export function getStorageUpgradeCost(building) {
  if (!building) return null;
  const definition = getBuildingConfig(building.type);
  const current = getStorageLevel(building);
  if (current >= 3) return null;
  const costs = definition?.storage?.upgradeCosts;
  return costs?.[current] || null;
}

export function upgradeBuildingStorage(game, building) {
  const cost = getStorageUpgradeCost(building);
  if (!cost) return { ok: false, reason: 'max-level', level: getStorageLevel(building) };
  if (!spendResources(game, cost)) return { ok: false, reason: 'cannot-afford', cost };
  building.storageLevel = getStorageLevel(building) + 1;
  return { ok: true, level: building.storageLevel, capacity: getStorageCapacity(building), cost };
}

export function initializeBuildingRuntime(game, building) {
  if (!building?.type) throw new TypeError('Building type is required');
  const definition = getBuildingConfig(building.type);
  if (definition.enabled === false) return building;
  building.id = building.id || serviceId(game, building.type);
  building.maxHp = Number(building.maxHp) || Number(definition.maxHp) || 1;
  building.hp = Number.isFinite(Number(building.hp)) ? Number(building.hp) : building.maxHp;
  building.built = building.built !== false;
  building.cool = Number(building.cool) || 0;
  building.protected = Boolean(building.protected);

  if (building.type === 'mine' || building.type === 'oremine') {
    const type = building.type === 'mine' ? RESOURCE_TYPES.CRYSTAL : RESOURCE_TYPES.ORE;
    building.resourceStore ||= createResourceStore(type, legacyStoredAmount(building, type), { lockedType: true });
    bindAmountAlias(building, 'stored', building.resourceStore);
  } else if (building.type === 'refinery') {
    building.storageLevel = getStorageLevel(building);
    building.resourceStore ||= createResourceStore(RESOURCE_TYPES.ORE, legacyStoredAmount(building, RESOURCE_TYPES.ORE), { lockedType: true });
    bindAmountAlias(building, 'oreStored', building.resourceStore);
  } else if (building.type === 'landingpad') {
    building.storageLevel = getStorageLevel(building);
    building.resourceStore ||= createResourceStore(RESOURCE_TYPES.CRYSTAL, legacyStoredAmount(building, RESOURCE_TYPES.CRYSTAL), { lockedType: true });
    bindAmountAlias(building, 'crystalStored', building.resourceStore);
    const shipConfig = definition.exportShip;
    if (!building.exportShip) {
      const legacyState = building.shipState === 'landed' ? 'landed' : 'cooldown';
      building.exportShip = {
        state: legacyState,
        cooldown: Number.isFinite(Number(building.shipCooldown)) ? Math.max(0, Number(building.shipCooldown)) : shipConfig.initialCooldown,
        hp: legacyState === 'landed' ? Math.max(0, Number(building.shipHp) || 0) : 0,
        maxHp: Number(building.shipMaxHp) || shipConfig.maxHp,
        cargoStore: createResourceStore(RESOURCE_TYPES.CRYSTAL, Number(building.shipCargo) || 0, { lockedType: true }),
      };
    }
    building.landingFlash = Math.max(0, Number(building.landingFlash) || 0);
  }
  return building;
}

export function createBuildingRuntime(game, type, options = {}) {
  const definition = getBuildingConfig(type);
  if (definition.enabled === false) return { ok: false, reason: 'building-disabled', type, disabledReason: definition.disabledReason };
  if (type === 'base') return { ok: true, building: ensureMainBaseRuntime(game) };
  const building = {
    id: options.id || serviceId(game, type),
    type,
    x: Number(options.x) || 0,
    y: Number(options.y) || 0,
    hp: Number.isFinite(Number(options.hp)) ? Number(options.hp) : definition.maxHp,
    maxHp: Number(options.maxHp) || definition.maxHp,
    built: options.built !== undefined ? Boolean(options.built) : false,
    buildTime: Number(definition.buildTime) || 0,
    buildRemaining: options.built === true ? 0 : Number(options.buildRemaining ?? definition.buildTime) || 0,
    cool: Number(options.cool) || 0,
    protected: false,
    safeSpotId: null,
    ...options.extra,
  };
  if (type === 'mine' || type === 'oremine') {
    building.depotId = options.depotId ?? null;
    building.mineSlot = Number.isFinite(Number(options.mineSlot)) ? Number(options.mineSlot) : 0;
    building.stored = Number(options.stored) || 0;
  } else if (type === 'refinery') {
    building.storageLevel = Number(options.storageLevel) || 1;
    building.oreStored = Number(options.oreStored) || 0;
  } else if (type === 'landingpad') {
    building.storageLevel = Number(options.storageLevel) || 1;
    building.crystalStored = Number(options.crystalStored) || 0;
  }
  initializeBuildingRuntime(game, building);
  return { ok: true, building };
}

export function getBuildingCost(type) {
  const cost = getBuildingConfig(type).cost;
  return cost && typeof cost === 'object' ? { ...cost } : cost;
}

export function spendForBuilding(game, type) {
  const cost = getBuildingCost(type);
  if (!cost || typeof cost !== 'object') return false;
  return spendResources(game, cost);
}

const ECONOMIC_BUILDING_TYPES = new Set(['mine', 'oremine', 'refinery', 'landingpad']);

export function updateEconomicBuildingConstruction(game, dt) {
  const step = Math.max(0, Number(dt) || 0);
  if (step <= 0) return 0;
  const structures = (game?.state?.entities?.structures || []).filter(building => (
    ECONOMIC_BUILDING_TYPES.has(building.type) && building.built === false && Number(building.hp) > 0
  ));
  if (!structures.length) return 0;

  for (const building of structures) {
    building.buildRemaining = Math.max(0, (Number(building.buildRemaining) || 0) - step);
    if (building.buildRemaining <= 0) building.built = true;
  }

  const groups = new Map();
  for (const building of structures) {
    if (building.built) continue;
    const key = building.groupId || building.id;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(building);
  }
  const engineer = getUnitConfig('engineer');
  const engineers = (game?.state?.entities?.units || []).filter(unit => (
    getUnitRole(unit) === 'engineer' && Number(unit.hp) > 0 && !unit.garrisonedIn
  ));
  let completed = structures.filter(building => building.built).length;
  for (const items of groups.values()) {
    let count = 0;
    for (const unit of engineers) {
      if (items.some(building => Math.hypot(unit.x - building.x, unit.y - building.y) <= engineer.repair.range)) {
        count++;
        if (count >= 2) break;
      }
    }
    if (!count) continue;
    const remaining = Math.max(0, (Number(items[0].buildRemaining) || 0) - step * Number(engineer.constructionBonus) * count);
    for (const building of items) {
      building.buildRemaining = remaining;
      if (remaining <= 0) building.built = true;
    }
    if (remaining <= 0) completed += items.length;
  }
  if (completed > 0) {
    const callback = game?.services?.buildings?.onConstructionComplete;
    if (typeof callback === 'function') {
      for (const building of structures) if (building.built) callback(game, building);
    }
  }
  return completed;
}
