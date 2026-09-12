import { assertKnown, deepFreeze } from '../utils/helpers.js';

export const ENEMY_TYPES = Object.freeze({
  RAVAGER: 'ravager',
  SWARM: 'swarm',
  RUNNER: 'runner',
  BRUTE: 'brute',
  SPITTER: 'spitter',
  FLYER: 'flyer',
  SIEGE_BEAST: 'siegebeast',
  BURROWER: 'burrower',
  CLIMBER: 'climber',
  ACID_LOBBER: 'acidlobber',
  CRUSHER: 'crusher',
  HARVESTER_HUNTER: 'harvesterhunter',
  SABOTEUR: 'saboteur',
});

const H = Object.freeze({
  common: { hp: 0.58, damage: 0.55 },
  climberHunter: { hp: 0.62, damage: 0.58 },
  rangedLight: { hp: 0.68, damage: 0.60 },
  brute: { hp: 0.72, damage: 0.64 },
  acid: { hp: 0.76, damage: 0.66 },
  crusher: { hp: 0.80, damage: 0.68 },
  siege: { hp: 0.86, damage: 0.72 },
});

function enemy(id, displayName, values) {
  return {
    id,
    displayName,
    ...values,
    traits: [...new Set(values.traits || [])],
  };
}

export const ENEMY_CONFIG = deepFreeze({
  ravager: enemy('ravager', 'Ravager', {
    movement: 'ground', radius: 6, baseHp: 6, hpPerLevel: 0.55,
    baseSpeed: 70, speedPerLevel: 0.8, baseDamage: 1.5, bountyGold: 0.30,
    spawn: { enabled: true, commonWeight: 0.60 }, horde: H.common,
    traits: ['ground', 'melee'],
  }),
  swarm: enemy('swarm', 'Swarm', {
    movement: 'ground', radius: 4.7, baseHp: 3.5, hpPerLevel: 0.35,
    baseSpeed: 78, speedPerLevel: 1.0, baseDamage: 1, bountyGold: 0.20,
    spawn: { enabled: false, reason: 'not selected by the current v24 spawnEnemy implementation' }, horde: H.common,
    traits: ['ground', 'melee', 'swarm'],
  }),
  runner: enemy('runner', 'Runner', {
    movement: 'ground', radius: 6.2, baseHp: 5.5, hpPerLevel: 0.5,
    baseSpeed: 108, speedPerLevel: 1.3, baseDamage: 2, bountyGold: 0.35,
    spawn: { enabled: true, commonWeight: 0.27 }, horde: H.common,
    traits: ['ground', 'melee', 'fast'],
  }),
  brute: enemy('brute', 'Brute', {
    movement: 'ground', radius: 14, baseHp: 34, hpPerLevel: 3.2,
    baseSpeed: 36, speedPerLevel: 0.5, baseDamage: 8, bountyGold: 1.25,
    spawn: { enabled: true, commonWeight: 0.13 }, horde: H.brute,
    traits: ['ground', 'melee', 'tank'],
  }),
  spitter: enemy('spitter', 'Spitter', {
    legacyConfigKey: 'RANGED_ALIEN', movement: 'ground', radius: 10,
    baseHp: 18, hpPerLevel: 1.5, baseSpeed: 40, speedPerLevel: 0.4,
    baseDamage: 3, bountyGold: 0.65,
    rangedAttack: { range: 195, damage: 7, fireInterval: 1.8, projectileSpeed: 285 },
    spawn: { enabled: true, configuredChance: 0.03, hordeChance: 0.03 }, horde: H.rangedLight,
    traits: ['ground', 'ranged'],
  }),
  flyer: enemy('flyer', 'Flyer', {
    movement: 'air', radius: 9, baseHp: 13, hpPerLevel: 1.0,
    baseSpeed: 92, speedPerLevel: 0.8, baseDamage: 4, bountyGold: 0.75,
    spawn: { enabled: true, startAfterSeconds: 35, configuredChance: 0.10, hordeChance: 0.06 }, horde: H.rangedLight,
    traits: ['air', 'flying', 'melee'],
  }),
  siegebeast: enemy('siegebeast', 'Siege Beast', {
    movement: 'ground', radius: 20, baseHp: 175, hpPerLevel: 16,
    baseSpeed: 24, speedPerLevel: 0.25, baseDamage: 24, bountyGold: 4.0,
    wallDamageMultiplier: 2.2,
    spawn: { enabled: true, startAfterSeconds: 120, specialWeight: 0.7 }, horde: H.siege,
    traits: ['ground', 'melee', 'wallBreaker', 'structurePriority'],
  }),
  burrower: enemy('burrower', 'Burrower', {
    movement: 'ground', radius: 9, baseHp: 19, hpPerLevel: 1.6,
    baseSpeed: 58, speedPerLevel: 0.55, baseDamage: 5, bountyGold: 1.0,
    burrow: { distance: 155, time: 0.75, cooldown: 8 },
    spawn: { enabled: true, startAfterSeconds: 85, specialWeight: 1.0 }, horde: H.rangedLight,
    traits: ['ground', 'melee', 'burrower', 'wallBypass'],
  }),
  climber: enemy('climber', 'Climber', {
    movement: 'ground', radius: 7, baseHp: 10, hpPerLevel: 0.8,
    baseSpeed: 82, speedPerLevel: 0.8, baseDamage: 3, bountyGold: 0.55,
    climb: { speedFactor: 0.32, vulnerabilityMultiplier: 1.55 },
    spawn: { enabled: true, startAfterSeconds: 65, specialWeight: 1.25 }, horde: H.climberHunter,
    traits: ['ground', 'melee', 'climber', 'wallBypass'],
  }),
  acidlobber: enemy('acidlobber', 'Acid Lobber', {
    movement: 'ground', radius: 11, baseHp: 27, hpPerLevel: 2.2,
    baseSpeed: 34, speedPerLevel: 0.35, baseDamage: 4, bountyGold: 1.4,
    // v47 mutates the configured 9 damage once by 0.70 at install time.
    acidAttack: { range: 285, damage: 6.3, fireInterval: 2.7, acidDuration: 6, armorDamageMultiplier: 1.4 },
    spawn: { enabled: true, startAfterSeconds: 105, specialWeight: 0.85 }, horde: H.acid,
    traits: ['ground', 'ranged', 'structurePriority', 'armorCorrosion'],
  }),
  crusher: enemy('crusher', 'Crusher', {
    movement: 'ground', radius: 15, baseHp: 72, hpPerLevel: 6.0,
    baseSpeed: 40, speedPerLevel: 0.4, baseDamage: 9, bountyGold: 2.4,
    // v47 mutates the configured 145 charge damage once by 0.72 at install time.
    charge: { scanRange: 300, speedMultiplier: 3.4, windup: 1.15, damage: 104.4, cooldown: 8 },
    spawn: { enabled: true, startAfterSeconds: 135, specialWeight: 0.7 }, horde: H.crusher,
    traits: ['ground', 'melee', 'wallBreaker', 'charger'],
  }),
  harvesterhunter: enemy('harvesterhunter', 'Harvester Hunter', {
    movement: 'ground', radius: 8, baseHp: 13, hpPerLevel: 0.9,
    baseSpeed: 122, speedPerLevel: 1.0, baseDamage: 6, bountyGold: 0.85,
    spawn: { enabled: true, startAfterSeconds: 70, specialWeight: 1.15 }, horde: H.climberHunter,
    traits: ['ground', 'melee', 'logisticsHunter', 'economyPriority'],
  }),
  saboteur: enemy('saboteur', 'Saboteur', {
    movement: 'ground', radius: 8, baseHp: 20, hpPerLevel: 1.5,
    baseSpeed: 74, speedPerLevel: 0.65, baseDamage: 10, bountyGold: 1.25,
    stealth: { revealRange: 145 },
    spawn: { enabled: true, startAfterSeconds: 145, specialWeight: 0.65 }, horde: H.rangedLight,
    traits: ['ground', 'melee', 'stealth', 'economyPriority', 'structurePriority'],
  }),
});

export function normalizeEnemyType(type) {
  return type;
}

export function getEnemyConfig(type) {
  return assertKnown(ENEMY_CONFIG, normalizeEnemyType(type), 'enemy type');
}

export function hasEnemyTrait(typeOrEnemy, trait) {
  const type = typeof typeOrEnemy === 'string' ? typeOrEnemy : typeOrEnemy?.type;
  return Boolean(ENEMY_CONFIG[type]?.traits.includes(trait));
}

export function enemyHpAtLevel(type, level, { horde = true } = {}) {
  const config = getEnemyConfig(type);
  const base = config.baseHp + level * config.hpPerLevel;
  return horde ? Math.max(1, base * config.horde.hp) : base;
}

export function enemySpeedAtLevel(type, level, enemySpeedMultiplier = 0.30) {
  const config = getEnemyConfig(type);
  return (config.baseSpeed + level * config.speedPerLevel) * enemySpeedMultiplier;
}

export function enemyContactDamage(type, { horde = true } = {}) {
  const config = getEnemyConfig(type);
  return horde ? Math.max(0.2, config.baseDamage * config.horde.damage) : config.baseDamage;
}
