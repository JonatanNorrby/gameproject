import { assertKnown, deepFreeze } from '../utils/helpers.js';

export const UNIT_TYPES = Object.freeze({
  RIFLEMAN: 'rifleman',
  HEAVY_GUNNER: 'heavygunner',
  ROCKETEER: 'rocketeer',
  MEDIC: 'medic',
  ENGINEER: 'engineer',
  SCOUT: 'scout',
  SNIPER: 'sniper',
  FLAMETROOPER: 'flametrooper',
  SPOTTER: 'spotter',
  MINELAYER: 'minelayer',
  MECH: 'mech',
  COMBAT_DRONE: 'combatdrone',
  COMBAT_SHIP: 'combatship',
  TANK: 'tank',
  MOBILE_ARTILLERY: 'mobileartillery',
  REPAIR_VEHICLE: 'repairvehicle',
  APC: 'apc',
  MACHINEGUN_CAR: 'mgcar',
  TRUCK: 'truck',
});

// `soldier` remains a real legacy build/runtime identifier for the Rifleman.
// No other speculative aliases are retained.
export const UNIT_ALIASES = Object.freeze({
  soldier: UNIT_TYPES.RIFLEMAN,
});

const infantry = ['ground', 'infantry', 'healable', 'boardable', 'truckEscort', 'platoonCapable'];
const vehicle = ['ground', 'vehicle', 'mechanical', 'repairable', 'platoonCapable'];

function unit(id, displayName, values) {
  return {
    id,
    displayName,
    ...values,
    traits: [...new Set(values.traits || [])],
  };
}

export const UNIT_CONFIG = deepFreeze({
  rifleman: unit('rifleman', 'Rifleman Squad', {
    legacyBuildType: 'soldier', runtimeType: 'soldier', radius: 23,
    cost: { gold: 40 }, maxHp: 165, moveSpeed: 165, members: 6,
    combat: { range: 225, fireInterval: 0.50, damage: 1.55, bulletSpeed: 740, targeting: 'any' },
    traits: [...infantry, 'combat'],
  }),
  heavygunner: unit('heavygunner', 'Heavy Gunner', {
    runtimeType: 'soldier', radius: 24,
    cost: { gold: 75 }, maxHp: 220, moveSpeed: 155, members: 4,
    // The current runtime inherits Rifleman bullet speed because HEAVY_GUNNER has no separate value.
    combat: { range: 190, fireInterval: 0.20, damage: 1.10, bulletSpeed: 740, targeting: 'any' },
    traits: [...infantry, 'combat'],
  }),
  rocketeer: unit('rocketeer', 'Rocketeer Squad', {
    runtimeType: 'soldier', radius: 23,
    cost: { gold: 105 }, maxHp: 155, moveSpeed: 150, members: 3,
    combat: { range: 290, fireInterval: 2.20, damage: 13, splashRadius: 58, targeting: 'any' },
    traits: [...infantry, 'combat', 'splash'],
  }),
  medic: unit('medic', 'Medic Squad', {
    runtimeType: 'soldier', radius: 22,
    cost: { gold: 80 }, maxHp: 140, moveSpeed: 160, members: 3,
    healing: { range: 165, perSecond: 11 },
    traits: [...infantry, 'support', 'healer'],
  }),
  engineer: unit('engineer', 'Engineer Squad', {
    runtimeType: 'soldier', radius: 22,
    cost: { gold: 70 }, maxHp: 150, moveSpeed: 165, members: 3,
    repair: { range: 120, perSecond: 18 }, constructionBonus: 0.40,
    traits: [...infantry, 'support', 'repairer', 'builder'],
  }),
  scout: unit('scout', 'Scout Squad', {
    runtimeType: 'soldier', radius: 21,
    cost: { gold: 55 }, maxHp: 105, moveSpeed: 245, members: 4,
    combat: { range: 205, fireInterval: 0.42, damage: 1.25, bulletSpeed: 820, targeting: 'any' },
    mark: { duration: 2.2, damageMultiplier: 1.15 }, detectionRange: 360,
    traits: [...infantry, 'combat', 'detector', 'marker'],
  }),
  sniper: unit('sniper', 'Sniper Squad', {
    runtimeType: 'soldier', radius: 21,
    cost: { gold: 95 }, maxHp: 112, moveSpeed: 145, members: 2,
    combat: { range: 445, fireInterval: 2.05, damage: 27, bulletSpeed: 1200, targeting: 'any' },
    traits: [...infantry, 'combat'],
  }),
  flametrooper: unit('flametrooper', 'Flamethrower Troopers', {
    runtimeType: 'soldier', radius: 22,
    cost: { gold: 90 }, maxHp: 175, moveSpeed: 145, members: 4,
    combat: { range: 130, fireInterval: 0.18, directDamage: 1.5, targets: 3, burnDuration: 2.4, targeting: 'any' },
    traits: [...infantry, 'combat', 'burn'],
  }),
  spotter: unit('spotter', 'Sneaky Spotter Squad', {
    runtimeType: 'soldier', radius: 21,
    cost: { gold: 95 }, maxHp: 90, moveSpeed: 175, members: 3,
    spotting: { range: 375, markDamageMultiplier: 1.20, refresh: 0.32 },
    traits: [...infantry, 'support', 'stealth', 'marker'],
  }),
  minelayer: unit('minelayer', 'Mine Layer Squad', {
    runtimeType: 'soldier', radius: 23,
    cost: { gold: 110 }, maxHp: 190, moveSpeed: 155, members: 3,
    mines: { goldCost: 18, maxActive: 10, damage: 95, splashRadius: 58, triggerRadius: 25, targeting: 'ground' },
    traits: [...infantry, 'support', 'mineLayer'],
  }),
  mech: unit('mech', 'Combat Mech', {
    runtimeType: 'soldier', radius: 29,
    cost: { gold: 300 }, maxHp: 680, moveSpeed: 105, barrels: 2,
    combat: { range: 270, fireInterval: 0.24, damage: 8.5, bulletSpeed: 880, targeting: 'any' },
    traits: [...vehicle, 'mech', 'combat'],
  }),
  combatdrone: unit('combatdrone', 'Combat Drone', {
    runtimeType: 'airunit', radius: 16,
    cost: { gold: 80 }, maxHp: 95, moveSpeed: 245,
    combat: { range: 225, fireInterval: 0.38, damage: 4.3, bulletSpeed: 920, targeting: 'any' },
    traits: ['air', 'aircraft', 'mechanical', 'repairable', 'platoonCapable', 'combat', 'drone'],
  }),
  combatship: unit('combatship', 'Combat Ship', {
    runtimeType: 'airunit', radius: 27,
    cost: { gold: 420 }, maxHp: 420, moveSpeed: 145, maxActive: 1,
    combat: { range: 335, fireInterval: 1.05, damage: 22, splashRadius: 34, targeting: 'any' },
    traits: ['air', 'aircraft', 'mechanical', 'repairable', 'platoonCapable', 'combat', 'ship', 'splash'],
  }),
  tank: unit('tank', 'Tank', {
    runtimeType: 'soldier', radius: 29,
    cost: { gold: 260 }, maxHp: 640, moveSpeed: 92,
    combat: { range: 255, fireInterval: 0.82, damage: 34, splashRadius: 30, bulletSpeed: 760, targeting: 'any' },
    traits: [...vehicle, 'combat', 'splash'],
  }),
  mobileartillery: unit('mobileartillery', 'Mobile Artillery', {
    runtimeType: 'soldier', radius: 28,
    cost: { gold: 240 }, maxHp: 285, moveSpeed: 96,
    combat: { range: 540, minRange: 125, fireInterval: 2.45, damage: 62, splashRadius: 76, targeting: 'ground' },
    traits: [...vehicle, 'combat', 'artillery', 'splash'],
  }),
  repairvehicle: unit('repairvehicle', 'Repair Vehicle', {
    runtimeType: 'soldier', radius: 27,
    cost: { gold: 155 }, maxHp: 330, moveSpeed: 138,
    repair: { range: 150, perSecond: 34 },
    traits: [...vehicle, 'support', 'repairer'],
  }),
  apc: unit('apc', 'APC', {
    runtimeType: 'soldier', radius: 30,
    cost: { gold: 190 }, maxHp: 520, moveSpeed: 172,
    combat: { range: 185, fireInterval: 0.23, damage: 3.2, bulletSpeed: 820, targeting: 'any' },
    transport: { loadRange: 105, unloadDistance: 56, capacity: 1 },
    traits: [...vehicle, 'combat', 'support', 'transport'],
  }),
  mgcar: unit('mgcar', 'Machinegun Car', {
    runtimeType: 'soldier', radius: 24,
    cost: { gold: 125 }, maxHp: 245, moveSpeed: 215, members: 1,
    combat: { range: 215, fireInterval: 0.16, damage: 3.0, bulletSpeed: 930, targeting: 'any' },
    traits: [...vehicle, 'combat'],
  }),
  truck: unit('truck', 'Logistics Truck', {
    runtimeType: 'truck', radius: 24,
    cost: { gold: 70 }, maxHp: 135, moveSpeed: 185,
    logistics: { capacity: 45, pickupRange: 100, unloadRange: 100 },
    traits: [...vehicle, 'support', 'logistics'],
  }),
});

export function normalizeUnitType(type) {
  if (typeof type !== 'string') return type;
  return UNIT_ALIASES[type] ?? type;
}

export function getUnitConfig(type) {
  return assertKnown(UNIT_CONFIG, normalizeUnitType(type), 'unit type');
}

export function hasUnitTrait(typeOrUnit, trait) {
  const type = typeof typeOrUnit === 'string'
    ? normalizeUnitType(typeOrUnit)
    : normalizeUnitType(typeOrUnit?.role || typeOrUnit?.type);
  return Boolean(UNIT_CONFIG[type]?.traits.includes(trait));
}
