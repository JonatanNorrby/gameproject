import { ECONOMY_CONFIG } from '../economy/economyConfig.js';
import { assertKnown, deepFreeze } from '../utils/helpers.js';

export const BUILDING_TYPES = Object.freeze({
  BASE: 'base',
  CRYSTAL_MINE: 'mine',
  ORE_MINE: 'oremine',
  REFINERY: 'refinery',
  LANDING_PAD: 'landingpad',
  WALL: 'wall',
  BUNKER: 'bunker',
  SAFE_SPOT: 'safespot',
  BLOCKADE: 'blockade',
});

function building(id, displayName, values) {
  return { id, displayName, enabled: true, ...values, traits: [...new Set(values.traits || [])] };
}

export const BUILDING_CONFIG = deepFreeze({
  base: building('base', 'Main Base', {
    cost: null, maxHp: 300, collisionRadius: 68, placementRadius: 68,
    traits: ['building', 'base'],
  }),
  mine: building('mine', 'Crystal Mine', {
    cost: { metal: ECONOMY_CONFIG.crystal.mineCost }, maxHp: ECONOMY_CONFIG.crystal.mineHp,
    placementRadius: 34, collisionRadius: 30, buildTime: 7.0,
    storageCapacity: ECONOMY_CONFIG.crystal.mineStorage,
    productionRate: ECONOMY_CONFIG.crystal.mineRate,
    maxPerDepot: ECONOMY_CONFIG.crystal.maxMinesPerDepot,
    placement: { resourceDepot: 'crystal' },
    traits: ['building', 'economy', 'mine', 'crystal'],
  }),
  oremine: building('oremine', 'Ore Mine', {
    cost: { gold: ECONOMY_CONFIG.ore.mineCost }, maxHp: ECONOMY_CONFIG.ore.mineHp,
    placementRadius: 34, collisionRadius: 30, buildTime: 7.0,
    storageCapacity: ECONOMY_CONFIG.ore.mineStorage,
    productionRate: ECONOMY_CONFIG.ore.mineRate,
    maxPerDepot: ECONOMY_CONFIG.ore.maxMinesPerDepot,
    placement: { resourceDepot: 'ore' },
    traits: ['building', 'economy', 'mine', 'ore'],
  }),
  refinery: building('refinery', 'Refinery', {
    cost: { gold: ECONOMY_CONFIG.refinery.cost }, maxHp: ECONOMY_CONFIG.refinery.hp,
    placementRadius: 38, collisionRadius: 38, buildTime: 9.0,
    storage: {
      levels: ECONOMY_CONFIG.refinery.storageLevels,
      upgradeCosts: ECONOMY_CONFIG.refinery.storageUpgradeCosts.map(gold => ({ gold })),
    },
    refineRate: ECONOMY_CONFIG.refinery.refineRate,
    metalPerOre: ECONOMY_CONFIG.refinery.metalPerOre,
    unloadRange: ECONOMY_CONFIG.refinery.unloadRange,
    traits: ['building', 'economy', 'storage', 'refinery'],
  }),
  landingpad: building('landingpad', 'Landing Pad', {
    cost: { gold: ECONOMY_CONFIG.landingPad.cost }, maxHp: ECONOMY_CONFIG.landingPad.hp,
    placementRadius: 48, collisionRadius: 48, buildTime: 12.0,
    storage: {
      levels: ECONOMY_CONFIG.landingPad.storageLevels,
      upgradeCosts: ECONOMY_CONFIG.landingPad.storageUpgradeCosts.map(gold => ({ gold })),
    },
    truckUnloadRange: ECONOMY_CONFIG.landingPad.truckUnloadRange,
    exportShip: {
      capacity: ECONOMY_CONFIG.landingPad.shipCapacity,
      cooldown: ECONOMY_CONFIG.landingPad.cooldown,
      initialCooldown: ECONOMY_CONFIG.landingPad.initialCooldown,
      attractRadius: ECONOMY_CONFIG.landingPad.attractRadius,
      maxHp: ECONOMY_CONFIG.landingPad.shipHp,
      loadRate: ECONOMY_CONFIG.landingPad.shipLoadRate,
    },
    traits: ['building', 'economy', 'storage', 'export'],
  }),
  wall: building('wall', 'Wall', {
    cost: { metalPer100: 11 }, maxHp: null,
    placementRadius: 6, collisionRadius: 10,
    wall: {
      hpPer100: 320,
      thickness: 12,
      minLength: 35,
      maxLength: 850,
      maxPathLength: 1500,
      paintPointSpacing: 45,
      baseBuildTime: 1.5,
      buildTimePer100: 1.15,
    },
    traits: ['building', 'wall', 'segment'],
  }),
  bunker: building('bunker', 'Bunker', {
    enabled: false,
    disabledReason: 'removed by the active v47 consolidated runtime',
    cost: { gold: 220 }, maxHp: 650, placementRadius: 35, collisionRadius: 35, buildTime: 8.5,
    garrison: { range: 90, rangeMultiplier: 1.28, damageMultiplier: 1.35 },
    traits: ['building', 'disabled', 'legacy', 'bunker'],
  }),
  safespot: building('safespot', 'Tower Safe Spot', {
    enabled: false,
    disabledReason: 'removed from build/select/render behavior by v21',
    cost: { gold: 50 }, maxHp: 180, placementRadius: 31, collisionRadius: 31, buildTime: 3.5,
    placementClearance: 50,
    traits: ['building', 'disabled', 'legacy'],
  }),
  blockade: building('blockade', 'Blockade', {
    enabled: false,
    disabledReason: 'replaced by variable-length Wall in v15',
    cost: { gold: 22 }, maxHp: 420, placementRadius: 42, collisionRadius: 42, buildTime: 3.0,
    footprint: { width: 78, height: 22 },
    traits: ['building', 'disabled', 'legacy'],
  }),
});

export function normalizeBuildingType(type) {
  return type;
}

export function getBuildingConfig(type) {
  return assertKnown(BUILDING_CONFIG, normalizeBuildingType(type), 'building type');
}

export function getBuildingRadius(typeOrBuilding) {
  const type = typeof typeOrBuilding === 'string' ? typeOrBuilding : typeOrBuilding?.type;
  return getBuildingConfig(type).collisionRadius;
}

export function wallCost(length) {
  return Math.max(1, Math.ceil(length / 100 * BUILDING_CONFIG.wall.cost.metalPer100));
}

export function wallBuildTime(length) {
  const w = BUILDING_CONFIG.wall.wall;
  return w.baseBuildTime + length / 100 * w.buildTimePer100;
}

export function wallHp(length) {
  return Math.max(1, Math.round(length / 100 * BUILDING_CONFIG.wall.wall.hpPer100));
}
