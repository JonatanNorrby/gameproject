import test from 'node:test';
import assert from 'node:assert/strict';
import { installLegacyEconomyBridge } from '../js/migration/economyLegacyBridge.js';

function makeLegacyState() {
  return {
    credits: 0,
    metal: 0,
    baseHp: 300,
    maxBaseHp: 300,
    mods: { mineRate: 1, mineStorage: 1, truckCapacity: 1 },
    debug: { unlimitedCash: false, unlimitedLives: false },
    units: [],
    structures: [],
    depots: [],
    rivers: [],
  };
}

function makeHost(getState) {
  let updateMines = null;
  let updateTruckEconomy = null;
  const messages = [];
  const landed = [];
  const host = {
    baseX: 5060,
    baseY: 3795,
    baseRadius: 68,
    getState,
    now: () => 1000,
    random: () => 0.5,
    setUpdateMines(fn) { updateMines = fn; },
    setUpdateTruckEconomy(fn) { updateTruckEconomy = fn; },
    issueMove(unit, x, y) {
      unit.path = [{ x, y }];
      unit.moveTarget = { x, y };
      return true;
    },
    attractEnemiesToPad(pad, event) { landed.push({ pad, event }); },
    message(text) { messages.push(text); },
    markReady(audit) { host.audit = audit; },
    get updateMines() { return updateMines; },
    get updateTruckEconomy() { return updateTruckEconomy; },
    messages,
    landed,
  };
  return host;
}

function crystalDepot({ id = 'crystal-depot', x = 6000, y = 3795, stock = 100 } = {}) {
  return { id, resourceType: 'crystal', x, y, r: 34, stock, mineId: null, mineIds: [] };
}

function crystalMine(depot, { id = 'crystal-mine', stored = 0 } = {}) {
  return {
    id,
    type: 'mine',
    x: depot.x,
    y: depot.y,
    hp: 210,
    maxHp: 210,
    built: true,
    stored,
    depotId: depot.id,
    mineSlot: 0,
  };
}

function landingPad({ id = 'pad', x = 7000, y = 3795, crystalStored = 0, cooldown = 0 } = {}) {
  return {
    id,
    type: 'landingpad',
    x,
    y,
    hp: 680,
    maxHp: 680,
    built: true,
    storageLevel: 1,
    crystalStored,
    shipState: 'cooldown',
    shipCooldown: cooldown,
    shipCargo: 0,
    shipHp: 0,
    shipMaxHp: 260,
    landingFlash: 0,
  };
}

function truck({ id = 'truck', x = 6000, y = 3795 } = {}) {
  return {
    id,
    type: 'truck',
    x,
    y,
    hp: 135,
    maxHp: 135,
    path: [],
    moveTarget: null,
    cargo: 0,
    cargoType: null,
    route: [],
    routeIndex: 0,
    routeLoop: false,
    routeActive: false,
    routeWaiting: false,
    routePendingStart: false,
  };
}

test('production bridge installs clean pre/post movement economy owners and legacy export-ship aliases', () => {
  const state = makeLegacyState();
  const depot = crystalDepot({ stock: 10 });
  const mine = crystalMine(depot);
  const pad = landingPad();
  state.depots.push(depot);
  state.structures.push(mine, pad);
  const host = makeHost(() => state);

  const migration = installLegacyEconomyBridge(host);
  assert.equal(typeof host.updateMines, 'function');
  assert.equal(typeof host.updateTruckEconomy, 'function');
  assert.equal(migration.audit.owner, 'js/economy/*');

  host.updateMines(1);
  assert.equal(mine.stored, 3.2);
  assert.equal(depot.stock, 6.8);
  assert.equal(pad.shipState, 'landed');
  assert.equal(pad.shipHp, 260);
  assert.equal(pad.exportShip.state, 'landed');
  assert.equal(host.landed.length, 1);

  pad.shipHp = 123;
  assert.equal(pad.exportShip.hp, 123);
  pad.exportShip.hp = 77;
  assert.equal(pad.shipHp, 77);
});

test('clean Truck logistics reads/writes the existing legacy cargo and building fields', () => {
  const state = makeLegacyState();
  const depot = crystalDepot({ stock: 0 });
  const mine = crystalMine(depot, { stored: 45 });
  const pad = landingPad({ x: 6500, cooldown: 120 });
  const logisticsTruck = truck({ x: mine.x, y: mine.y });
  state.depots.push(depot);
  state.structures.push(mine, pad);
  state.units.push(logisticsTruck);
  const host = makeHost(() => state);
  installLegacyEconomyBridge(host);

  host.updateTruckEconomy();
  assert.equal(logisticsTruck.cargo, 45);
  assert.equal(logisticsTruck.cargoType, 'crystal');
  assert.equal(mine.stored, 0);

  logisticsTruck.x = pad.x;
  logisticsTruck.y = pad.y;
  host.updateTruckEconomy();
  assert.equal(logisticsTruck.cargo, 0);
  assert.equal(logisticsTruck.cargoType, null);
  assert.equal(pad.crystalStored, 45);
});

test('clean export cycle updates legacy Gold and ship fields without a second economy state', () => {
  const state = makeLegacyState();
  const pad = landingPad({ crystalStored: 220, cooldown: 0 });
  state.structures.push(pad);
  const host = makeHost(() => state);
  installLegacyEconomyBridge(host);

  host.updateMines(1);
  assert.equal(pad.shipState, 'landed');
  assert.equal(pad.shipCargo, 34);
  assert.equal(pad.crystalStored, 186);

  host.updateMines(6);
  assert.equal(state.credits, 880);
  assert.equal(pad.crystalStored, 0);
  assert.equal(pad.shipState, 'cooldown');
  assert.equal(pad.shipCooldown, 120);
  assert.equal(pad.shipCargo, 0);
  assert.match(host.messages.at(-1), /880 gold/);
});

test('bridge follows a replaced legacy state object after Restart', () => {
  let current = makeLegacyState();
  const firstPad = landingPad({ id: 'first', crystalStored: 34, cooldown: 0 });
  current.structures.push(firstPad);
  const host = makeHost(() => current);
  installLegacyEconomyBridge(host);
  host.updateMines(1);
  assert.equal(firstPad.shipState, 'landed');

  current = makeLegacyState();
  const depot = crystalDepot({ id: 'after-reset', stock: 10 });
  const mine = crystalMine(depot, { id: 'after-reset-mine' });
  current.depots.push(depot);
  current.structures.push(mine);
  host.updateMines(1);

  assert.equal(mine.stored, 3.2);
  assert.equal(depot.stock, 6.8);
  assert.equal(current.credits, 0);
});
