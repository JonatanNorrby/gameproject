import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../js/core/game.js';
import {
  createBuildingRuntime,
  getStorageCapacity,
  spendForBuilding,
  updateEconomicBuildingConstruction,
  upgradeBuildingStorage,
} from '../js/buildings/buildingRuntime.js';
import {
  createMineForDepot,
  createResourceDepot,
  depotStockForPosition,
  getDepotStock,
} from '../js/economy/depots.js';
import { updateResourceMines } from '../js/economy/mining.js';
import { updateRefineries } from '../js/economy/refinery.js';
import {
  damageLandingPadOrShip,
  EXPORT_SHIP_STATES,
  updateLandingPads,
} from '../js/economy/landingPads.js';
import {
  ensureTruckLogistics,
  getTruckCapacity,
  getTruckCargo,
  loadTruckAtMine,
  markTruckRouteArrived,
  startTruckRoute,
  unloadTruckAtLandingPad,
  unloadTruckAtRefinery,
  updateTruckLogistics,
} from '../js/economy/truckLogistics.js';
import {
  addStoredResource,
  canAfford,
  getResource,
  getStoredResource,
  spendResources,
} from '../js/economy/resources.js';
import { issueMove, MOVE_COMMAND_SOURCES } from '../js/units/commands.js';
import { getEffectiveTowerStats } from '../js/combat/towerStats.js';

function game(services = {}) {
  return createGame({ now: () => 1, services });
}

function truck(g, x = 1000, y = 1000) {
  const unit = {
    id: `truck-${g.state.entities.units.length}`,
    type: 'truck',
    x,
    y,
    hp: 135,
    maxHp: 135,
    path: [],
    moveTarget: null,
    route: [],
    routeIndex: 0,
    routeLoop: false,
    routeActive: false,
    routeWaiting: false,
    routePendingStart: false,
    platoonId: null,
    platoonSlot: 0,
  };
  g.state.entities.units.push(unit);
  ensureTruckLogistics(g, unit);
  return unit;
}

function built(g, type, x = 1500, y = 1000, extra = {}) {
  const result = createBuildingRuntime(g, type, { built: true, x, y, ...extra });
  assert.equal(result.ok, true);
  g.state.entities.structures.push(result.building);
  return result.building;
}

test('resource wallet transactions are atomic and clean Metal spending accepts tower upgrade costs', () => {
  const g = game();
  g.state.resources.gold = 125;
  g.state.resources.metal = 100;
  const laserUpgrade = getEffectiveTowerStats({ type: 'laser', level: 1 }).nextUpgradeCost;
  assert.equal(laserUpgrade, 45);
  assert.equal(canAfford(g, { metal: laserUpgrade }), true);
  assert.equal(spendResources(g, { metal: laserUpgrade }), true);
  assert.equal(getResource(g, 'metal'), 55);
  assert.equal(spendResources(g, { gold: 200, metal: 10 }), false);
  assert.equal(getResource(g, 'gold'), 125);
  assert.equal(getResource(g, 'metal'), 55);
});

test('effective economic building currencies/costs remain 45 Metal, 20 Gold and 35 Gold', () => {
  const g = game();
  g.state.resources.gold = 100;
  g.state.resources.metal = 100;
  assert.equal(spendForBuilding(g, 'mine'), true);
  assert.equal(getResource(g, 'metal'), 55);
  assert.equal(spendForBuilding(g, 'oremine'), true);
  assert.equal(spendForBuilding(g, 'refinery'), true);
  assert.equal(getResource(g, 'gold'), 45);
});

test('Crystal depot stock uses exact distance-from-base formula', () => {
  const g = game();
  const near = depotStockForPosition(g, 'crystal', g.state.base.x + 720, g.state.base.y);
  const far = depotStockForPosition(g, 'crystal', g.state.base.x + 1720, g.state.base.y);
  assert.equal(near, Math.round(850 + 720 * 0.72));
  assert.equal(far, Math.round(850 + 1720 * 0.72));
  assert.ok(far > near);
});

test('Crystal depot enforces the current three-Mine limit below the UI layer', () => {
  const g = game();
  const depot = createResourceDepot(g, 'crystal', { id: 'd', x: 6000, y: 3795 });
  g.state.entities.depots.push(depot);
  for (let i = 0; i < 3; i++) assert.equal(createMineForDepot(g, 'mine', depot, { built: true, id: `m${i}` }).ok, true);
  const fourth = createMineForDepot(g, 'mine', depot, { built: true, id: 'm4' });
  assert.equal(fourth.ok, false);
  assert.equal(fourth.reason, 'depot-mine-limit');
});

test('Crystal Mine consumes finite depot stock and cannot produce after depletion', () => {
  const g = game();
  const depot = createResourceDepot(g, 'crystal', { id: 'd', x: 6000, y: 3795, stock: 10 });
  g.state.entities.depots.push(depot);
  const mine = createMineForDepot(g, 'mine', depot, { built: true, id: 'm' }).building;
  updateResourceMines(g, 10);
  assert.equal(getStoredResource(mine.resourceStore, 'crystal'), 10);
  assert.equal(getDepotStock(g, depot), 0);
  updateResourceMines(g, 10);
  assert.equal(getStoredResource(mine.resourceStore, 'crystal'), 10);
});

test('Ore Mine preserves the current 2.8 Ore/sec extraction rate', () => {
  const g = game();
  const depot = createResourceDepot(g, 'ore', { id: 'o', x: 6000, y: 3795, stock: 100 });
  g.state.entities.depots.push(depot);
  const mine = createMineForDepot(g, 'oremine', depot, { built: true, id: 'om' }).building;
  updateResourceMines(g, 5);
  assert.equal(getStoredResource(mine.resourceStore, 'ore'), 14);
  assert.equal(getDepotStock(g, depot), 86);
});

test('Truck capacity is 45 and incompatible destinations do not mix/unload cargo', () => {
  const g = game();
  const t = truck(g);
  assert.equal(getTruckCapacity(g, t), 45);
  addStoredResource(t.cargoStore, 'crystal', 20, { capacity: 45 });
  const refinery = built(g, 'refinery');
  assert.equal(unloadTruckAtRefinery(g, t, refinery), true);
  assert.deepEqual(getTruckCargo(g, t), { type: 'crystal', amount: 20, capacity: 45 });
});

test('Refinery and Landing Pad capacity use one authoritative value at levels 1/3, 2/3, 3/3', () => {
  const g = game();
  g.state.resources.gold = 1000;
  const refinery = built(g, 'refinery');
  const pad = built(g, 'landingpad');
  assert.deepEqual([1, 2, 3].map(level => { refinery.storageLevel = level; return getStorageCapacity(refinery); }), [260, 440, 700]);
  assert.deepEqual([1, 2, 3].map(level => { pad.storageLevel = level; return getStorageCapacity(pad); }), [520, 800, 1200]);
  refinery.storageLevel = 1;
  pad.storageLevel = 1;
  assert.equal(upgradeBuildingStorage(g, refinery).capacity, 440);
  assert.equal(upgradeBuildingStorage(g, refinery).capacity, 700);
  assert.equal(upgradeBuildingStorage(g, pad).capacity, 800);
  assert.equal(upgradeBuildingStorage(g, pad).capacity, 1200);
});

test('Refinery passively converts Ore to Metal at 4.5/sec and 1:1', () => {
  const g = game();
  const refinery = built(g, 'refinery');
  addStoredResource(refinery.resourceStore, 'ore', 20, { capacity: getStorageCapacity(refinery) });
  updateRefineries(g, 2);
  assert.equal(getStoredResource(refinery.resourceStore, 'ore'), 11);
  assert.equal(getResource(g, 'metal'), 9);
});

test('Truck route loops through clean logistics moves and advances a completed service stop', () => {
  const moves = [];
  const g = game({ logistics: { issueMove: (_game, unit, x, y, options) => {
    moves.push({ x, y, source: options.source });
    unit.path = [{ x, y }];
    unit.moveTarget = { x, y };
    return { ok: true };
  } } });
  const t = truck(g);
  const mine = built(g, 'mine', 1200, 1000, { depotId: 'none' });
  t.route = [{ x: mine.x, y: mine.y, buildingId: mine.id }, { x: 1400, y: 1000 }];
  assert.equal(startTruckRoute(g, t), true);
  assert.equal(moves[0].source, MOVE_COMMAND_SOURCES.LOGISTICS);
  t.path = [];
  t.moveTarget = null;
  markTruckRouteArrived(g, t);
  mine.resourceStore.amount = 0;
  updateTruckLogistics(g);
  assert.equal(t.routeIndex, 1);
  assert.equal(t.routeActive, true);
});

test('Truck route waits at a Mine until full or source+depot depletion', () => {
  const moves = [];
  const g = game({ logistics: { issueMove: (_game, unit, x, y, options) => {
    moves.push(options.source);
    unit.path = [{ x, y }];
    unit.moveTarget = { x, y };
    return { ok: true };
  } } });
  const depot = createResourceDepot(g, 'crystal', { id: 'wait-depot', x: 1200, y: 1000, stock: 100 });
  g.state.entities.depots.push(depot);
  const mine = createMineForDepot(g, 'mine', depot, { built: true, id: 'wait-mine' }).building;
  mine.resourceStore.amount = 10;
  const t = truck(g);
  t.route = [{ x: mine.x, y: mine.y, buildingId: mine.id }, { x: 1500, y: 1000 }];
  startTruckRoute(g, t);
  t.path = [];
  t.moveTarget = null;
  markTruckRouteArrived(g, t);
  updateTruckLogistics(g);
  assert.equal(t.routeIndex, 0);
  assert.equal(t.routeWaiting, true);
  assert.equal(getStoredResource(t.cargoStore, 'crystal'), 10);
  depot.stock = 0;
  mine.resourceStore.amount = 0;
  updateTruckLogistics(g);
  assert.equal(t.routeIndex, 1);
});

test('manual Truck move cancels route ownership while logistics move preserves it', () => {
  const g = game();
  const t = truck(g, 1000, 1000);
  t.routeLoop = t.routeActive = t.routePendingStart = t.routeInTransit = true;
  assert.equal(issueMove(g, t, 1100, 1000, { source: MOVE_COMMAND_SOURCES.LOGISTICS }).ok, true);
  assert.equal(t.routeActive, true);
  assert.equal(issueMove(g, t, 1200, 1000, { source: MOVE_COMMAND_SOURCES.PLAYER }).ok, true);
  assert.equal(t.routeActive, false);
  assert.equal(t.routeLoop, false);
  assert.equal(t.routePendingStart, false);
  assert.equal(t.routeInTransit, false);
});

test('full Crystal Depot → Mine → Truck → Landing Pad → Export Ship → Gold loop conserves resource', () => {
  const g = game();
  g.state.resources.gold = 0;
  const depot = createResourceDepot(g, 'crystal', { id: 'cd', x: 6000, y: 3795, stock: 220 });
  g.state.entities.depots.push(depot);
  const mine = createMineForDepot(g, 'mine', depot, { built: true, id: 'cm' }).building;
  const t = truck(g, mine.x, mine.y);
  const pad = built(g, 'landingpad', 7000, 3795);
  for (let i = 0; i < 3; i++) {
    updateResourceMines(g, 40);
    loadTruckAtMine(g, t, mine);
    unloadTruckAtLandingPad(g, t, pad);
  }
  assert.equal(getStoredResource(pad.resourceStore, 'crystal'), 135);
  updateResourceMines(g, 40); loadTruckAtMine(g, t, mine); unloadTruckAtLandingPad(g, t, pad);
  updateResourceMines(g, 40); loadTruckAtMine(g, t, mine); unloadTruckAtLandingPad(g, t, pad);
  assert.equal(getStoredResource(pad.resourceStore, 'crystal'), 220);
  assert.equal(getDepotStock(g, depot), 0);
  const result = updateLandingPads(g, 10);
  assert.equal(result.launched, 1);
  assert.equal(getResource(g, 'gold'), 880);
  assert.equal(getStoredResource(pad.resourceStore, 'crystal'), 0);
  assert.equal(pad.exportShip.state, EXPORT_SHIP_STATES.COOLDOWN);
});

test('full Ore source → Mine → Truck → Refinery → Metal loop preserves exact amount', () => {
  const g = game();
  const depot = createResourceDepot(g, 'ore', { id: 'od', x: 6000, y: 3795, stock: 45 });
  g.state.entities.depots.push(depot);
  const mine = createMineForDepot(g, 'oremine', depot, { built: true, id: 'om' }).building;
  const t = truck(g, mine.x, mine.y);
  const refinery = built(g, 'refinery', 7000, 3795);
  updateResourceMines(g, 20);
  assert.equal(getStoredResource(mine.resourceStore, 'ore'), 45);
  loadTruckAtMine(g, t, mine);
  assert.equal(getStoredResource(t.cargoStore, 'ore'), 45);
  unloadTruckAtRefinery(g, t, refinery);
  assert.equal(getStoredResource(refinery.resourceStore, 'ore'), 45);
  updateRefineries(g, 10);
  assert.equal(getResource(g, 'metal'), 45);
  assert.equal(getStoredResource(refinery.resourceStore, 'ore'), 0);
});

test('export ship uses zero initial cooldown, gradual 34/sec loading, 220 capacity and 120-sec cycle', () => {
  const g = game();
  g.state.resources.gold = 0;
  const pad = built(g, 'landingpad');
  addStoredResource(pad.resourceStore, 'crystal', 220, { capacity: getStorageCapacity(pad) });
  updateLandingPads(g, 1);
  assert.equal(pad.exportShip.state, EXPORT_SHIP_STATES.LANDED);
  assert.equal(pad.exportShip.hp, 260);
  assert.equal(getStoredResource(pad.exportShip.cargoStore, 'crystal'), 34);
  updateLandingPads(g, 6);
  assert.equal(pad.exportShip.state, EXPORT_SHIP_STATES.COOLDOWN);
  assert.equal(pad.exportShip.cooldown, 120);
  assert.equal(getResource(g, 'gold'), 880);
  updateLandingPads(g, 119);
  assert.equal(pad.exportShip.state, EXPORT_SHIP_STATES.COOLDOWN);
  updateLandingPads(g, 1);
  assert.equal(pad.exportShip.state, EXPORT_SHIP_STATES.LANDED);
});

test('destroyed landed ship loses loaded cargo, grants no Gold, restarts cycle, then Pad takes later damage', () => {
  const g = game();
  g.state.resources.gold = 10;
  const pad = built(g, 'landingpad');
  addStoredResource(pad.resourceStore, 'crystal', 100, { capacity: 520 });
  updateLandingPads(g, 2);
  assert.equal(getStoredResource(pad.exportShip.cargoStore, 'crystal'), 68);
  const padHp = pad.hp;
  damageLandingPadOrShip(g, pad, 300);
  assert.equal(pad.exportShip.state, EXPORT_SHIP_STATES.COOLDOWN);
  assert.equal(pad.exportShip.hp, 0);
  assert.equal(getStoredResource(pad.exportShip.cargoStore, 'crystal'), 0);
  assert.equal(getResource(g, 'gold'), 10);
  assert.equal(pad.hp, padHp);
  damageLandingPadOrShip(g, pad, 10);
  assert.equal(pad.hp, padHp - 10);
  assert.equal(pad.exportShip.cooldown, 120);
  updateLandingPads(g, 120);
  assert.equal(pad.exportShip.state, EXPORT_SHIP_STATES.LANDED);
});

test('two Landing Pads keep storage, cooldown, landed ship, HP, loading and destruction independent', () => {
  const g = game();
  const a = built(g, 'landingpad', 1000, 1000);
  const b = built(g, 'landingpad', 2000, 1000);
  addStoredResource(a.resourceStore, 'crystal', 100, { capacity: 520 });
  addStoredResource(b.resourceStore, 'crystal', 220, { capacity: 520 });
  updateLandingPads(g, 2);
  assert.equal(a.exportShip.state, EXPORT_SHIP_STATES.LANDED);
  assert.equal(b.exportShip.state, EXPORT_SHIP_STATES.LANDED);
  assert.equal(getStoredResource(a.resourceStore, 'crystal'), 32);
  assert.equal(getStoredResource(b.resourceStore, 'crystal'), 152);
  const bHp = b.exportShip.hp;
  damageLandingPadOrShip(g, a, 999);
  assert.equal(a.exportShip.state, EXPORT_SHIP_STATES.COOLDOWN);
  assert.equal(b.exportShip.state, EXPORT_SHIP_STATES.LANDED);
  assert.equal(b.exportShip.hp, bHp);
  updateLandingPads(g, 5);
  assert.equal(b.exportShip.state, EXPORT_SHIP_STATES.COOLDOWN);
  assert.equal(a.exportShip.state, EXPORT_SHIP_STATES.COOLDOWN);
});

test('ship landing exposes the enemy-attraction service with the exact 720 radius', () => {
  let signal = null;
  const g = game({ landingPads: { onShipLanded: (_game, _pad, context) => { signal = context; } } });
  const pad = built(g, 'landingpad');
  updateLandingPads(g, 0.1);
  assert.equal(signal.attractRadius, 720);
  assert.equal(pad.exportShip.state, EXPORT_SHIP_STATES.LANDED);
});

test('Bunker remains disabled in the clean runtime', () => {
  const g = game();
  const result = createBuildingRuntime(g, 'bunker', { built: true });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'building-disabled');
});

test('economic construction preserves base timing plus up to two Engineer bonuses', () => {
  const g = game();
  const refinery = createBuildingRuntime(g, 'refinery', { built: false, x: 1000, y: 1000 }).building;
  g.state.entities.structures.push(refinery);
  g.state.entities.units.push(
    { id: 'e1', type: 'soldier', role: 'engineer', x: 1000, y: 1000, hp: 150 },
    { id: 'e2', type: 'soldier', role: 'engineer', x: 1010, y: 1000, hp: 150 },
  );
  updateEconomicBuildingConstruction(g, 1);
  assert.equal(refinery.buildRemaining, 9 - 1 - 0.8);
  updateEconomicBuildingConstruction(g, 10);
  assert.equal(refinery.built, true);
});
