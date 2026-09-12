import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ENEMY_CONFIG,
  enemyContactDamage,
  enemyHpAtLevel,
  enemySpeedAtLevel,
} from '../js/enemies/enemyConfig.js';
import { ENEMY_AI_HANDLERS, assertEnemyAiCoverage, updateEnemyActor } from '../js/enemies/enemyAi.js';
import {
  baseHordeSize,
  chooseHordeEnemyType,
  currentHordeRadius,
  nextHordeGap,
  updateEnemyDirector,
} from '../js/enemies/enemyDirector.js';
import { cleanupDeadEnemies } from '../js/enemies/enemyLifecycle.js';
import { stepCacheGuard } from '../js/enemies/enemyMovement.js';
import { createEnemy, spawnEnemy } from '../js/enemies/enemySpawning.js';
import { tickEnemyStatuses } from '../js/enemies/enemyStatus.js';
import { findStrategicEnemyTarget } from '../js/enemies/enemyTargeting.js';
import { initializeEnemyRuntime, updateEnemies } from '../js/enemies/enemies.js';
import {
  generateResourceCaches,
  isCacheContested,
  nearestCacheCapturer,
  nearestGuardTarget,
  updateCacheCapture,
  updateCacheGuards,
} from '../js/enemies/resourceCaches.js';
import { isNavigationPointBlocked } from '../js/navigation/pathfinding.js';

const HORDE = {
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
};

function seededRandom(seed = 123456789) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function sequenceRandom(values, fallback = 0.5) {
  let index = 0;
  return () => index < values.length ? values[index++] : fallback;
}

function createGame({ elapsed = 0, random = seededRandom() } = {}) {
  const projectiles = [];
  return {
    config: {
      world: { width: 2200, height: 1800, baseRadius: 68 },
      pathfinding: { cellSize: 48, maxVisited: 50000, maxOpenDetourAngle: 0.78 },
      rivers: { slowFactor: 0.50 },
      towerDurability: {
        enemyMeleeAttackRange: 20,
        enemyMeleeAggroRange: 105,
        enemyMeleeDamageMultiplier: 1,
      },
      director: { enemySpeedMultiplier: 0.30, horde: HORDE },
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
        maxBaseDistance: 850,
        separation: 300,
      },
      buildings: { wall: { wall: { thickness: 12 } } },
    },
    state: {
      time: { elapsed },
      director: { hordeNumber: 0, queuedEnemies: 0, nextHordeIn: 26 },
      resources: { gold: 0, metal: 0 },
      base: { x: 1100, y: 900, radius: 68, hp: 300, maxHp: 300 },
      entities: {
        units: [], enemies: [], structures: [], terrain: [], depots: [], rivers: [],
        projectiles: [], enemyProjectiles: [], particles: [], playerMines: [], effects: [], resourceCaches: [],
      },
      debug: { unlimitedCash: false, unlimitedLives: false },
      modifiers: { flameDamage: 1 },
      enemyRuntime: { initialized: true },
    },
    services: {
      random,
      enemyCombat: {
        fireProjectile(_game, projectile) { projectiles.push(projectile); },
      },
      enemyLifecycle: {},
      resourceCaches: {},
    },
    testProjectiles: projectiles,
  };
}

function groundUnit(role = 'rifleman', x = 0, y = 0, hp = 100) {
  return { id: `u-${role}-${x}-${y}`, type: role === 'truck' ? 'truck' : 'soldier', role, x, y, hp, maxHp: hp };
}

function airUnit(role = 'combatdrone', x = 0, y = 0, hp = 100) {
  return { id: `u-${role}-${x}-${y}`, type: 'airunit', role, x, y, hp, maxHp: hp };
}

function wall(x, y1 = 0, y2 = 200, hp = 1000) {
  return { id: `w-${x}-${y1}`, type: 'wall', x, y: (y1 + y2) / 2, x1: x, y1, x2: x, y2, thickness: 12, built: true, hp, maxHp: hp };
}

function refinery(x, y, hp = 200) {
  return { id: `ref-${x}-${y}`, type: 'refinery', x, y, built: true, hp, maxHp: hp };
}

function nearly(actual, expected, epsilon = 1e-8) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);
}

test('all canonical enemies have one clean AI handler', () => {
  assert.equal(assertEnemyAiCoverage(ENEMY_CONFIG), true);
  assert.equal(Object.keys(ENEMY_AI_HANDLERS).length, Object.keys(ENEMY_CONFIG).length);
  assert.equal(Object.keys(ENEMY_CONFIG).length, 13);
});

test('current spawn roster keeps swarm compatibility-defined but disabled', () => {
  assert.equal(ENEMY_CONFIG.swarm.spawn.enabled, false);
  assert.equal(Object.values(ENEMY_CONFIG).filter(c => c.spawn?.enabled).length, 12);
});

test('enemy creation uses canonical untuned and horde stats for every enemy type', () => {
  const game = createGame();
  for (const type of Object.keys(ENEMY_CONFIG)) {
    const untuned = createEnemy(game, type, { horde: false, position: { x: 100, y: 100 } });
    nearly(untuned.hp, enemyHpAtLevel(type, 1, { horde: false }));
    nearly(untuned.speed, enemySpeedAtLevel(type, 1, 0.30));
    nearly(untuned.damage, enemyContactDamage(type, { horde: false }));
    assert.equal(untuned.r, ENEMY_CONFIG[type].radius);
    assert.ok(untuned.hp > 0);

    const horde = createEnemy(game, type, { horde: true, position: { x: 100, y: 100 } });
    nearly(horde.hp, enemyHpAtLevel(type, 1, { horde: true }));
    nearly(horde.damage, enemyContactDamage(type, { horde: true }));
  }
});

test('spawnEnemy appends exactly one constructed enemy', () => {
  const game = createGame();
  const enemy = spawnEnemy(game, 'ravager', { horde: true, position: { x: 100, y: 120 } });
  assert.equal(game.state.entities.enemies.length, 1);
  assert.equal(game.state.entities.enemies[0], enemy);
});

for (const type of ['ravager', 'runner', 'brute']) {
  test(`${type} acquires and damages a valid ground unit in melee`, () => {
    const game = createGame();
    game.state.base.x = 600; game.state.base.y = 100;
    const enemy = createEnemy(game, type, { horde: false, position: { x: 100, y: 100 } });
    enemy.effectiveSpeed = enemy.speed;
    const target = groundUnit('rifleman', 140, 100, 200);
    game.state.entities.enemies = [enemy]; game.state.entities.units = [target];
    const before = target.hp;
    const result = updateEnemyActor(game, enemy, 1);
    assert.equal(result.attacked, true);
    assert.ok(target.hp < before);
  });
}

test('ordinary ground enemy moves toward Base when no local target exists', () => {
  const game = createGame();
  game.state.base.x = 600; game.state.base.y = 100;
  const enemy = createEnemy(game, 'ravager', { horde: false, position: { x: 100, y: 100 } });
  enemy.effectiveSpeed = enemy.speed;
  game.state.entities.enemies = [enemy];
  updateEnemyActor(game, enemy, 1);
  assert.ok(enemy.x > 100);
});

test('ground melee enemy rejects flying player units', () => {
  const game = createGame();
  const enemy = createEnemy(game, 'ravager', { horde: false, position: { x: 100, y: 100 } });
  enemy.effectiveSpeed = enemy.speed;
  const drone = airUnit('combatdrone', 120, 100);
  game.state.entities.enemies = [enemy]; game.state.entities.units = [drone];
  const before = drone.hp;
  const result = updateEnemyActor(game, enemy, 1);
  assert.equal(result.attacked, false);
  assert.equal(drone.hp, before);
});

test('Spitter can acquire a flying target and emits the existing projectile shape', () => {
  const game = createGame();
  const enemy = createEnemy(game, 'spitter', { horde: false, position: { x: 100, y: 100 } });
  enemy.effectiveSpeed = enemy.speed; enemy.rangeCooldown = 0;
  const drone = airUnit('combatdrone', 180, 100);
  game.state.entities.enemies = [enemy]; game.state.entities.units = [drone];
  const result = updateEnemyActor(game, enemy, 0.1);
  assert.equal(result.attacked, true);
  assert.equal(game.testProjectiles.length, 1);
  assert.equal(game.testProjectiles[0].target, drone);
  assert.equal(game.testProjectiles[0].type, 'spitter');
});

test('Flyer keeps final direct terrain-only movement and ignores Walls', () => {
  const game = createGame();
  game.state.base.x = 300; game.state.base.y = 100;
  const enemy = createEnemy(game, 'flyer', { horde: false, position: { x: 100, y: 100 } });
  enemy.effectiveSpeed = enemy.speed;
  game.state.entities.enemies = [enemy]; game.state.entities.structures = [wall(150, 0, 200)];
  updateEnemyActor(game, enemy, 3);
  assert.ok(enemy.x > 150);
});

test('Siege Beast prioritizes and applies its Wall damage multiplier', () => {
  const game = createGame();
  const enemy = createEnemy(game, 'siegebeast', { horde: false, position: { x: 100, y: 100 } });
  enemy.effectiveSpeed = enemy.speed;
  const target = wall(125, 50, 150, 1000);
  game.state.entities.enemies = [enemy]; game.state.entities.structures = [target];
  updateEnemyActor(game, enemy, 1);
  nearly(target.hp, 1000 - enemy.damage * 2.2);
});

test('Burrower enters burrow state to bypass a blocking Wall', () => {
  const game = createGame();
  game.state.base.x = 300; game.state.base.y = 100;
  const enemy = createEnemy(game, 'burrower', { horde: false, position: { x: 100, y: 100 } });
  enemy.effectiveSpeed = enemy.speed; enemy.burrowCooldown = 0;
  game.state.entities.enemies = [enemy]; game.state.entities.structures = [wall(180, 20, 180)];
  updateEnemyActor(game, enemy, 0.1);
  assert.equal(enemy.burrowed, true);
  assert.ok(enemy.burrowExit);
});

test('Climber enters climbing state instead of ordinary Wall melee when Wall is just beyond reach', () => {
  const game = createGame();
  game.state.base.x = 300; game.state.base.y = 100;
  const enemy = createEnemy(game, 'climber', { horde: false, position: { x: 100, y: 100 } });
  enemy.effectiveSpeed = enemy.speed;
  game.state.entities.enemies = [enemy]; game.state.entities.structures = [wall(140, 20, 180)];
  updateEnemyActor(game, enemy, 2);
  assert.equal(enemy.climbing, true);
  assert.ok(enemy.x > 100);
});

test('Acid Lobber applies current direct damage and corrosion duration', () => {
  const game = createGame();
  const enemy = createEnemy(game, 'acidlobber', { horde: false, position: { x: 100, y: 100 } });
  enemy.effectiveSpeed = enemy.speed; enemy.specialCooldown = 0;
  const target = wall(200, 20, 180, 1000);
  game.state.entities.enemies = [enemy]; game.state.entities.structures = [target];
  updateEnemyActor(game, enemy, 0.1);
  nearly(target.hp, 993.7);
  nearly(target.acidTime, 6);
});

test('Crusher completes windup/charge and applies current Wall impact damage', () => {
  const game = createGame();
  game.state.base.x = 300; game.state.base.y = 100;
  const enemy = createEnemy(game, 'crusher', { horde: false, position: { x: 100, y: 100 } });
  enemy.effectiveSpeed = enemy.speed; enemy.chargeCooldown = 0;
  const target = wall(125, 20, 180, 1000);
  game.state.entities.enemies = [enemy]; game.state.entities.structures = [target];
  updateEnemyActor(game, enemy, 0.01);
  assert.ok(enemy.chargeWindup > 0);
  updateEnemyActor(game, enemy, 1.2);
  assert.equal(enemy.charging, true);
  updateEnemyActor(game, enemy, 0.01);
  nearly(target.hp, 895.6);
  assert.equal(enemy.charging, false);
});

test('Harvester Hunter prioritizes Truck before economy structures', () => {
  const game = createGame();
  const enemy = createEnemy(game, 'harvesterhunter', { horde: false, position: { x: 100, y: 100 } });
  const truck = groundUnit('truck', 400, 100, 100);
  const nearRefinery = refinery(140, 100);
  game.state.entities.enemies = [enemy]; game.state.entities.units = [truck]; game.state.entities.structures = [nearRefinery];
  assert.equal(findStrategicEnemyTarget(game, enemy), truck);
});

test('Saboteur prioritizes economy structures and cloak responds to detection', () => {
  const game = createGame();
  game.state.base.x = 1000; game.state.base.y = 1000;
  const enemy = createEnemy(game, 'saboteur', { horde: false, position: { x: 100, y: 100 } });
  const economy = refinery(300, 100);
  game.state.entities.enemies = [enemy]; game.state.entities.structures = [economy];
  assert.equal(findStrategicEnemyTarget(game, enemy), economy);
  game.state.entities.structures = [];
  tickEnemyStatuses(game, enemy, 0.1);
  assert.equal(enemy.cloaked, true);
  game.state.entities.units = [groundUnit('scout', 120, 100)];
  tickEnemyStatuses(game, enemy, 0.1);
  assert.equal(enemy.cloaked, false);
});

test('authoritative update routes every canonical enemy handler without legacy update calls', () => {
  for (const type of Object.keys(ENEMY_CONFIG)) {
    const game = createGame();
    game.state.director.nextHordeIn = 9999;
    const enemy = createEnemy(game, type, { horde: false, position: { x: 200, y: 200 } });
    game.state.entities.enemies = [enemy];
    const report = updateEnemies(game, 0.01);
    assert.ok(report.actors >= 1, `${type} was not routed through clean enemy update`);
  }
});

test('dead enemies are removed once and bounty is granted once', () => {
  const game = createGame();
  const enemy = createEnemy(game, 'brute', { horde: false, position: { x: 100, y: 100 } });
  enemy.hp = 0;
  game.state.entities.enemies = [enemy];
  const first = cleanupDeadEnemies(game);
  const gold = game.state.resources.gold;
  const second = cleanupDeadEnemies(game);
  assert.equal(first, 1); assert.equal(second, 0);
  nearly(gold, ENEMY_CONFIG.brute.bountyGold);
  nearly(game.state.resources.gold, gold);
});

test('first horde launches at 26 seconds and spawns in batches of five', () => {
  const game = createGame({ random: seededRandom(1) });
  game.state.enemyRuntime = { initialized: true };
  const launch = updateEnemyDirector(game, 26);
  assert.equal(launch.launched, true);
  assert.equal(game.state.director.hordeNumber, 1);
  assert.equal(game.state.director.queuedEnemies, 34);
  assert.equal(game.state.entities.enemies.length, 0);
  const batch = updateEnemyDirector(game, 0.01);
  assert.equal(batch.spawned, 5);
  assert.equal(game.state.director.queuedEnemies, 29);
  assert.equal(game.state.entities.enemies.length, 5);
});

test('wave size/gap/radius preserve current minute progression', () => {
  const game = createGame({ elapsed: 300 });
  assert.equal(baseHordeSize(game), 64);
  nearly(nextHordeGap(game), 42);
  nearly(currentHordeRadius(game), 1755);
});

test('special introduction timing uses canonical start times', () => {
  const before = createGame({ elapsed: 64, random: sequenceRandom([0.99, 0.99, 0, 0, 0]) });
  assert.notEqual(chooseHordeEnemyType(before), 'climber');
  const after = createGame({ elapsed: 70, random: sequenceRandom([0.99, 0.99, 0, 0]) });
  assert.equal(chooseHordeEnemyType(after), 'climber');
});

test('resource caches initialize with current count and bounds', () => {
  const game = createGame({ random: seededRandom(42) });
  const caches = generateResourceCaches(game);
  assert.equal(caches.length, 6);
  for (const cache of caches) {
    assert.ok(cache.x >= 120 && cache.x <= game.config.world.width - 120);
    assert.ok(cache.y >= 120 && cache.y <= game.config.world.height - 120);
    assert.equal(cache.r, 30);
  }
});

test('cache activation spawns three untuned guards and records references', () => {
  const game = createGame({ random: seededRandom(3) });
  const cache = { id: 'cache-a', x: 1000, y: 800, r: 30, capture: 0, captured: false, guardsSpawned: false, guardIds: [] };
  game.state.entities.resourceCaches = [cache];
  game.state.entities.units = [groundUnit('rifleman', 1000, 800)];
  updateCacheCapture(game, 0);
  assert.equal(cache.guardsSpawned, true);
  assert.equal(cache.guardIds.length, 3);
  assert.deepEqual(game.state.entities.enemies.map(e => e.type), ['ravager', 'ravager', 'runner']);
  const ravager = game.state.entities.enemies[0];
  nearly(ravager.hp, enemyHpAtLevel('ravager', 1, { horde: false }));
  nearly(ravager.damage, ENEMY_CONFIG.ravager.baseDamage);
});

test('cache guard chooses eligible ground unit and rejects Combat Drone/Ship', () => {
  const game = createGame();
  const cache = { id: 'cache-a', x: 1000, y: 800, r: 30, capture: 0, captured: false, guardsSpawned: true, guardIds: [] };
  game.state.entities.resourceCaches = [cache];
  const guard = createEnemy(game, 'ravager', { horde: false, position: { x: 950, y: 800 }, cacheGuard: { cacheId: cache.id, homeX: 950, homeY: 800 } });
  const drone = airUnit('combatdrone', 980, 800), ship = airUnit('combatship', 990, 800), rifle = groundUnit('rifleman', 1010, 800);
  game.state.entities.enemies = [guard]; game.state.entities.units = [drone, ship, rifle];
  assert.equal(nearestGuardTarget(game, cache, guard), rifle);
  game.state.entities.units = [drone, ship];
  assert.equal(nearestGuardTarget(game, cache, guard), null);
});

test('ground cache guard cannot melee flying unit through integrated guard update', () => {
  const game = createGame();
  const cache = { id: 'cache-a', x: 1000, y: 800, r: 30, capture: 0, captured: false, guardsSpawned: true, guardIds: [] };
  const guard = createEnemy(game, 'ravager', { horde: false, position: { x: 980, y: 800 }, cacheGuard: { cacheId: cache.id, homeX: 980, homeY: 800 } });
  const drone = airUnit('combatdrone', 990, 800);
  game.state.entities.resourceCaches = [cache]; game.state.entities.enemies = [guard]; game.state.entities.units = [drone];
  const before = drone.hp;
  updateCacheGuards(game, 1);
  assert.equal(drone.hp, before);
});

test('cache guard leash returns an idle guard toward its cache', () => {
  const game = createGame();
  const cache = { id: 'cache-a', x: 1000, y: 800, r: 30, capture: 0, captured: false, guardsSpawned: true, guardIds: [] };
  const guard = createEnemy(game, 'ravager', { horde: false, position: { x: 1800, y: 800 }, cacheGuard: { cacheId: cache.id, homeX: 1800, homeY: 800 } });
  game.state.entities.resourceCaches = [cache]; game.state.entities.enemies = [guard];
  updateCacheGuards(game, 1);
  assert.ok(guard.x < 1800);
});

test('cache guard movement uses full blocker including Main Base/building/depot/Wall/terrain', () => {
  const game = createGame();
  const guard = createEnemy(game, 'ravager', { horde: false, position: { x: 400, y: 400 } });
  game.state.base = { x: 500, y: 400, radius: 68, hp: 300, maxHp: 300 };
  game.state.entities.structures = [refinery(650, 400), wall(750, 300, 500)];
  game.state.entities.depots = [{ id: 'd', x: 850, y: 400, r: 34 }];
  game.state.entities.terrain = [{ kind: 'lake', x: 950, y: 400, r: 45 }];
  stepCacheGuard(game, guard, 1100, 400, 120, 1);
  assert.equal(isNavigationPointBlocked(game, guard.x, guard.y, guard.r), false);
  assert.ok(Math.hypot(guard.x - game.state.base.x, guard.y - game.state.base.y) >= game.state.base.radius + guard.r + 4);
});

test('dead cache guard does not contest', () => {
  const game = createGame();
  const cache = { id: 'cache-a', x: 1000, y: 800, r: 30, capture: 0, captured: false, guardsSpawned: true, guardIds: [] };
  const guard = createEnemy(game, 'ravager', { horde: false, position: { x: 1020, y: 800 }, cacheGuard: { cacheId: cache.id, homeX: 1020, homeY: 800 } });
  guard.hp = 0;
  game.state.entities.resourceCaches = [cache]; game.state.entities.enemies = [guard];
  assert.equal(isCacheContested(game, cache), false);
});

test('Spotter alone cannot advance cache capture progress', () => {
  const game = createGame();
  const cache = { id: 'cache-a', x: 1000, y: 800, r: 30, capture: 1, captured: false, guardsSpawned: true, guardIds: ['g'] };
  const guard = createEnemy(game, 'ravager', { horde: false, position: { x: 1200, y: 800 }, cacheGuard: { cacheId: cache.id, homeX: 1200, homeY: 800 } });
  const spotter = groundUnit('spotter', 1000, 800);
  game.state.entities.resourceCaches = [cache]; game.state.entities.enemies = [guard]; game.state.entities.units = [spotter];
  assert.equal(nearestCacheCapturer(game, cache), null);
  updateCacheCapture(game, 1);
  assert.ok(cache.capture <= 1);
  assert.equal(cache.captured, false);
});

test('eligible ground unit captures normally once guards no longer contest', () => {
  const game = createGame({ random: sequenceRandom([0, 0]) });
  const cache = { id: 'cache-a', x: 1000, y: 800, r: 30, capture: 0, captured: false, guardsSpawned: true, guardIds: [] };
  const rifle = groundUnit('rifleman', 1000, 800);
  game.state.entities.resourceCaches = [cache]; game.state.entities.units = [rifle];
  updateCacheCapture(game, 4.5);
  assert.equal(cache.captured, true);
  assert.ok(game.state.resources.gold > 0);
  assert.ok(game.state.resources.metal > 0);
});

test('contested cache pauses existing progress rather than decaying it', () => {
  const game = createGame();
  const cache = { id: 'cache-a', x: 1000, y: 800, r: 30, capture: 2, captured: false, guardsSpawned: true, guardIds: [] };
  const guard = createEnemy(game, 'ravager', { horde: false, position: { x: 1020, y: 800 }, cacheGuard: { cacheId: cache.id, homeX: 1020, homeY: 800 } });
  game.state.entities.resourceCaches = [cache]; game.state.entities.enemies = [guard]; game.state.entities.units = [groundUnit('rifleman', 1000, 800)];
  updateCacheCapture(game, 1);
  assert.equal(cache.capture, 2);
  assert.equal(cache.captured, false);
});

test('cache completion transitions and reward callback occur exactly once', () => {
  let captures = 0;
  const game = createGame({ random: sequenceRandom([0, 0]) });
  game.services.resourceCaches.onCaptured = () => { captures++; };
  const cache = { id: 'cache-a', x: 1000, y: 800, r: 30, capture: 4.4, captured: false, guardsSpawned: true, guardIds: [] };
  game.state.entities.resourceCaches = [cache]; game.state.entities.units = [groundUnit('rifleman', 1000, 800)];
  updateCacheCapture(game, 1);
  const resources = { ...game.state.resources };
  updateCacheCapture(game, 10);
  assert.equal(captures, 1);
  assert.deepEqual(game.state.resources, resources);
});

test('initializeEnemyRuntime commits director/cache ownership without touching another subsystem', () => {
  const game = createGame({ random: seededRandom(7) });
  game.state.enemyRuntime = null;
  game.state.entities.resourceCaches = [];
  initializeEnemyRuntime(game);
  assert.equal(game.state.enemyRuntime.initialized, true);
  assert.equal(game.state.entities.resourceCaches.length, 6);
  assert.ok(Number.isFinite(game.state.director.nextHordeIn));
});
