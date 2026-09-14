import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createLegacyUnitCombatGame,
  installLegacyUnitCombatBridge,
  normalizeLegacyUnitCombatState,
} from '../js/migration/unitCombatLegacyBridge.js';

function makeState({ credits = 2000 } = {}) {
  return {
    credits,
    metal: 0,
    baseHp: 300,
    maxBaseHp: 300,
    units: [],
    enemies: [],
    structures: [],
    terrain: [],
    depots: [],
    rivers: [],
    bullets: [],
    playerMines: [],
    selectedUnit: null,
    v47MedicAttachMode: false,
    v47ApcAttachMode: false,
    debug: { unlimitedCash: false, unlimitedLives: false },
    mods: {
      soldierRate: 1,
      soldierDamage: 1,
      extraSoldiers: 0,
      unitMove: 1,
      truckHp: 1,
      truckCapacity: 1,
    },
  };
}

function harness(initial = makeState()) {
  let state = initial;
  let installed = null;
  let audit = null;
  const effects = [];
  const host = {
    baseX: 5060,
    baseY: 3795,
    baseRadius: 68,
    getState: () => state,
    now: () => 1000,
    random: () => 0.5,
    installOwners(owners) { installed = owners; return () => {}; },
    emitProjectile(projectile) { state.bullets.push(projectile); return projectile; },
    emitEffect(effect) { effects.push(effect); return effect; },
    isEnemyVisible: () => true,
    isEnemyRevealed: () => true,
    markReady(value) { audit = value; },
  };
  return {
    host,
    effects,
    get state() { return state; },
    replace(next) { state = next; },
    get installed() { return installed; },
    get audit() { return audit; },
  };
}

function install(h = harness()) {
  const bridge = installLegacyUnitCombatBridge(h.host);
  return { h, ...bridge };
}

test('Step 3 installs clean deployment, combat, APC transport and unit-only lifecycle owners', () => {
  const { h, owners, audit } = install();
  assert.equal(h.installed, owners);
  assert.equal(audit.active, true);
  assert.equal(audit.movementOwnerUnchanged, true);
  assert.equal(audit.projectileSimulationOwner, 'legacy');
  for (const key of ['updateUnitCombat', 'deployUnit', 'cleanupUnits', 'loadApc', 'unloadApc']) {
    assert.equal(typeof owners[key], 'function');
  }
});

test('clean production deployment spends legacy Gold and creates canonical Rifleman identity', () => {
  const { h, owners } = install(harness(makeState({ credits: 100 })));
  const result = owners.deployUnit('soldier');
  assert.equal(result.ok, true);
  assert.equal(h.state.credits, 60);
  assert.equal(h.state.units.length, 1);
  assert.equal(result.unit.role, 'rifleman');
  assert.equal(result.unit.type, 'soldier');
  assert.equal(result.unit.hp, result.unit.maxHp);
  assert.deepEqual(result.unit.path, []);
});

test('Combat Ship clean deployment preserves one-active limit without double spending', () => {
  const { h, owners } = install(harness(makeState({ credits: 1000 })));
  const first = owners.deployUnit('combatship');
  assert.equal(first.ok, true);
  const afterFirst = h.state.credits;
  const second = owners.deployUnit('combatship');
  assert.equal(second.ok, false);
  assert.equal(second.reason, 'max-active');
  assert.equal(h.state.credits, afterFirst);
  assert.equal(h.state.units.filter(unit => unit.role === 'combatship').length, 1);
});

test('clean player combat emits into the existing legacy bullet collection without type masquerading', () => {
  const { h, owners } = install();
  const deployed = owners.deployUnit('soldier');
  assert.equal(deployed.ok, true);
  const rifleman = deployed.unit;
  rifleman.x = 1000; rifleman.y = 1000;
  rifleman.combatCooldowns = Array(6).fill(0);
  const unitsRef = h.state.units;
  const enemy = { id: 'e1', type: 'ravager', x: 1100, y: 1000, hp: 100, maxHp: 100 };
  h.state.enemies.push(enemy);

  const actions = owners.updateUnitCombat(0.016);
  assert.ok(actions > 0);
  assert.ok(h.state.bullets.length > 0);
  assert.equal(h.state.units, unitsRef);
  assert.equal(rifleman.type, 'soldier');
  assert.equal(rifleman.role, 'rifleman');
  assert.equal(enemy.hp, 100, 'persistent projectile damage remains owned by legacy projectile simulation');
});

test('Engineer repair runs cleanly against Tank without temporary state.units filtering', () => {
  const { h, owners } = install();
  const engineer = owners.deployUnit('engineer').unit;
  const tank = owners.deployUnit('tank').unit;
  engineer.x = 1800; engineer.y = 1800;
  tank.x = 1830; tank.y = 1800;
  tank.hp = tank.maxHp - 100;
  const before = tank.hp;
  const unitsRef = h.state.units;
  const order = [...h.state.units];

  owners.updateUnitCombat(1);
  assert.ok(tank.hp > before);
  assert.equal(h.state.units, unitsRef);
  assert.deepEqual(h.state.units, order);
  assert.equal(tank.role, 'tank');
  assert.equal(tank.type, 'soldier');
});

test('clean APC load/unload preserves transport state and clears APC support on load', () => {
  const { owners } = install();
  const apc = owners.deployUnit('apc').unit;
  const medic = owners.deployUnit('medic').unit;
  apc.x = 2500; apc.y = 2500;
  medic.x = 2540; medic.y = 2500;
  apc.v47SupportUnitId = medic.id;
  apc.v47SupportTimer = 1;

  const loaded = owners.loadApc(apc, medic);
  assert.equal(loaded.ok, true);
  assert.equal(apc.passengerId, medic.id);
  assert.equal(medic.transportedIn, apc.id);
  assert.equal(apc.v47SupportUnitId, null);
  assert.equal(apc.v47SupportTimer, 0);

  const unloaded = owners.unloadApc(apc);
  assert.equal(unloaded.ok, true);
  assert.equal(apc.passengerId, null);
  assert.equal(medic.transportedIn, null);
});

test('unit-only lifecycle cleanly ejects destroyed APC passenger and removes relationships', () => {
  const { h, owners } = install();
  const apc = owners.deployUnit('apc').unit;
  const rifleman = owners.deployUnit('soldier').unit;
  const escort = owners.deployUnit('soldier').unit;
  apc.x = 3200; apc.y = 3200;
  rifleman.x = 3230; rifleman.y = 3200;
  escort.attachedTo = apc.id;
  escort.attachSlot = 2;
  assert.equal(owners.loadApc(apc, rifleman).ok, true);
  rifleman.hp = 100;
  apc.hp = 0;
  h.state.selectedUnit = apc;

  assert.equal(owners.cleanupUnits(), 1);
  assert.equal(h.state.units.includes(apc), false);
  assert.equal(rifleman.transportedIn, null);
  assert.equal(rifleman.hp, 70);
  assert.equal(escort.attachedTo, null);
  assert.equal(escort.attachSlot, 0);
  assert.equal(h.state.selectedUnit, null);
});

test('Step 3 bridge follows a completely replaced legacy state object after Restart', () => {
  const original = makeState({ credits: 2000 });
  const h = harness(original);
  const { owners } = install(h);
  const restarted = makeState({ credits: 500 });
  h.replace(restarted);

  const result = owners.deployUnit('medic');
  assert.equal(result.ok, true);
  assert.equal(restarted.units.length, 1);
  assert.equal(restarted.units[0].role, 'medic');
  assert.equal(restarted.credits, 420);
  assert.equal(original.units.length, 0);
  assert.equal(original.credits, 2000);
});

test('normalization never revives zero-HP legacy units', () => {
  const h = harness();
  h.state.units.push({ id: 'dead-medic', type: 'soldier', role: 'medic', hp: 0, maxHp: NaN });
  const game = createLegacyUnitCombatGame(h.host);
  normalizeLegacyUnitCombatState(game);
  assert.equal(h.state.units[0].hp, 0);
  assert.ok(Number.isFinite(h.state.units[0].maxHp));
  assert.equal(h.state.units[0].role, 'medic');
});
