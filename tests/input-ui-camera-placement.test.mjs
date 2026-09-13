import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../js/core/game.js';
import { createBuildingRuntime, getStorageCapacity } from '../js/buildings/buildingRuntime.js';
import { createResourceDepot } from '../js/economy/depots.js';
import { getResource } from '../js/economy/resources.js';
import { updateConstruction } from '../js/buildings/construction.js';
import { placeStructure, placeWallPath, validateWallPath, freeWorkers } from '../js/buildings/placement.js';
import { centerCameraOnBase, getCameraZoom, screenToWorld, setCameraZoom } from '../js/input/camera.js';
import { initInput } from '../js/input/input.js';
import {
  beginApcSupport,
  beginMedicFollow,
  beginOrFinishTruckRoute,
  beginPlatoonAttach,
  beginTruckAttach,
  chooseBuildType,
  confirmWallPath,
  dropSelectedMine,
  handleWorldTap,
  reviewWallPath,
  selectStorage,
  selectTower,
  selectUnit,
  upgradeSelectedStorage,
  upgradeSelectedTower,
} from '../js/input/interaction.js';
import { createPlayerUnit, deployUnitFromBase } from '../js/units/deployment.js';
import { createOrMergePlatoon, disbandPlatoon } from '../js/units/platoons.js';
import { canBoardApc, loadApc, unloadApc } from '../js/units/transport.js';
import { initUI } from '../js/ui/ui.js';

function game(services = {}) {
  let n = 0;
  return createGame({ now: () => ++n, services: { random: () => .25, ...services } });
}

function addUnit(g, role, x = 6000, y = 3800) {
  const unit = createPlayerUnit(g, role, { x, y });
  g.state.entities.units.push(unit);
  return unit;
}

function built(g, type, x = 6500, y = 3800) {
  const result = createBuildingRuntime(g, type, { built: true, x, y });
  assert.equal(result.ok, true);
  g.state.entities.structures.push(result.building);
  return result.building;
}

test('clean runtime starts as a paused title-screen preview like final v34', () => {
  const g = game();
  assert.equal(g.state.session.paused, true);
  assert.equal(g.state.ui.titleMenuOpen, true);
  assert.equal(g.state.ui.gameStarted, false);
});

test('camera zoom-at-cursor preserves the world point under that screen point', () => {
  const g = game();
  g.state.ui.titleMenuOpen = false;
  centerCameraOnBase(g);
  const before = screenToWorld(g, 300, 220);
  setCameraZoom(g, 1.1, 300, 220);
  const after = screenToWorld(g, 300, 220);
  assert.ok(Math.abs(before.x - after.x) < 1e-8);
  assert.ok(Math.abs(before.y - after.y) < 1e-8);
});

test('camera zoom clamps to the final 18%-135% range', () => {
  const g = game();
  assert.equal(setCameraZoom(g, .01), .18);
  assert.equal(setCameraZoom(g, 9), 1.35);
});

test('screen/world conversion uses one authoritative camera transform', () => {
  const g = game();
  g.state.view.camera.x = 400;
  g.state.view.camera.y = 700;
  g.state.view.camera.zoom = .5;
  assert.deepEqual(screenToWorld(g, 100, 50), { x: 600, y: 800, sx: 100, sy: 50 });
});

test('wheel input has one clean owner and is blocked while command menu is open', () => {
  const handlers = new Map();
  const canvas = {
    width: 1280, height: 800, clientWidth: 1280, clientHeight: 800, clientLeft: 0, clientTop: 0,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 800 }),
    addEventListener(name, fn) { handlers.set(name, fn); },
    removeEventListener() {}, setPointerCapture() {},
  };
  const g = createGame({ canvas });
  g.state.ui.titleMenuOpen = false;
  initInput(g);
  const wheel = handlers.get('wheel');
  assert.equal(typeof wheel, 'function');
  const start = getCameraZoom(g);
  wheel({ clientX: 640, clientY: 400, deltaY: -1, preventDefault() {}, stopImmediatePropagation() {} });
  assert.equal(getCameraZoom(g), start + .1);
  g.state.ui.commandMenuOpen = true;
  wheel({ clientX: 640, clientY: 400, deltaY: -1, preventDefault() {}, stopImmediatePropagation() {} });
  assert.equal(getCameraZoom(g), start + .1);
});

test('Rifleman button semantics deploy immediately from Main Base and spend Gold', () => {
  const g = game();
  const result = chooseBuildType(g, 'soldier');
  assert.equal(result.ok, true);
  assert.equal(result.mode, 'unit-deploy');
  assert.equal(g.state.entities.units.length, 1);
  assert.equal(getResource(g, 'gold'), 85);
  assert.ok(Math.hypot(result.unit.x - g.state.base.x, result.unit.y - g.state.base.y) > g.state.base.radius);
  assert.equal(g.state.commands.buildType, null);
});

test('Combat Ship preserves one-active-unit limit at purchase time', () => {
  const g = game();
  g.state.resources.gold = 1000;
  assert.equal(deployUnitFromBase(g, 'combatship').ok, true);
  const second = deployUnitFromBase(g, 'combatship');
  assert.equal(second.ok, false);
  assert.equal(second.reason, 'max-active');
  assert.equal(getResource(g, 'gold'), 580);
});

test('tower placement spends Metal and creates one level-1 construction entity', () => {
  const g = game();
  g.state.resources.metal = 200;
  const result = placeStructure(g, 'laser', 6500, 4300);
  assert.equal(result.ok, true);
  assert.equal(result.structure.type, 'laser');
  assert.equal(result.structure.level, 1);
  assert.equal(result.structure.built, false);
  assert.equal(getResource(g, 'metal'), 130);
  assert.equal(freeWorkers(g), 2);
});

test('normal placement rejects overlap with an existing structure', () => {
  const g = game();
  g.state.resources.gold = 1000;
  built(g, 'refinery', 6500, 4300);
  const result = placeStructure(g, 'landingpad', 6500, 4300);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'blocked');
});

test('Mine placement snaps to matching finite depot and runtime enforces three-Mine cap', () => {
  const g = game();
  g.state.resources.metal = 1000;
  const depot = createResourceDepot(g, 'crystal', { id: 'crystal-depot', x: 6500, y: 4300, stock: 500 });
  g.state.entities.depots.push(depot);
  for (let i = 0; i < 3; i++) assert.equal(placeStructure(g, 'mine', depot.x, depot.y).ok, true);
  const fourth = placeStructure(g, 'mine', depot.x, depot.y);
  assert.equal(fourth.ok, false);
  assert.equal(fourth.reason, 'no-matching-depot');
});

test('multi-segment Wall uses exact path cost and one worker group', () => {
  const g = game();
  g.state.resources.metal = 100;
  const points = [{ x: 6500, y: 4300 }, { x: 6600, y: 4300 }, { x: 6700, y: 4300 }];
  const validation = validateWallPath(g, points);
  assert.equal(validation.ok, true);
  assert.equal(validation.total, 200);
  assert.equal(validation.cost, 22);
  const result = placeWallPath(g, points);
  assert.equal(result.ok, true);
  assert.equal(result.structures.length, 2);
  assert.equal(result.structures[0].groupId, result.structures[1].groupId);
  assert.equal(freeWorkers(g), 2);
  assert.equal(getResource(g, 'metal'), 78);
});

test('shared construction advances towers and an entire Wall group once, with Engineer bonus', () => {
  const g = game();
  g.state.resources.metal = 500;
  const tower = placeStructure(g, 'laser', 6500, 4300).structure;
  const wall = placeWallPath(g, [{ x: 6800, y: 4300 }, { x: 6900, y: 4300 }, { x: 7000, y: 4300 }]).structures;
  const engineer = addUnit(g, 'engineer', tower.x, tower.y);
  updateConstruction(g, 1);
  assert.equal(tower.buildRemaining, 6 - 1.4);
  assert.equal(wall[0].buildRemaining, wall[1].buildRemaining);
  engineer.x = 1000; engineer.y = 1000;
  updateConstruction(g, 99);
  assert.equal(tower.built, true);
  assert.equal(wall.every(segment => segment.built), true);
});

test('Truck route recording stores exact service building IDs and auto-starts at two stops', () => {
  const moves = [];
  const g = game({ logistics: { issueMove: (_game, unit, x, y) => { moves.push({ x, y }); unit.path = [{ x, y }]; unit.moveTarget = { x, y }; return { ok: true }; } } });
  const truck = addUnit(g, 'truck', 6000, 4300);
  const refinery = built(g, 'refinery', 6200, 4300);
  selectUnit(g, truck);
  assert.equal(beginOrFinishTruckRoute(g).recording, true);
  handleWorldTap(g, refinery.x, refinery.y);
  handleWorldTap(g, 6400, 4500);
  const finish = beginOrFinishTruckRoute(g);
  assert.equal(finish.ok, true);
  assert.equal(truck.route[0].buildingId, refinery.id);
  assert.equal(truck.routeActive, true);
  assert.equal(g.state.selection.unitId, null);
  assert.equal(moves.length, 1);
});

test('player move remains distinct from route editing and normal tap issues move through Prompt 5 seam', () => {
  const g = game();
  const rifle = addUnit(g, 'rifleman', 6000, 4300);
  selectUnit(g, rifle);
  const result = handleWorldTap(g, 6200, 4300);
  assert.equal(result.action, 'move');
  assert.equal(result.ok, true);
  assert.ok(rifle.path.length > 0);
});

test('Tower selection/upgrade spends canonical Metal and caps cooldown at .15', () => {
  const g = game();
  g.state.resources.metal = 100;
  const tower = { id: 'laser', type: 'laser', x: 6500, y: 4300, hp: 190, maxHp: 190, built: true, level: 1, cool: 1.2 };
  g.state.entities.structures.push(tower);
  assert.equal(selectTower(g, tower), true);
  const result = upgradeSelectedTower(g);
  assert.equal(result.ok, true);
  assert.equal(tower.level, 2);
  assert.equal(tower.cool, .15);
  assert.equal(getResource(g, 'metal'), 55);
});

test('storage selection/upgrade uses the same authoritative level capacities as logistics', () => {
  const g = game();
  g.state.resources.gold = 500;
  const refinery = built(g, 'refinery');
  assert.equal(selectStorage(g, refinery), true);
  const result = upgradeSelectedStorage(g);
  assert.equal(result.ok, true);
  assert.equal(refinery.storageLevel, 2);
  assert.equal(getStorageCapacity(refinery), 440);
  assert.equal(getResource(g, 'gold'), 420);
});

test('Platoon interaction creates, merges and disbands canonical Platoons', () => {
  const g = game();
  const a = addUnit(g, 'rifleman', 6000, 4300), b = addUnit(g, 'heavygunner', 6050, 4300), c = addUnit(g, 'scout', 6100, 4300);
  const first = createOrMergePlatoon(g, a, b);
  assert.equal(first.ok, true);
  const second = createOrMergePlatoon(g, a, c);
  assert.equal(second.ok, true);
  assert.equal(second.members.length, 3);
  assert.equal(disbandPlatoon(g, a), 3);
  assert.equal(a.platoonId, null);
});

test('Platoon attach mode consumes a world-unit tap through the central interaction router', () => {
  const g = game();
  const a = addUnit(g, 'rifleman', 6000, 4300), b = addUnit(g, 'scout', 6080, 4300);
  selectUnit(g, a);
  assert.equal(beginPlatoonAttach(g), true);
  const result = handleWorldTap(g, b.x, b.y);
  assert.equal(result.action, 'platoon');
  assert.equal(result.ok, true);
  assert.equal(a.platoonId, b.platoonId);
});

test('APC boarding follows canonical boardable trait, including Medic, and voluntary unload clears transport state', () => {
  const g = game();
  const apc = addUnit(g, 'apc', 6000, 4300), medic = addUnit(g, 'medic', 6040, 4300);
  assert.equal(canBoardApc(medic), true);
  assert.equal(loadApc(g, apc, medic).ok, true);
  assert.equal(medic.transportedIn, apc.id);
  assert.equal(apc.passengerId, medic.id);
  assert.equal(unloadApc(g, apc).ok, true);
  assert.equal(medic.transportedIn, null);
  assert.equal(apc.passengerId, null);
});

test('Mine Layer button path spends 18 Gold and enforces ten active mines per owner', () => {
  const g = game();
  g.state.resources.gold = 500;
  const layer = addUnit(g, 'minelayer', 6000, 4300);
  selectUnit(g, layer);
  assert.equal(dropSelectedMine(g).ok, true);
  assert.equal(getResource(g, 'gold'), 482);
  for (let i = 1; i < 10; i++) g.state.entities.playerMines.push({ id: `x${i}`, ownerId: layer.id, x: layer.x, y: layer.y });
  const eleventh = dropSelectedMine(g);
  assert.equal(eleventh.ok, false);
  assert.equal(eleventh.reason, 'max-active');
});

test('Medic follow mode assigns canonical infantry target and exits attach mode', () => {
  const g = game();
  const medic = addUnit(g, 'medic', 6000, 4300), rifle = addUnit(g, 'rifleman', 6050, 4300);
  selectUnit(g, medic);
  assert.equal(beginMedicFollow(g), true);
  const result = handleWorldTap(g, rifle.x, rifle.y);
  assert.equal(result.ok, true);
  assert.equal(medic.v47FollowId, rifle.id);
  assert.equal(g.state.commands.medicFollowAttachMode, false);
});

test('APC support mode stores target Platoon identity instead of duplicating members', () => {
  const g = game();
  const apc = addUnit(g, 'apc', 6000, 4300), rifle = addUnit(g, 'rifleman', 6100, 4300), scout = addUnit(g, 'scout', 6150, 4300);
  createOrMergePlatoon(g, rifle, scout);
  selectUnit(g, apc);
  assert.equal(beginApcSupport(g), true);
  const result = handleWorldTap(g, rifle.x, rifle.y);
  assert.equal(result.ok, true);
  assert.equal(apc.v47SupportPlatoonId, rifle.platoonId);
  assert.equal(apc.v47SupportUnitId, null);
});

test('Attach-to-Truck mode records one transport-follow relationship without changing logistics ownership', () => {
  const g = game();
  const rifle = addUnit(g, 'rifleman', 6000, 4300), truck = addUnit(g, 'truck', 6060, 4300);
  selectUnit(g, rifle);
  assert.equal(beginTruckAttach(g), true);
  const result = handleWorldTap(g, truck.x, truck.y);
  assert.equal(result.ok, true);
  assert.equal(rifle.attachedTo, truck.id);
  assert.equal(truck.routeActive, false);
});

test('wall interaction review/confirm path uses the clean placement owner', () => {
  const g = game();
  g.state.resources.metal = 100;
  chooseBuildType(g, 'wall');
  handleWorldTap(g, 6500, 4300);
  handleWorldTap(g, 6600, 4300);
  const review = reviewWallPath(g);
  assert.equal(review.ok, true);
  assert.equal(g.state.commands.wall.reviewOpen, true);
  const result = confirmWallPath(g);
  assert.equal(result.ok, true);
  assert.equal(g.state.commands.wall.reviewOpen, false);
  assert.equal(g.state.commands.wall.path.length, 0);
});

test('clean UI/input entry points remain Node-safe when DOM/canvas are absent', () => {
  const g = game();
  assert.doesNotThrow(() => initInput(g));
  assert.doesNotThrow(() => initUI(g));
});
