import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../js/core/game.js';
import {
  initializeRuntime,
  resetRuntime,
  stepRuntime,
} from '../js/core/runtime.js';
import { bootGame } from '../js/main.js';
import { createPlayerUnit } from '../js/units/deployment.js';
import { updateUnits } from '../js/units/units.js';
import { createBuildingRuntime } from '../js/buildings/buildingRuntime.js';
import { depotStockForPosition } from '../js/economy/depots.js';
import { landExportShip } from '../js/economy/landingPads.js';

function lcg(seed = 123456789) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

function game(seed = 123456789) {
  let clock = 1000;
  const g = createGame({
    now: () => clock,
    services: { random: lcg(seed) },
  });
  return {
    g,
    setTime(ms) { clock = ms; },
    advance(ms) { clock += ms; },
  };
}

function addUnit(g, role, x = 1000, y = 1000) {
  const unit = createPlayerUnit(g, role, { x, y });
  g.state.entities.units.push(unit);
  return unit;
}

function running(g) {
  g.state.session.paused = false;
  g.state.ui.titleMenuOpen = false;
  g.state.ui.gameStarted = true;
}

function near(actual, expected, epsilon = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} ≉ ${expected}`);
}

test('runtime initialization generates the complete final world before the paused preview', () => {
  const { g } = game(0x1234abcd);
  initializeRuntime(g);

  assert.equal(g.state.entities.terrain.length, g.config.terrain.featureCount);
  assert.equal(g.state.entities.depots.filter(depot => depot.resourceType === 'crystal').length, g.config.economy.crystal.depotCount);
  assert.equal(g.state.entities.depots.filter(depot => depot.resourceType === 'ore').length, g.config.economy.ore.depotCount);
  assert.equal(g.state.entities.depots.length, g.config.economy.crystal.depotCount + g.config.economy.ore.depotCount);
  assert.equal(g.state.entities.rivers.length, g.config.rivers.count);
  assert.equal(g.state.entities.resourceCaches.length, g.config.resourceCaches.count);
  assert.equal(g.state.worldRuntime.initialized, true);
  assert.equal(g.state.enemyRuntime.initialized, true);
  assert.equal(g.state.economyRuntime.initialized, true);
  assert.ok(g.state.fog.explored instanceof Uint8Array);

  for (const feature of g.state.entities.terrain) {
    const distance = Math.hypot(feature.x - g.state.base.x, feature.y - g.state.base.y);
    assert.ok(distance >= g.state.base.radius + g.config.world.baseTerrainClearance + feature.r * 0.25);
  }
  for (const depot of g.state.entities.depots) {
    assert.ok(Math.hypot(depot.x - g.state.base.x, depot.y - g.state.base.y) >= g.config.economy[depot.resourceType].depotBaseClearance);
    assert.equal(depot.stock, depotStockForPosition(g, depot.resourceType, depot.x, depot.y));
  }

  assert.equal(g.state.session.paused, true);
  assert.equal(g.state.ui.titleMenuOpen, true);
  assert.equal(g.state.ui.gameStarted, false);
});

test('authoritative runtime advances a unit path and elapsed time only while running', () => {
  const { g } = game();
  initializeRuntime(g);
  // This test isolates scheduler movement; river slowdown has dedicated coverage.
  g.state.entities.rivers = [];
  const rifle = addUnit(g, 'rifleman', 2000, 2000);
  rifle.path = [{ x: 2400, y: 2000 }];
  rifle.moveTarget = { x: 2400, y: 2000 };

  const pausedX = rifle.x;
  const paused = stepRuntime(g, 0.02);
  assert.equal(paused.simulated, false);
  assert.equal(rifle.x, pausedX);
  assert.equal(g.state.time.elapsed, 0);

  running(g);
  const result = stepRuntime(g, 0.02);
  assert.equal(result.simulated, true);
  near(rifle.x, pausedX + 165 * 0.02);
  near(g.state.time.elapsed, 0.02);
});

test('runtime preserves the legacy 33ms simulation-frame clamp', () => {
  const { g } = game();
  initializeRuntime(g);
  running(g);
  const result = stepRuntime(g, 1);
  assert.equal(result.step, 0.033);
  near(g.state.time.elapsed, 0.033);
});

test('Platoon movement uses the slowest current member speed', () => {
  const { g } = game();
  const rifle = addUnit(g, 'rifleman', 1000, 1000);
  const tank = addUnit(g, 'tank', 1000, 1100);
  rifle.platoonId = tank.platoonId = 'p-test';
  rifle.path = [{ x: 2000, y: 1000 }];
  tank.path = [{ x: 2000, y: 1100 }];

  updateUnits(g, 1);
  near(rifle.x, 1092);
  near(tank.x, 1092);
});

test('river slowdown and Platoon minimum are applied once, not twice', () => {
  const { g } = game();
  g.state.entities.rivers = [{ id: 'r', width: 200, points: [{ x: 0, y: 1000 }, { x: 3000, y: 1000 }] }];
  const rifle = addUnit(g, 'rifleman', 1000, 1000);
  const tank = addUnit(g, 'tank', 1000, 1020);
  rifle.platoonId = tank.platoonId = 'p-river';
  rifle.path = [{ x: 2000, y: 1000 }];
  tank.path = [{ x: 2000, y: 1020 }];

  updateUnits(g, 1);
  near(rifle.x, 1046);
  near(tank.x, 1046);
});

test('nearby APC support applies the final +28% boost with the 94% APC-speed cap', () => {
  const { g } = game();
  const apc = addUnit(g, 'apc', 1000, 1000);
  const rifle = addUnit(g, 'rifleman', 1100, 1000);
  apc.v47SupportUnitId = rifle.id;
  rifle.path = [{ x: 2200, y: 1000 }];

  updateUnits(g, 1);
  const cap = g.config.units.apc.moveSpeed * g.config.units.apc.supportFollow.boostSpeedCapFraction;
  near(rifle.x, 1100 + cap);
});

test('Medic follow assigns one support-AI path and resets the final 0.42s repath timer', () => {
  const { g } = game();
  const medic = addUnit(g, 'medic', 500, 1000);
  const rifle = addUnit(g, 'rifleman', 1000, 1000);
  rifle.heading = 0;
  medic.v47FollowId = rifle.id;
  medic.v47FollowTimer = 0;

  const result = updateUnits(g, 0.01);
  assert.equal(result.supportOrders, 1);
  assert.ok(medic.moveTarget);
  near(medic.v47FollowTimer, 0.42);
  assert.ok(medic.moveTarget.x <= rifle.x - 50);
});

test('APC support follow assigns one support-AI path and resets the final 0.48s timer', () => {
  const { g } = game();
  const apc = addUnit(g, 'apc', 500, 1000);
  const rifle = addUnit(g, 'rifleman', 1100, 1000);
  rifle.heading = 0;
  apc.v47SupportUnitId = rifle.id;
  apc.v47SupportTimer = 0;

  const result = updateUnits(g, 0.01);
  assert.equal(result.supportOrders, 1);
  assert.ok(apc.moveTarget);
  near(apc.v47SupportTimer, 0.48);
  assert.ok(apc.moveTarget.x <= rifle.x - 100);
});

test('transported passenger position is synchronized to its APC each unit update', () => {
  const { g } = game();
  const apc = addUnit(g, 'apc', 800, 900);
  const rifle = addUnit(g, 'rifleman', 200, 200);
  apc.passengerId = rifle.id;
  rifle.transportedIn = apc.id;
  rifle.path = [{ x: 500, y: 500 }];
  rifle.moveTarget = { x: 500, y: 500 };

  const result = updateUnits(g, 0.01);
  assert.equal(result.transported, 1);
  assert.equal(rifle.x, apc.x);
  assert.equal(rifle.y, apc.y);
  assert.deepEqual(rifle.path, []);
  assert.equal(rifle.moveTarget, null);
});

test('default Landing Pad ship callback attracts only enemies inside the canonical radius', () => {
  const { g } = game();
  const built = createBuildingRuntime(g, 'landingpad', { id: 'pad', built: true, x: 2000, y: 2000 });
  assert.equal(built.ok, true);
  const pad = built.building;
  g.state.entities.structures.push(pad);
  const nearEnemy = { id: 'near', type: 'ravager', x: 2200, y: 2000, hp: 10, maxHp: 10 };
  const farEnemy = { id: 'far', type: 'ravager', x: 3000, y: 2000, hp: 10, maxHp: 10 };
  g.state.entities.enemies.push(nearEnemy, farEnemy);

  const ship = landExportShip(g, pad);
  assert.equal(ship.state, 'landed');
  assert.equal(nearEnemy.attractedTo, pad.id);
  assert.equal(farEnemy.attractedTo, undefined);
  assert.match(g.state.ui.message, /1 nearby aliens/);
});

test('runtime reset rebuilds world/state while preserving an already-started session and options', () => {
  const { g } = game(0xabcdef01);
  initializeRuntime(g);
  running(g);
  g.state.ui.options.enemyArrows = false;
  g.state.view.showReach = true;
  g.state.resources.gold = 9999;
  g.state.resources.metal = 9999;
  addUnit(g, 'tank', 1000, 1000);
  g.state.selection.unitId = g.state.entities.units[0].id;

  resetRuntime(g, { preserveSession: true });
  assert.equal(g.state.resources.gold, g.config.game.startingGold);
  assert.equal(g.state.resources.metal, g.config.game.startingMetal);
  assert.equal(g.state.entities.units.length, 0);
  assert.equal(g.state.selection.unitId, null);
  assert.equal(g.state.entities.terrain.length, g.config.terrain.featureCount);
  assert.equal(g.state.entities.depots.length, g.config.economy.crystal.depotCount + g.config.economy.ore.depotCount);
  assert.equal(g.state.entities.rivers.length, g.config.rivers.count);
  assert.equal(g.state.ui.gameStarted, true);
  assert.equal(g.state.ui.titleMenuOpen, false);
  assert.equal(g.state.session.paused, false);
  assert.equal(g.state.ui.options.enemyArrows, false);
  assert.equal(g.state.view.showReach, true);
});

test('bootGame is Node-safe, initializes the full paused preview, and does not auto-start a loop', () => {
  const g = bootGame({ services: { random: lcg(0x33445566) } });
  assert.equal(g.state.runtime.initialized, true);
  assert.equal(g.state.worldRuntime.initialized, true);
  assert.equal(g.state.entities.terrain.length, g.config.terrain.featureCount);
  assert.equal(g.state.session.paused, true);
  assert.equal(g.state.ui.titleMenuOpen, true);
  assert.equal(g.runtimeLoop, undefined);
  assert.equal(typeof g.runtime.step, 'function');
  assert.equal(typeof g.runtime.start, 'function');
  assert.equal(typeof g.runtime.reset, 'function');
});
