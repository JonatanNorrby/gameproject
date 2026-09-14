import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, CLEAN_RUNTIME_STATUS } from '../js/core/game.js';
import { initializeRuntime, MAX_SIMULATION_STEP, resetRuntime, RUNTIME_PHASES, stepRuntime } from '../js/core/runtime.js';
import { bootGame } from '../js/main.js';
import { createPlayerUnit } from '../js/units/deployment.js';
import { updateMovementRuntime } from '../js/movement/runtime.js';
import { createBuildingRuntime } from '../js/buildings/buildingRuntime.js';
import { depotStockForPosition } from '../js/economy/depots.js';
import { landExportShip } from '../js/economy/landingPads.js';
import { riverConflictsWithAssets } from '../js/world/world.js';
import { updateVisualEffects } from '../js/rendering/visualEffects.js';
import { MIGRATION_STATUS } from '../js/core/config.js';

function lcg(seed = 123456789) {
  let value = seed >>> 0;
  return () => { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value / 0x100000000; };
}
function harness(seed = 123456789, extraServices = {}) {
  let clock = 1000;
  const g = createGame({ now: () => clock, services: { random: lcg(seed), ...extraServices } });
  return { g, setTime(ms) { clock = ms; }, advance(ms) { clock += ms; } };
}
function addUnit(g, role, x = 1000, y = 1000) { const unit = createPlayerUnit(g, role, { x, y }); g.state.entities.units.push(unit); return unit; }
function running(g) { g.state.session.paused = false; g.state.ui.titleMenuOpen = false; g.state.ui.gameStarted = true; }
function near(actual, expected, epsilon = 1e-6) { assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} ≉ ${expected}`); }

test('Step 8 promotes the clean game context to migrated/active production ownership', () => {
  const { g } = harness();
  assert.equal(CLEAN_RUNTIME_STATUS, MIGRATION_STATUS.MIGRATED);
  assert.equal(g.migration.active, true);
  assert.equal(g.migration.productionOwner, 'js/core/runtime.js');
});

test('runtime initialization generates the complete paused world and collision-safe rivers', () => {
  const { g } = harness(0x1234abcd);
  initializeRuntime(g, { forceWorld: true });
  assert.equal(g.state.entities.terrain.length, g.config.terrain.featureCount);
  assert.equal(g.state.entities.depots.filter(depot => depot.resourceType === 'crystal').length, g.config.economy.crystal.depotCount);
  assert.equal(g.state.entities.depots.filter(depot => depot.resourceType === 'ore').length, g.config.economy.ore.depotCount);
  assert.equal(g.state.entities.rivers.length, g.config.rivers.count);
  assert.equal(g.state.entities.resourceCaches.length, g.config.resourceCaches.count);
  assert.equal(g.state.worldRuntime.initialized, true);
  assert.equal(g.state.enemyRuntime.initialized, true);
  assert.equal(g.state.economyRuntime.initialized, true);
  assert.ok(g.state.fog.explored instanceof Uint8Array);
  for (const depot of g.state.entities.depots) assert.equal(depot.stock, depotStockForPosition(g, depot.resourceType, depot.x, depot.y));
  for (const river of g.state.entities.rivers) assert.equal(riverConflictsWithAssets(g, river.points, river.width), false);
  assert.equal(g.state.session.paused, true);
  assert.equal(g.state.ui.titleMenuOpen, true);
  assert.equal(g.state.ui.gameStarted, false);
});

test('authoritative scheduler executes the explicit Step 1-7 owners once in production order', () => {
  const phases = [];
  const { g } = harness(0x778899aa, { runtime: { onPhase: id => phases.push(id) } });
  initializeRuntime(g, { forceWorld: true });
  running(g);
  stepRuntime(g, 0.02);
  assert.deepEqual(phases, RUNTIME_PHASES);
  assert.ok(phases.indexOf('economy-landing-pads') < phases.indexOf('movement'));
  assert.ok(phases.indexOf('movement') < phases.indexOf('economy-trucks'));
  assert.ok(phases.indexOf('enemy-actors') < phases.indexOf('projectiles'));
  assert.ok(phases.indexOf('projectiles') < phases.indexOf('resource-cache-capture'));
  assert.ok(phases.indexOf('resource-cache-capture') < phases.indexOf('resource-cache-prune'));
});

test('paused scheduler does not advance simulation but still owns input/fog/VFX lifecycle', () => {
  const phases = [];
  const { g } = harness(1, { runtime: { onPhase: id => phases.push(id) } });
  initializeRuntime(g, { forceWorld: true });
  const result = stepRuntime(g, 0.02);
  assert.equal(result.simulated, false);
  assert.equal(g.state.time.elapsed, 0);
  assert.deepEqual(phases, ['input', 'fog', 'visual-effects']);
});

test('runtime preserves the 33ms frame clamp and moves units through the Step 2 owner only while running', () => {
  const { g } = harness(); initializeRuntime(g, { forceWorld: true }); g.state.entities.rivers = [];
  const rifle = addUnit(g, 'rifleman', 2000, 2000); rifle.path = [{ x: 2400, y: 2000 }]; rifle.moveTarget = { x: 2400, y: 2000 };
  const pausedX = rifle.x; stepRuntime(g, 1); assert.equal(rifle.x, pausedX); assert.equal(g.state.time.elapsed, 0);
  running(g); const result = stepRuntime(g, 1); assert.equal(result.step, MAX_SIMULATION_STEP); near(g.state.time.elapsed, .033); near(rifle.x, pausedX + 165 * .033);
});

test('Platoon speed, river slowdown and support movement remain owned by updateMovementRuntime', () => {
  const { g } = harness();
  const rifle = addUnit(g, 'rifleman', 1000, 1000), tank = addUnit(g, 'tank', 1000, 1100);
  rifle.platoonId = tank.platoonId = 'p-test'; rifle.path = [{ x: 2000, y: 1000 }]; tank.path = [{ x: 2000, y: 1100 }];
  updateMovementRuntime(g, 1); near(rifle.x, 1092); near(tank.x, 1092);
  rifle.x = tank.x = 1000; rifle.y = 1000; tank.y = 1020; rifle.path = [{ x: 2000, y: 1000 }]; tank.path = [{ x: 2000, y: 1020 }];
  g.state.entities.rivers = [{ id: 'r', width: 200, points: [{ x: 0, y: 1000 }, { x: 3000, y: 1000 }] }];
  updateMovementRuntime(g, 1); near(rifle.x, 1046); near(tank.x, 1046);
});

test('default Landing Pad callback preserves canonical enemy attraction radius behavior', () => {
  const { g } = harness();
  const pad = createBuildingRuntime(g, 'landingpad', { id: 'pad', built: true, x: 2000, y: 2000 }).building; g.state.entities.structures.push(pad);
  const nearEnemy = { id: 'near', type: 'ravager', x: 2200, y: 2000, hp: 10, maxHp: 10 }, farEnemy = { id: 'far', type: 'ravager', x: 3000, y: 2000, hp: 10, maxHp: 10 };
  g.state.entities.enemies.push(nearEnemy, farEnemy); landExportShip(g, pad);
  assert.equal(nearEnemy.attractedTo, pad.id); assert.equal(farEnemy.attractedTo, undefined); assert.match(g.state.ui.message, /1 nearby aliens/);
});

test('runtime reset rebuilds state while preserving started-session options and tower-reach preference', () => {
  const { g } = harness(0xabcdef01); initializeRuntime(g, { forceWorld: true }); running(g);
  g.state.ui.options.enemyArrows = false; g.state.ui.options.unitArrows = false; g.state.view.showReach = true; g.state.resources.gold = 9999; addUnit(g, 'tank'); g.state.selection.unitId = g.state.entities.units[0].id;
  resetRuntime(g, { preserveSession: true });
  assert.equal(g.state.resources.gold, g.config.game.startingGold); assert.equal(g.state.entities.units.length, 0); assert.equal(g.state.selection.unitId, null);
  assert.equal(g.state.ui.gameStarted, true); assert.equal(g.state.ui.titleMenuOpen, false); assert.equal(g.state.session.paused, false);
  assert.equal(g.state.ui.options.enemyArrows, false); assert.equal(g.state.ui.options.unitArrows, false); assert.equal(g.state.view.showReach, true);
});

test('clean visual effects receive update-side expiry once and are never dependent on a renderer mutation', () => {
  const { g, setTime } = harness(); g.state.entities.effects.push({ kind: 'blast', x: 1, y: 2, durationMs: 150 });
  setTime(1000); let result = updateVisualEffects(g, 1000); assert.equal(result.initialized, 1); assert.equal(g.state.entities.effects[0].expires, 1150);
  result = updateVisualEffects(g, 1149); assert.equal(result.active, 1); result = updateVisualEffects(g, 1150); assert.equal(result.active, 0);
});

test('bootGame is Node-safe, initializes the paused preview, clean reset and loop controls without auto-starting', () => {
  const g = bootGame({ services: { random: lcg(0x33445566) } });
  assert.equal(g.state.runtime.initialized, true); assert.equal(g.state.worldRuntime.initialized, true); assert.equal(g.state.session.paused, true); assert.equal(g.state.ui.titleMenuOpen, true);
  assert.equal(g.runtimeLoop, undefined); assert.equal(typeof g.reset, 'function'); assert.equal(typeof g.start, 'function'); assert.equal(typeof g.stop, 'function');
});
