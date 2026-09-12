import { BUILDING_CONFIG } from '../buildings/buildingConfig.js';
import { ECONOMY_CONFIG } from '../economy/economyConfig.js';
import { ENEMY_CONFIG } from '../enemies/enemyConfig.js';
import { TOWER_CONFIG } from '../towers/towerConfig.js';
import { UNIT_CONFIG } from '../units/unitConfig.js';
import { deepFreeze } from '../utils/helpers.js';

export const MIGRATION_STATUS = Object.freeze({
  NOT_STARTED: 'NOT STARTED',
  SKELETON_CREATED: 'SKELETON CREATED',
  PARTIALLY_MIGRATED: 'PARTIALLY MIGRATED',
  MIGRATED: 'MIGRATED',
});

// Game-wide values are the final effective values after the currently loaded
// legacy scripts execute. System-specific balance lives in its registry module.
export const GAME_CONFIG = deepFreeze({
  game: {
    startingGold: 125,
    startingMetal: 0,
    startingBaseHp: 300,
  },
  workers: { count: 3 },
  world: {
    width: 10120,
    height: 7590,
    baseRadius: 68,
    baseBuildClearance: 2,
    baseTerrainClearance: 210,
  },
  viewport: {
    width: 1280,
    height: 800,
  },
  camera: {
    speed: 1200,
    minZoom: 0.18,
    maxZoom: 1.35,
    zoomStep: 0.10,
    defaultZoom: 0.65,
  },
  pathfinding: {
    cellSize: 48,
    maxVisited: 50000,
    maxOpenDetourAngle: 0.78,
  },
  terrain: {
    featureCount: 16,
    minRadiusX: 85,
    maxRadiusX: 175,
    minRadiusY: 60,
    maxRadiusY: 135,
    featureSeparation: 45,
    buildClearance: 2,
    enemySteerStrength: 245,
  },
  rivers: {
    count: 2,
    minWidth: 72,
    maxWidth: 105,
    slowFactor: 0.50,
    horizontalCenters: [0.27, 0.73],
    centerJitterWorldHeightFraction: 0.035,
  },
  fog: {
    cellSize: 96,
    explorationRefreshMs: 120,
    baseVision: 390,
    unitVision: {
      scout: 460,
      spotter: 440,
      sniper: 520,
      flying: 350,
      groundMinimum: 250,
      weaponRangePadding: 65,
    },
    structureVision: {
      towerMinimum: 265,
      towerRangePadding: 55,
      landingPad: 330,
      refinery: 275,
      mine: 210,
      other: 225,
      wall: 0,
      bunker: 0,
    },
  },
  director: {
    enemySpeedMultiplier: 0.30,
    configuredSpecialSelection: { baseChance: 0.08, maxChance: 0.36, rampSeconds: 600 },
    horde: {
      firstDelay: 26,
      baseGap: 48,
      minGap: 36,
      gapDropPerMinute: 1.2,
      startSize: 34,
      sizePerMinute: 6,
      baseMaxSize: 100,
      maxSize: 220,
      batchSize: 5,
      batchInterval: 0.50,
      startRadius: 1500,
      maxRadius: 2350,
      radiusGrowthPerSecond: 0.85,
      arc: 0.62,
      radialJitter: 300,
      spawnCaps: {
        specialBaseChance: 0.05,
        specialMaxChance: 0.18,
        flyerChance: 0.06,
        spitterChance: 0.03,
        specialRampSeconds: 600,
      },
    },
  },
  resourceCaches: {
    count: 6,
    radius: 30,
    captureRadius: 96,
    captureSeconds: 4.5,
    activationRadius: 620,
    guardAggroRadius: 520,
    guardLeashRadius: 680,
    contestRadius: 145,
    minBaseDistance: 760,
    maxBaseDistance: 2850,
    separation: 760,
  },
  towerDurability: {
    enemyMeleeAttackRange: 20,
    enemyMeleeAggroRange: 105,
    enemyMeleeDamageMultiplier: 1.0,
  },
});

export const CONFIG_OWNERSHIP = Object.freeze({
  game: 'js/core/config.js',
  units: 'js/units/unitConfig.js',
  enemies: 'js/enemies/enemyConfig.js',
  towers: 'js/towers/towerConfig.js',
  buildings: 'js/buildings/buildingConfig.js',
  economy: 'js/economy/economyConfig.js',
  entityClassification: 'js/core/entities.js',
  entityIds: 'js/core/ids.js',
  math: 'js/utils/math.js',
  geometry: 'js/utils/geometry.js',
  validation: 'js/core/validation.js',
  parity: 'js/core/parity.js',
});

export const CLEAN_CONFIG = deepFreeze({
  ...GAME_CONFIG,
  economy: ECONOMY_CONFIG,
  units: UNIT_CONFIG,
  enemies: ENEMY_CONFIG,
  towers: TOWER_CONFIG,
  buildings: BUILDING_CONFIG,
});

export function createGameConfig() {
  return CLEAN_CONFIG;
}
