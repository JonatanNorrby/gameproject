import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createLegacyEnemyGame,
  installLegacyEnemyBridge,
  normalizeLegacyEnemyState,
} from '../js/migration/enemyLegacyBridge.js';
import { enemyBountyGold } from '../js/enemies/enemyLifecycle.js';

function makeState({ credits = 125, elapsed = 0 } = {}) {
  return {
    credits,
    metal: 0,
    elapsed,
    baseHp: 300,
    maxBaseHp: 300,
    gameOver: false,
    units: [],
    enemies: [],
    structures: [],
    terrain: [],
    depots: [],
    rivers: [],
    enemyBullets: [],
    particles: [],
    v24Effects: [],
    v47ResourceCaches: [],
    v47Director: {
      hordeNo: 0,
      queue: 0,
      batchTimer: 0,
      nextHordeIn: 26,
      angle: 0,
      spawnRadius: 1500,
    },
    debug: { unlimitedCash: false, unlimitedLives: false },
    mods: { flameDamage: 1, burnDuration: 1 },
  };
}

function harness(initial = makeState(), { random = () => 0.5 } = {}) {
  let state = initial;
  let installed = null;
  let audit = null;
  const effects = [];
  const destroyed = [];
  const host = {
    baseX: 5060,
    baseY: 3795,
    baseRadius: 68,
    getState: () => state,
    now: () => 1000,
    random,
    installOwners(owners) { installed = owners; return () => {}; },
    emitEnemyProjectile(projectile) { state.enemyBullets.push(projectile); return projectile; },
    emitEffect(effect) { effects.push(effect); return effect; },
    onEnemyDestroyed(enemy, reward) { destroyed.push({ enemy, reward }); },
    onBaseDestroyed() {},
    markReady(value) { audit = value; },
  };
  return {
    host,
    effects,
    destroyed,
    get state() { return state; },
    replace(next) { state = next; },
    get installed() { return installed; },
    get audit() { return audit; },
  };
}

function install(h = harness()) {
  const bridge = installLegacyEnemyBridge(h.host);
  return { h, ...bridge };
}

test('Step 4 installs clean director, actor, spawn and player-damage entry owners', () => {
  const { h, owners, audit } = install();
  assert.equal(h.installed, owners);
  assert.equal(audit.active, true);
  assert.equal(audit.projectileSimulationOwner, 'legacy');
  assert.equal(audit.towerCombatOwner, 'legacy');
  assert.equal(audit.resourceCacheCaptureOwner, 'legacy-v47');
  for (const key of ['updateDirector', 'updateEnemies', 'spawnEnemy', 'hitEnemy']) {
    assert.equal(typeof owners[key], 'function');
  }
});

test('clean production director preserves v47 first-horde launch and five-enemy batch semantics', () => {
  const { h, owners } = install(harness(makeState(), { random: () => 0.5 }));
  const launch = owners.updateDirector(26);
  assert.equal(launch.launched, true);
  assert.equal(h.state.v47Director.hordeNo, 1);
  assert.equal(h.state.v47Director.queue, 34);
  assert.equal(h.state.enemies.length, 0);

  const batch = owners.updateDirector(0.01);
  assert.equal(batch.spawned, 5);
  assert.equal(h.state.v47Director.queue, 29);
  assert.equal(h.state.enemies.length, 5);
  assert.ok(h.state.enemies.every(enemy => enemy.id && enemy.horde === true));
  assert.equal(h.state.director, h.state.v47Director);
});

test('actor production pass does not advance the director a second time', () => {
  const state = makeState();
  state.v47Director.nextHordeIn = 10;
  const { h, owners } = install(harness(state));
  owners.updateEnemies(1);
  assert.equal(h.state.v47Director.nextHordeIn, 10);
});

test('clean Spitter AI emits into the existing legacy enemy projectile collection', () => {
  const { h, owners } = install();
  const target = { id: 'u1', type: 'airunit', role: 'combatdrone', x: 1160, y: 1000, hp: 100, maxHp: 100 };
  h.state.units.push(target);
  const spitter = owners.spawnEnemy('spitter', { horde: false, position: { x: 1000, y: 1000 } });
  spitter.rangeCooldown = 0;

  owners.updateEnemies(0.1);
  assert.equal(h.state.enemyBullets.length, 1);
  assert.equal(h.state.enemyBullets[0].target, target);
  assert.equal(h.state.enemyBullets[0].type, 'spitter');
  assert.equal(target.hp, 100, 'projectile travel/impact remains legacy-owned');
});

test('legacy hitEnemy entry applies clean damage but enemy reward/removal occurs only in clean lifecycle', () => {
  const { h, owners } = install(harness(makeState({ credits: 100 })));
  const enemy = owners.spawnEnemy('ravager', { horde: false, position: { x: 500, y: 500 } });
  const reward = enemyBountyGold(enemy);
  enemy.hp = 1;

  owners.hitEnemy(enemy, 50);
  assert.equal(h.state.enemies.includes(enemy), true);
  assert.equal(h.state.credits, 100);

  owners.updateEnemies(0.016);
  assert.equal(h.state.enemies.includes(enemy), false);
  assert.equal(h.state.credits, 100 + reward);
  assert.equal(h.destroyed.length, 1);
  assert.equal(h.destroyed[0].enemy, enemy);
  assert.equal(h.destroyed[0].reward, reward);
});

test('legacy cache guards are normalized and use clean guard AI while v47 capture remains untouched', () => {
  const state = makeState();
  state.v47ResourceCaches.push({
    id: 'cache-1', x: 2000, y: 2000, r: 30, capture: 1.25,
    captured: false, guardsSpawned: true,
  });
  state.enemies.push({
    type: 'ravager', x: 2040, y: 2000, hp: 30, maxHp: 30,
    speed: 20, r: 7, damage: 5, burn: 0, burnTick: 0, slowFactor: 1, slowTime: 0,
    v47GuardBoxId: 'cache-1', v47GuardHomeX: 2040, v47GuardHomeY: 2000,
  });
  state.units.push({ id: 'u1', type: 'soldier', role: 'rifleman', x: 2050, y: 2000, hp: 100, maxHp: 100 });
  const { h, owners } = install(harness(state));
  const before = h.state.units[0].hp;

  owners.updateEnemies(1);
  assert.equal(h.state.enemies[0].cacheGuard.cacheId, 'cache-1');
  assert.ok(h.state.units[0].hp < before);
  assert.equal(h.state.v47ResourceCaches[0].capture, 1.25, 'clean Step 4 must not double-run v47 cache capture');
});

test('Step 4 bridge follows a completely replaced legacy state object after Restart', () => {
  const original = makeState();
  const h = harness(original);
  const { owners } = install(h);
  const restarted = makeState({ elapsed: 120 });
  restarted.v47Director.nextHordeIn = 7;
  h.replace(restarted);

  owners.updateDirector(1);
  assert.equal(restarted.v47Director.nextHordeIn, 6);
  assert.equal(original.v47Director.nextHordeIn, 26);
  assert.equal(restarted.director, restarted.v47Director);
});

test('normalization preserves dead enemies and never revives zero HP', () => {
  const h = harness();
  h.state.enemies.push({ type: 'brute', x: 100, y: 100, hp: 0, maxHp: Number.NaN, speed: 0, damage: 1 });
  const game = createLegacyEnemyGame(h.host);
  normalizeLegacyEnemyState(game);
  assert.equal(h.state.enemies[0].hp, 0);
  assert.ok(Number.isFinite(h.state.enemies[0].maxHp));
  assert.ok(h.state.enemies[0].id);
});
