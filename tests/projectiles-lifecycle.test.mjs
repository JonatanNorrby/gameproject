import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../js/core/game.js';
import { createBuildingRuntime } from '../js/buildings/buildingRuntime.js';
import { addStoredResource, getResource, getStoredResource } from '../js/economy/resources.js';
import { updateLandingPads, EXPORT_SHIP_STATES } from '../js/economy/landingPads.js';
import { emitEnemyProjectile, emitPlayerProjectile, updateProjectiles } from '../js/combat/projectiles.js';
import { applyBurn, applyCorrosion, applySlow, markEnemy, updateStatusEffects } from '../js/combat/statusEffects.js';
import { applyBaseDamage, cleanupDestroyedEntities } from '../js/combat/lifecycle.js';
import { updateCombat } from '../js/combat/combat.js';

function game(services = {}) { return createGame({ now: () => 1000, services }); }
function enemy(g, type = 'ravager', x = 100, y = 100, hp = 100) {
  const e = { id: `e${g.state.entities.enemies.length}`, type, x, y, hp, maxHp: hp, r: type === 'brute' ? 20 : 12, speed: 100, damage: 1 };
  g.state.entities.enemies.push(e); return e;
}
function unit(g, role = 'rifleman', x = 100, y = 100, hp = 100) {
  const u = { id: `u${g.state.entities.units.length}`, type: role === 'truck' ? 'truck' : 'soldier', role: role === 'rifleman' ? undefined : role, x, y, hp, maxHp: hp, path: [], moveTarget: null, platoonId: null };
  g.state.entities.units.push(u); return u;
}
function building(g, type = 'refinery', x = 100, y = 100) {
  const result = createBuildingRuntime(g, type, { built: true, x, y });
  assert.equal(result.ok, true); g.state.entities.structures.push(result.building); return result.building;
}

test('player projectile physically collides and applies normal damage', () => {
  const g = game(); const e = enemy(g, 'ravager', 110, 100, 100);
  emitPlayerProjectile(g, { x: 100, y: 100, vx: 20, vy: 0, dmg: 10, life: 2.2, type: 'soldier' });
  const result = updateProjectiles(g, 0.5);
  assert.equal(result.hits, 1); assert.equal(e.hp, 90); assert.equal(g.state.entities.projectiles.length, 0);
});

test('mark multiplier is evaluated at impact, not projectile emission', () => {
  const g = game(); const e = enemy(g, 'ravager', 110, 100, 100);
  emitPlayerProjectile(g, { x: 100, y: 100, vx: 20, vy: 0, dmg: 10, type: 'soldier' });
  markEnemy(e, 1.5, 2);
  updateProjectiles(g, 0.5);
  assert.equal(e.hp, 85);
});

test('expired mark no longer modifies a projectile that lands afterward', () => {
  const g = game(); const e = enemy(g, 'ravager', 110, 100, 100);
  markEnemy(e, 2, 0.1);
  emitPlayerProjectile(g, { x: 100, y: 100, vx: 20, vy: 0, dmg: 10, type: 'soldier' });
  updateStatusEffects(g, 0.2);
  updateProjectiles(g, 0.5);
  assert.equal(e.markMult, 1); assert.equal(e.hp, 90);
});

test('burrowed enemy still physically collides but takes the legacy 20% projectile damage', () => {
  const g = game(); const e = enemy(g, 'burrower', 110, 100, 100); e.burrowed = true;
  emitPlayerProjectile(g, { x: 100, y: 100, vx: 20, vy: 0, dmg: 10 });
  updateProjectiles(g, 0.5);
  assert.equal(e.hp, 98);
});

test('enemy projectile follows a locked target and deals raw damage', () => {
  const g = game(); const u = unit(g, 'rifleman', 110, 100, 100);
  emitEnemyProjectile(g, { x: 100, y: 100, vx: 20, vy: 0, dmg: 12, target: u, type: 'spitter' });
  updateProjectiles(g, 0.5);
  assert.equal(u.hp, 88);
});

test('enemy projectile is discarded if its locked target leaves the world collection', () => {
  const g = game(); const u = unit(g, 'rifleman', 110, 100, 100);
  emitEnemyProjectile(g, { x: 100, y: 100, vx: 20, vy: 0, dmg: 12, target: u });
  g.state.entities.units.splice(0, 1);
  updateProjectiles(g, 0.1);
  assert.equal(g.state.entities.projectiles.length, 0); assert.equal(u.hp, 100);
});

test('in-flight enemy projectile loses a Spotter target', () => {
  const g = game(); const s = unit(g, 'spotter', 110, 100, 90);
  emitEnemyProjectile(g, { x: 100, y: 100, vx: 20, vy: 0, dmg: 20, target: s });
  updateProjectiles(g, 0.5);
  assert.equal(s.hp, 90); assert.equal(g.state.entities.projectiles.length, 0);
});

test('Spitter projectile impact does not receive Acid corrosion amplification', () => {
  const g = game(); const refinery = building(g, 'refinery', 110, 100); refinery.acidTime = 5; const hp = refinery.hp;
  emitEnemyProjectile(g, { x: 100, y: 100, vx: 20, vy: 0, dmg: 10, target: refinery, type: 'spitter' });
  updateProjectiles(g, 0.5);
  assert.equal(refinery.hp, hp - 10);
});

test('enemy projectile hitting a landed Landing Pad is intercepted by export ship and loses cargo on lethal hit', () => {
  const g = game(); const pad = building(g, 'landingpad', 110, 100);
  addStoredResource(pad.resourceStore, 'crystal', 100, { capacity: 520 });
  updateLandingPads(g, 2);
  assert.equal(pad.exportShip.state, EXPORT_SHIP_STATES.LANDED);
  assert.equal(getStoredResource(pad.exportShip.cargoStore, 'crystal'), 68);
  const padHp = pad.hp;
  emitEnemyProjectile(g, { x: 100, y: 100, vx: 20, vy: 0, dmg: 300, target: pad, type: 'spitter' });
  updateProjectiles(g, 0.5);
  assert.equal(pad.hp, padHp);
  assert.equal(pad.exportShip.state, EXPORT_SHIP_STATES.COOLDOWN);
  assert.equal(getStoredResource(pad.exportShip.cargoStore, 'crystal'), 0);
});

test('projectiles expire cleanly and invalid coordinates are removed', () => {
  const g = game();
  emitPlayerProjectile(g, { x: 0, y: 0, vx: 1, vy: 0, dmg: 1, life: 0.05 });
  emitPlayerProjectile(g, { x: Number.NaN, y: 0, vx: 1, vy: 0, dmg: 1, life: 2 });
  updateProjectiles(g, 0.1);
  assert.equal(g.state.entities.projectiles.length, 0);
});

test('burn ticks once per frame through player damage semantics', () => {
  const g = game(); const e = enemy(g, 'ravager', 100, 100, 100);
  markEnemy(e, 2, 2); applyBurn(e, 2);
  updateStatusEffects(g, 0.02);
  assert.equal(e.hp, 100 - 4.2 * 2);
  const after = e.hp; updateStatusEffects(g, 0.02); assert.equal(e.hp, after);
});

test('slow expiry and corrosion expiry have one shared timer owner', () => {
  const g = game(); const e = enemy(g); const refinery = building(g);
  applySlow(e, 0.5, 0.1); applyCorrosion(refinery, 0.1);
  updateStatusEffects(g, 0.1);
  assert.equal(e.slowTime, 0); assert.equal(refinery.acidTime, 0);
  updateStatusEffects(g, 0.01);
  assert.equal(e.slowFactor, 1);
});

test('dead enemy cleanup grants bounty exactly once', () => {
  const g = game(); g.state.resources.gold = 0; const e = enemy(g, 'ravager', 0, 0, 0); e.hp = 0;
  const first = cleanupDestroyedEntities(g); const gold = getResource(g, 'gold');
  const second = cleanupDestroyedEntities(g);
  assert.equal(first.enemies, 1); assert.equal(second.enemies, 0); assert.ok(gold > 0); assert.equal(getResource(g, 'gold'), gold);
});

test('destroyed APC ejects passenger with exactly 30% current-HP loss and minimum survival', () => {
  const g = game(); const apc = unit(g, 'apc', 1000, 1000, 0); apc.hp = 0;
  const p = unit(g, 'rifleman', 1000, 1000, 100); apc.passengerId = p.id; p.transportedIn = apc.id;
  cleanupDestroyedEntities(g);
  assert.equal(p.transportedIn, null); assert.equal(p.hp, 70); assert.ok(g.state.entities.units.includes(p)); assert.ok(!g.state.entities.units.includes(apc));
});

test('destroyed unit leaves its Platoon and small remaining Platoon dissolves', () => {
  const g = game(); const a = unit(g, 'rifleman', 100, 100, 0); const b = unit(g, 'rifleman', 130, 100, 100);
  a.platoonId = b.platoonId = 'p1'; a.platoonSlot = 0; b.platoonSlot = 1;
  cleanupDestroyedEntities(g);
  assert.equal(b.platoonId, null); assert.equal(b.platoonSlot, 0);
});

test('destroyed structure is removed and selected storage reference is cleared', () => {
  const g = game(); const refinery = building(g); refinery.hp = 0; g.state.selection.storageBuildingId = refinery.id;
  const result = cleanupDestroyedEntities(g);
  assert.equal(result.structures, 1); assert.equal(g.state.selection.storageBuildingId, null);
});

test('Base destruction sets game-over exactly once while unlimited lives blocks damage', () => {
  let destroyed = 0; const g = game({ lifecycle: { onBaseDestroyed: () => destroyed++ } });
  g.state.base.hp = 10;
  applyBaseDamage(g, 20);
  assert.equal(g.state.session.gameOver, true); assert.equal(destroyed, 1);
  applyBaseDamage(g, 20); assert.equal(destroyed, 1);
  const h = game(); h.state.debug.unlimitedLives = true; const hp = h.state.base.hp;
  applyBaseDamage(h, 999); assert.equal(h.state.base.hp, hp); assert.equal(h.state.session.gameOver, false);
});

test('clean combat update advances persistent projectiles once and performs death cleanup', () => {
  const g = game(); const e = enemy(g, 'ravager', 110, 100, 5);
  emitPlayerProjectile(g, { x: 100, y: 100, vx: 20, vy: 0, dmg: 10 });
  const result = updateCombat(g, 0.5);
  assert.equal(result.projectiles.hits, 1); assert.equal(result.lifecycle.enemies, 1); assert.equal(g.state.entities.enemies.length, 0);
});
