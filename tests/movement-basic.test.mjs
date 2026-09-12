import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameConfig } from '../js/core/config.js';
import { createInitialState } from '../js/core/state.js';
import { getUnitConfig } from '../js/units/unitConfig.js';
import { getIndividualUnitMoveSpeed, setUnitDestination, updateUnitMovement } from '../js/movement/movement.js';
import { isNavigationPointBlocked } from '../js/navigation/pathfinding.js';

function createTestGame() {
  const config = createGameConfig();
  const state = createInitialState({ config, now: () => 0 });
  state.entities.terrain = [];
  state.entities.depots = [];
  state.entities.structures = [];
  state.entities.rivers = [];
  return { config, state };
}

function createUnit(role, x = 1000, y = 1000) {
  const definition = getUnitConfig(role);
  return {
    id: `test-${role}`,
    type: definition.runtimeType,
    role,
    x,
    y,
    hp: definition.maxHp,
    maxHp: definition.maxHp,
    path: [],
    moveTarget: null,
    heading: 0,
  };
}

function runToStop(game, unit, dt = 0.05, maxSteps = 4000) {
  for (let i = 0; i < maxSteps && unit.path.length; i++) {
    const speed = getIndividualUnitMoveSpeed(game, unit);
    const before = { x: unit.x, y: unit.y };
    updateUnitMovement(game, unit, dt);
    assert.ok(Number.isFinite(unit.x) && Number.isFinite(unit.y), 'position stayed finite');
    const moved = Math.hypot(unit.x - before.x, unit.y - before.y);
    assert.ok(moved <= Math.max(speed * dt, 5) + 1e-7, 'movement stayed within legacy step/snap bound');
  }
  assert.equal(unit.path.length, 0, 'unit reached its destination');
}

test('Rifleman moves on open terrain at the current 165 speed', () => {
  const game = createTestGame(), unit = createUnit('rifleman');
  assert.equal(setUnitDestination(game, unit, 1300, 1000), true);
  assert.deepEqual(unit.path, [{ x: 1300, y: 1000 }]);
  updateUnitMovement(game, unit, 0.1);
  assert.ok(Math.abs(unit.x - 1016.5) < 1e-9);
  assert.equal(unit.y, 1000);
});

test('Rifleman routes around one lake obstacle with the extracted v48 A*', () => {
  const game = createTestGame(), unit = createUnit('rifleman', 1000, 1400);
  game.state.entities.terrain.push({
    kind: 'lake',
    points: [
      { x: 1160, y: 1310 }, { x: 1320, y: 1310 },
      { x: 1320, y: 1490 }, { x: 1160, y: 1490 },
    ],
  });
  assert.equal(setUnitDestination(game, unit, 1500, 1400), true);
  assert.ok(unit.path.length >= 2, 'path contains a detour');
  runToStop(game, unit);
  assert.ok(Math.hypot(unit.x - 1500, unit.y - 1400) < 1e-7);
  assert.equal(unit.moveTarget, null);
});

test('Blocked ground destination uses the current v51 nearest-open repair', () => {
  const game = createTestGame(), unit = createUnit('rifleman', 1000, 1600);
  game.state.entities.structures.push({ id: 'refinery', type: 'refinery', x: 1400, y: 1600, hp: 100 });
  assert.equal(isNavigationPointBlocked(game, 1400, 1600, 23), true);
  assert.equal(setUnitDestination(game, unit, 1400, 1600), true);
  assert.notDeepEqual(unit.moveTarget, { x: 1400, y: 1600 });
  assert.equal(isNavigationPointBlocked(game, unit.moveTarget.x, unit.moveTarget.y, 23), false);
});

test('Combat Drone crosses terrain with one direct waypoint', () => {
  const game = createTestGame(), unit = createUnit('combatdrone', 1000, 1800);
  game.state.entities.terrain.push({
    kind: 'lake',
    points: [
      { x: 1160, y: 1710 }, { x: 1360, y: 1710 },
      { x: 1360, y: 1890 }, { x: 1160, y: 1890 },
    ],
  });
  assert.equal(setUnitDestination(game, unit, 1550, 1800), true);
  assert.deepEqual(unit.path, [{ x: 1550, y: 1800 }]);
  updateUnitMovement(game, unit, 0.1);
  assert.ok(Math.abs(unit.x - 1024.5) < 1e-9);
});

test('Combat Ship crosses terrain directly at the current 145 speed', () => {
  const game = createTestGame(), unit = createUnit('combatship', 1000, 2000);
  game.state.entities.terrain.push({
    kind: 'lake',
    points: [
      { x: 1160, y: 1910 }, { x: 1360, y: 1910 },
      { x: 1360, y: 2090 }, { x: 1160, y: 2090 },
    ],
  });
  assert.equal(setUnitDestination(game, unit, 1550, 2000), true);
  updateUnitMovement(game, unit, 0.1);
  assert.ok(Math.abs(unit.x - 1014.5) < 1e-9);
  runToStop(game, unit);
  assert.ok(Math.hypot(unit.x - 1550, unit.y - 2000) < 1e-7);
});

test('Truck accepts a normal individual move with existing destination-side compatibility', () => {
  const game = createTestGame(), unit = createUnit('truck', 1000, 2200);
  unit.routeActive = true;
  unit.routeLoop = true;
  assert.equal(setUnitDestination(game, unit, 1300, 2200), true);
  assert.equal(unit.routeActive, false);
  assert.equal(unit.routeLoop, false);
  updateUnitMovement(game, unit, 0.1);
  assert.ok(Math.abs(unit.x - 1018.5) < 1e-9);
});

test('Unit arrives and stops with path empty and destination cleared', () => {
  const game = createTestGame(), unit = createUnit('rifleman', 1000, 2400);
  assert.equal(setUnitDestination(game, unit, 1060, 2400), true);
  runToStop(game, unit, 0.02);
  assert.deepEqual({ x: unit.x, y: unit.y }, { x: 1060, y: 2400 });
  assert.deepEqual(unit.path, []);
  assert.equal(unit.moveTarget, null);
  const before = { x: unit.x, y: unit.y };
  assert.equal(updateUnitMovement(game, unit, 0.1), false);
  assert.deepEqual({ x: unit.x, y: unit.y }, before);
});

test('Second move order replaces the active path without teleporting', () => {
  const game = createTestGame(), unit = createUnit('rifleman', 1000, 2600);
  assert.equal(setUnitDestination(game, unit, 1500, 2600), true);
  updateUnitMovement(game, unit, 0.2);
  const before = { x: unit.x, y: unit.y };
  assert.equal(setUnitDestination(game, unit, 1000, 3100), true);
  assert.deepEqual(unit.moveTarget, { x: 1000, y: 3100 });
  updateUnitMovement(game, unit, 0.1);
  const moved = Math.hypot(unit.x - before.x, unit.y - before.y);
  assert.ok(moved <= 16.5 + 1e-7);
  assert.ok(unit.y > before.y);
});

test('Failed reroute preserves the previous path and move target', () => {
  const game = createTestGame(), unit = createUnit('rifleman', 1000, 3300);
  assert.equal(setUnitDestination(game, unit, 1500, 3300), true);
  const previousPath = unit.path;
  const previousTarget = unit.moveTarget;
  game.state.entities.terrain.push({
    kind: 'lake',
    points: [
      { x: 1750, y: 2950 }, { x: 2250, y: 2950 },
      { x: 2250, y: 3450 }, { x: 1750, y: 3450 },
    ],
  });
  assert.equal(setUnitDestination(game, unit, 2000, 3200), false);
  assert.equal(unit.path, previousPath);
  assert.equal(unit.moveTarget, previousTarget);
});

test('Ground river slowdown remains 50 percent and aircraft ignore it', () => {
  const game = createTestGame();
  game.state.entities.rivers.push({ width: 100, points: [{ x: 800, y: 3500 }, { x: 1800, y: 3500 }] });
  const rifleman = createUnit('rifleman', 1000, 3500);
  const drone = createUnit('combatdrone', 1000, 3500);
  assert.equal(getIndividualUnitMoveSpeed(game, rifleman), 82.5);
  assert.equal(getIndividualUnitMoveSpeed(game, drone), 245);
});

test('Forests and hills remain traversable while lakes block', () => {
  const game = createTestGame();
  game.state.entities.terrain.push(
    { kind: 'forest', points: [{ x: 800, y: 3600 }, { x: 1000, y: 3600 }, { x: 1000, y: 3800 }, { x: 800, y: 3800 }] },
    { kind: 'hill', points: [{ x: 1100, y: 3600 }, { x: 1300, y: 3600 }, { x: 1300, y: 3800 }, { x: 1100, y: 3800 }] },
    { kind: 'lake', points: [{ x: 1400, y: 3600 }, { x: 1600, y: 3600 }, { x: 1600, y: 3800 }, { x: 1400, y: 3800 }] },
  );
  assert.equal(isNavigationPointBlocked(game, 900, 3700, 23), false);
  assert.equal(isNavigationPointBlocked(game, 1200, 3700, 23), false);
  assert.equal(isNavigationPointBlocked(game, 1500, 3700, 23), true);
});

test('Walls remain physical navigation blockers', () => {
  const game = createTestGame();
  game.state.entities.structures.push({ type: 'wall', x1: 1200, y1: 3900, x2: 1200, y2: 4300, thickness: 12, hp: 100 });
  assert.equal(isNavigationPointBlocked(game, 1210, 4100, 23), true);
  assert.equal(isNavigationPointBlocked(game, 1300, 4100, 23), false);
});
