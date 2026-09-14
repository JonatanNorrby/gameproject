import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createLegacyBuildingPlacementGame,
  installLegacyBuildingPlacementBridge,
  normalizeLegacyBuildingPlacementState,
} from '../js/migration/buildingPlacementLegacyBridge.js';

function makeState({ credits = 500, metal = 500 } = {}) {
  return {
    credits, metal,
    baseHp: 300, maxBaseHp: 300,
    units: [], enemies: [], structures: [], terrain: [], depots: [], rivers: [],
    selectedUnit: null, selectedTower: null, selectedStorageBuilding: null,
    debug: { unlimitedCash: false, unlimitedLives: false },
  };
}

function harness(initial = makeState()) {
  let state = initial;
  let installed = null;
  let audit = null;
  const previews = [];
  const completed = [];
  const destroyed = [];
  const host = {
    baseX: 5060,
    baseY: 3795,
    baseRadius: 68,
    getState: () => state,
    now: () => 1000,
    random: () => 0.25,
    installOwners(owners) { installed = owners; return () => {}; },
    syncWallPreview(draft, options) { previews.push({ draft, options }); },
    onConstructionComplete(structure, group) { completed.push({ structure, group }); },
    onStructureDestroyed(structure) { destroyed.push(structure); },
    markReady(value) { audit = value; },
  };
  return {
    host, previews, completed, destroyed,
    get state() { return state; },
    replace(next) { state = next; },
    get installed() { return installed; },
    get audit() { return audit; },
  };
}

function install(h = harness()) {
  const bridge = installLegacyBuildingPlacementBridge(h.host);
  return { h, ...bridge };
}

function crystalDepot(id = 'crystal-1', x = 6500, y = 4300) {
  return { id, resourceType: 'crystal', x, y, r: 34, stock: 600, mineId: null, mineIds: [] };
}

test('Step 6 installs clean placement, construction, Wall, storage and structure lifecycle owners', () => {
  const { h, owners, audit } = install();
  assert.equal(h.installed, owners);
  assert.equal(audit.active, true);
  assert.equal(audit.placementOwner, 'js/buildings/placement.js');
  assert.equal(audit.constructionOwner, 'js/buildings/construction.js');
  assert.equal(audit.storageUpgradeOwner, 'js/buildings/buildingRuntime.js');
  assert.equal(audit.structureLifecycleOwner, 'js/combat/lifecycle.js:cleanupDeadStructures');
  assert.equal(audit.enemyLifecycleOwner, 'Step 4 unchanged');
  for (const key of ['placeStructure','updateConstruction','activeConstructionCount','freeWorkers','reviewWall','confirmWall','upgradeStorage','cleanupDestroyed']) {
    assert.equal(typeof owners[key], 'function');
  }
});

test('production placement spends canonical Metal/Gold and rejects overlap through one clean validator', () => {
  const { h, owners } = install(harness(makeState({ credits: 200, metal: 200 })));
  const laser = owners.placeStructure('laser', 6500, 4300);
  assert.equal(laser.ok, true);
  assert.equal(laser.structure.type, 'laser');
  assert.equal(laser.structure.level, 1);
  assert.equal(laser.structure.built, false);
  assert.equal(h.state.metal, 130);

  const blocked = owners.placeStructure('refinery', 6500, 4300);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.reason, 'blocked');
  assert.equal(h.state.credits, 200);

  const refinery = owners.placeStructure('refinery', 6800, 4300);
  assert.equal(refinery.ok, true);
  assert.equal(h.state.credits, 165);
  assert.equal(owners.activeConstructionCount(), 2);
  assert.equal(owners.freeWorkers(), 1);
});

test('production Mine placement preserves three slots per depot and legacy mine-link aliases', () => {
  const state = makeState({ metal: 500 });
  const depot = crystalDepot();
  state.depots.push(depot);
  const { owners } = install(harness(state));

  for (let index = 0; index < 3; index++) {
    const result = owners.placeStructure('mine', depot.x, depot.y);
    assert.equal(result.ok, true);
    assert.equal(result.structure.mineSlot, index);
  }
  assert.deepEqual(depot.mineIds, state.structures.map(structure => structure.id));
  assert.equal(depot.mineId, state.structures[0].id);
  const fourth = owners.placeStructure('mine', depot.x, depot.y);
  assert.equal(fourth.ok, false);
  assert.equal(fourth.reason, 'no-matching-depot');
  assert.equal(state.metal, 500 - 45 * 3);
});

test('clean Wall owner keeps legacy preview as a mirror and queues a multi-segment path as one worker group', () => {
  const h = harness(makeState({ metal: 100 }));
  const { owners } = install(h);
  owners.appendWallPoint({ x: 6500, y: 4300 }, { force: true });
  owners.appendWallPoint({ x: 6600, y: 4300 }, { force: true });
  owners.appendWallPoint({ x: 6700, y: 4300 }, { force: true });
  const review = owners.reviewWall();
  assert.equal(review.ok, true);
  assert.equal(review.total, 200);
  assert.equal(review.cost, 22);
  assert.equal(h.previews.at(-1).draft.path.length, 3);

  const result = owners.confirmWall();
  assert.equal(result.ok, true);
  assert.equal(result.structures.length, 2);
  assert.equal(result.structures[0].groupId, result.structures[1].groupId);
  assert.equal(h.state.metal, 78);
  assert.equal(owners.activeConstructionCount(), 1);
  assert.equal(owners.freeWorkers(), 2);
  assert.equal(owners.getWallState().path.length, 0);
  assert.equal(h.previews.at(-1).options.stopPainting, true);
});

test('production construction advances one Wall group once and keeps Engineer acceleration', () => {
  const { h, owners } = install(harness(makeState({ metal: 500 })));
  const tower = owners.placeStructure('laser', 6500, 4300).structure;
  const initial = tower.buildRemaining;
  h.state.units.push({
    id: 'engineer-1', type: 'soldier', role: 'engineer', x: tower.x, y: tower.y,
    hp: 100, maxHp: 100, path: [], moveTarget: null, cooldowns: [],
    platoonId: null, platoonSlot: 0, garrisonedIn: null, transportedIn: null,
  });
  owners.updateConstruction(1);
  assert.equal(tower.buildRemaining, initial - 1.4);

  owners.appendWallPoint({ x: 6800, y: 4300 }, { force: true });
  owners.appendWallPoint({ x: 6900, y: 4300 }, { force: true });
  owners.appendWallPoint({ x: 7000, y: 4300 }, { force: true });
  const wall = owners.confirmWall().structures;
  owners.updateConstruction(1);
  assert.equal(wall[0].buildRemaining, wall[1].buildRemaining);
  owners.updateConstruction(99);
  assert.equal(tower.built, true);
  assert.equal(wall.every(segment => segment.built), true);
  assert.ok(h.completed.length >= 2);
});

test('storage upgrade action uses clean canonical level costs and capacities', () => {
  const state = makeState({ credits: 300 });
  const refinery = {
    id: 'refinery-1', type: 'refinery', x: 6500, y: 4300,
    hp: 460, maxHp: 460, built: true, storageLevel: 1, oreStored: 0,
  };
  state.structures.push(refinery);
  const { owners } = install(harness(state));

  const level2 = owners.upgradeStorage(refinery);
  assert.deepEqual({ ok: level2.ok, level: level2.level, capacity: level2.capacity }, { ok: true, level: 2, capacity: 440 });
  assert.equal(state.credits, 220);
  const level3 = owners.upgradeStorage(refinery);
  assert.deepEqual({ ok: level3.ok, level: level3.level, capacity: level3.capacity }, { ok: true, level: 3, capacity: 700 });
  assert.equal(state.credits, 80);
  assert.equal(owners.upgradeStorage(refinery).reason, 'max-level');
});

test('Step 6 cleanup composes unit + structure cleanup without stealing Step 4 enemy lifecycle', () => {
  const state = makeState({ credits: 125 });
  const depot = crystalDepot();
  const mine = { id: 'mine-dead', type: 'mine', x: depot.x, y: depot.y - 12, depotId: depot.id, mineSlot: 0, hp: 0, maxHp: 180, built: true, stored: 0 };
  const tower = { id: 'tower-dead', type: 'laser', x: 6800, y: 4300, hp: 0, maxHp: 190, built: true, level: 1, cool: 0 };
  const unit = { id: 'unit-dead', type: 'soldier', role: 'rifleman', x: 7000, y: 4300, hp: 0, maxHp: 100, path: [], moveTarget: null, cooldowns: [], platoonId: null, platoonSlot: 0 };
  const enemy = { id: 'enemy-dead', type: 'ravager', x: 7100, y: 4300, hp: 0, maxHp: 20, r: 7 };
  state.depots.push(depot);state.structures.push(mine,tower);state.units.push(unit);state.enemies.push(enemy);state.selectedTower=tower;
  const h = harness(state);
  const { owners } = install(h);

  const result = owners.cleanupDestroyed();
  assert.equal(result.units, 1);
  assert.equal(result.structures, 2);
  assert.equal(state.units.length, 0);
  assert.equal(state.structures.length, 0);
  assert.equal(state.enemies.length, 1, 'enemy removal/reward remains Step 4-owned');
  assert.equal(state.credits, 125);
  assert.equal(state.selectedTower, null);
  assert.deepEqual(depot.mineIds, []);
  assert.equal(depot.mineId, null);
  assert.equal(h.destroyed.length, 2);
});

test('Step 6 bridge follows complete legacy state replacement after Restart', () => {
  const original = makeState({ credits: 200, metal: 200 });
  const h = harness(original);
  const { owners } = install(h);
  const restarted = makeState({ credits: 300, metal: 300 });
  h.replace(restarted);

  const result = owners.placeStructure('refinery', 6500, 4300);
  assert.equal(result.ok, true);
  assert.equal(restarted.credits, 265);
  assert.equal(restarted.structures.length, 1);
  assert.equal(original.credits, 200);
  assert.equal(original.structures.length, 0);
  assert.ok(restarted.v6WallPlacement);
});

test('Step 6 normalization preserves destroyed structure HP and never revives zero', () => {
  const h = harness();
  h.state.structures.push({ type: 'laser', x: 6500, y: 4300, hp: 0, maxHp: Number.NaN, built: true, cool: Number.NaN });
  const game = createLegacyBuildingPlacementGame(h.host);
  normalizeLegacyBuildingPlacementState(game, h.host);
  const tower = h.state.structures[0];
  assert.equal(tower.hp, 0);
  assert.ok(Number.isFinite(tower.maxHp));
  assert.equal(tower.level, 1);
  assert.equal(tower.cool, 0);
});
