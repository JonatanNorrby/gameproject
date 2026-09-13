import { GAME_CONFIG } from './config.js';

function createModifierState() {
  // These multipliers exist in the current runtime and remain explicit state.
  return {
    soldierRate: 1,
    soldierDamage: 1,
    extraSoldiers: 0,
    unitMove: 1,
    laserRate: 1,
    laserDamage: 1,
    flameDamage: 1,
    burnDuration: 1,
    mineRate: 1,
    mineStorage: 1,
    truckCapacity: 1,
    truckHp: 1,
    crystalValue: 1,
  };
}

function createCommandState() {
  return {
    buildType: null,
    routeEditing: false,
    attachMode: false,
    platoonAttachMode: false,
    medicFollowAttachMode: false,
    apcSupportAttachMode: false,
    wall: {
      painting: false,
      path: [],
      cursor: null,
      reviewOpen: false,
    },
  };
}

function createUiState() {
  return {
    gameStarted: false,
    titleMenuOpen: true,
    titlePanel: null,
    commandMenuOpen: false,
    activeBuildTab: 'unitsMenu',
    message: 'Start with Gold, build Ore logistics for Metal, then use Metal for Crystal Mines and defenses.',
    options: {
      enemyArrows: true,
      unitArrows: true,
    },
  };
}

export function createInitialState({
  config = GAME_CONFIG,
  viewport = {
    width: config.viewport.width,
    height: config.viewport.height,
  },
  now = () => 0,
} = {}) {
  const baseX = config.world.width / 2;
  const baseY = config.world.height / 2;
  const zoom = config.camera.defaultZoom;

  return {
    session: {
      paused: true,
      choosing: false,
      gameOver: false,
      lastFrameTime: now(),
    },
    time: { elapsed: 0 },
    director: {
      hordeNumber: 0,
      queuedEnemies: 0,
      nextHordeIn: config.director.horde.firstDelay,
    },
    resources: {
      gold: config.game.startingGold,
      metal: config.game.startingMetal,
    },
    base: {
      x: baseX,
      y: baseY,
      radius: config.world.baseRadius,
      hp: config.game.startingBaseHp,
      maxHp: config.game.startingBaseHp,
    },
    entities: {
      units: [],
      enemies: [],
      structures: [],
      terrain: [],
      depots: [],
      rivers: [],
      projectiles: [],
      enemyProjectiles: [],
      particles: [],
      playerMines: [],
      effects: [],
      resourceCaches: [],
    },
    selection: {
      unitId: null,
      towerId: null,
      storageBuildingId: null,
    },
    commands: createCommandState(),
    view: {
      showReach: false,
      camera: {
        x: baseX - viewport.width / (2 * zoom),
        y: baseY - viewport.height / (2 * zoom),
        zoom,
        speed: config.camera.speed,
      },
    },
    ui: createUiState(),
    fog: {
      explored: null,
      visionSources: [],
    },
    debug: {
      unlimitedCash: false,
      unlimitedLives: false,
    },
    modifiers: createModifierState(),
  };
}

export function resetState(state, options = {}) {
  const fresh = createInitialState(options);
  for (const key of Object.keys(state)) delete state[key];
  Object.assign(state, fresh);
  return state;
}
