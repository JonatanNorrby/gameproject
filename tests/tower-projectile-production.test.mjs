import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createLegacyTowerProjectileGame,
  installLegacyTowerProjectileBridge,
  normalizeLegacyTowerProjectileState,
} from '../js/migration/towerProjectileLegacyBridge.js';

function makeState() {
  return {
    credits: 125,
    metal: 0,
    baseHp: 300,
    maxBaseHp: 300,
    gameOver: false,
    units: [],
    enemies: [],
    structures: [],
    terrain: [],
    depots: [],
    rivers: [],
    bullets: [],
    enemyBullets: [],
    debug: { unlimitedCash: false, unlimitedLives: false },
    mods: { laserRate: 1, laserDamage: 1, flameDamage: 1, burnDuration: 1 },
  };
}

function harness(initial = makeState()) {
  let state = initial;
  let installed = null;
  let audit = null;
  let cleanupCalls = 0;
  const effects = [];
  const host = {
    baseX: 5060,
    baseY: 3795,
    baseRadius: 68,
    getState: () => state,
    now: () => 1000,
    random: () => 0.5,
    installOwners(owners) { installed = owners; return () => {}; },
    cleanupDestroyed() { cleanupCalls++; },
    emitPlayerProjectile(projectile) { state.bullets.push(projectile); return projectile; },
    emitEffect(effect) { effects.push(effect); return effect; },
    isEnemyVisible: () => true,
    isEnemyRevealed: enemy => !enemy?.cloaked,
    onShipDestroyed() {},
    markReady(value) { audit = value; },
  };
  return {
    host,
    effects,
    get state() { return state; },
    replace(next) { state = next; },
    get installed() { return installed; },
    get audit() { return audit; },
    get cleanupCalls() { return cleanupCalls; },
  };
}

function install(h = harness()) {
  const bridge = installLegacyTowerProjectileBridge(h.host);
  return { h, ...bridge };
}

test('Step 5 installs one clean owner for tower decisions and projectile simulation', () => {
  const { h, owners, audit } = install();
  assert.equal(h.installed, owners);
  assert.equal(audit.active, true);
  assert.equal(audit.towerCombatOwner, 'js/combat/towerCombat.js');
  assert.equal(audit.towerTargetingOwner, 'js/combat/towerTargeting.js');
  assert.equal(audit.projectileSimulationOwner, 'js/combat/projectiles.js');
  assert.equal(audit.structureLifecycleOwner, 'legacy-until-step6');
  assert.equal(typeof owners.updateTowers, 'function');
  assert.equal(typeof owners.updateProjectiles, 'function');
});

test('clean production tower owner emits into the existing legacy player bullet array', () => {
  const state = makeState();
  state.structures.push({
    id: 'tower-1', type: 'laser', x: 1000, y: 1000,
    hp: 100, maxHp: 100, built: true, level: 1, cool: 0,
  });
  state.enemies.push({
    id: 'enemy-1', type: 'ravager', x: 1100, y: 1000,
    hp: 100, maxHp: 100, r: 7,
  });
  const { h, owners } = install(harness(state));

  const actions = owners.updateTowers(0.016);
  assert.equal(actions, 1);
  assert.equal(h.state.bullets.length, 1);
  assert.equal(h.state.bullets[0].type, 'laser');
  assert.equal(h.state.bullets[0].sourceId, 'tower-1');
  assert.equal(h.state.enemies[0].hp, 100, 'level-1 Laser remains a persistent projectile attack');
});

test('both legacy projectile arrays are simulated by clean collision logic and cleanup runs once', () => {
  const state = makeState();
  const enemy = { id: 'enemy-1', type: 'ravager', x: 500, y: 500, hp: 50, maxHp: 50, r: 7 };
  const unit = { id: 'unit-1', type: 'soldier', role: 'rifleman', x: 700, y: 700, hp: 60, maxHp: 60 };
  state.enemies.push(enemy);
  state.units.push(unit);
  // Deliberately omit team fields: production storage identity is the compatibility hint.
  state.bullets.push({ x: 500, y: 500, vx: 0, vy: 0, dmg: 12, life: 1, type: 'soldier' });
  state.enemyBullets.push({ x: 700, y: 700, vx: 0, vy: 0, dmg: 9, life: 1, type: 'spitter', target: unit });
  const { h, owners } = install(harness(state));

  const result = owners.updateProjectiles(0.016);
  assert.equal(enemy.hp, 38);
  assert.equal(unit.hp, 51);
  assert.equal(state.bullets.length, 0);
  assert.equal(state.enemyBullets.length, 0);
  assert.equal(result.hits, 2);
  assert.equal(h.cleanupCalls, 1, 'legacy-compatible structure/unit cleanup runs once after both collections');
});

test('enemy projectile keeps locked-target semantics and is discarded when the target leaves the world', () => {
  const state = makeState();
  const removedTarget = { id: 'gone', type: 'soldier', role: 'rifleman', x: 200, y: 200, hp: 60, maxHp: 60 };
  state.enemyBullets.push({ x: 200, y: 200, vx: 0, vy: 0, dmg: 25, life: 1, type: 'spitter', target: removedTarget });
  const { owners } = install(harness(state));

  const result = owners.updateProjectiles(0.016);
  assert.equal(removedTarget.hp, 60);
  assert.equal(state.enemyBullets.length, 0);
  assert.equal(result.enemy.removed, 1);
});

test('Step 5 bridge follows complete legacy state replacement after Restart', () => {
  const original = makeState();
  const h = harness(original);
  const { owners } = install(h);
  const restarted = makeState();
  restarted.bullets.push({ x: 20, y: 20, vx: 0, vy: 0, dmg: 1, life: 0.001, type: 'soldier' });
  h.replace(restarted);

  owners.updateProjectiles(0.016);
  assert.equal(restarted.bullets.length, 0);
  assert.equal(original.bullets.length, 0);
  assert.equal(h.cleanupCalls, 1);
});

test('tower normalization preserves zero HP and never revives a destroyed tower', () => {
  const h = harness();
  h.state.structures.push({ type: 'laser', x: 100, y: 100, hp: 0, maxHp: Number.NaN, built: true, cool: Number.NaN });
  const game = createLegacyTowerProjectileGame(h.host);
  normalizeLegacyTowerProjectileState(game, h.host);
  const tower = h.state.structures[0];
  assert.equal(tower.hp, 0);
  assert.ok(Number.isFinite(tower.maxHp));
  assert.equal(tower.cool, 0);
  assert.equal(tower.level, 1);
});
