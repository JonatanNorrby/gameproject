import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameConfig } from '../js/core/config.js';
import { createInitialState } from '../js/core/state.js';
import { getUnitConfig } from '../js/units/unitConfig.js';
import { getEnemyConfig } from '../js/enemies/enemyConfig.js';
import { getTowerConfig } from '../js/towers/towerConfig.js';
import { applyDamage, isAlive, isDamageable } from '../js/combat/damage.js';
import { canAttackTarget } from '../js/combat/targeting.js';
import { attackDistance, isInAttackRange, RANGE_MODES } from '../js/combat/range.js';
import { tickCooldown, isCooldownReady, resetCooldown } from '../js/combat/cooldowns.js';

function createTestGame() {
  const config = createGameConfig();
  const state = createInitialState({ config, now: () => 0 });
  return { config, state };
}

function createUnit(role, x = 1000, y = 1000) {
  const definition = getUnitConfig(role);
  return {
    id: `unit-${role}-${Math.random()}`,
    type: definition.runtimeType,
    role,
    x,
    y,
    hp: definition.maxHp,
    maxHp: definition.maxHp,
  };
}

function createEnemy(type, x = 1100, y = 1000) {
  const definition = getEnemyConfig(type);
  return {
    id: `enemy-${type}-${Math.random()}`,
    type,
    x,
    y,
    hp: definition.baseHp,
    maxHp: definition.baseHp,
    r: definition.radius,
  };
}

function createTower(type, x = 1000, y = 1000) {
  const definition = getTowerConfig(type);
  return {
    id: `tower-${type}-${Math.random()}`,
    type,
    x,
    y,
    hp: definition.maxHp,
    maxHp: definition.maxHp,
    built: true,
  };
}

test('100 HP takes 20 damage and becomes 80 HP', () => {
  const target = { hp: 100 };
  const result = applyDamage(null, target, 20);
  assert.equal(result.applied, true);
  assert.equal(result.destroyed, false);
  assert.equal(target.hp, 80);
});

test('lethal damage preserves current overkill-below-zero semantics', () => {
  const target = { hp: 10 };
  const result = applyDamage(null, target, 15);
  assert.equal(result.destroyed, true);
  assert.equal(target.hp, -5);
  assert.equal(isAlive(target), false);
});

test('repeated damage cannot revive or re-destroy an already dead entity', () => {
  const target = { hp: 3 };
  let deaths = 0;
  applyDamage(null, target, 5, { onDestroyed: () => deaths++ });
  const second = applyDamage(null, target, 7, { onDestroyed: () => deaths++ });
  assert.equal(target.hp, -2);
  assert.equal(second.applied, false);
  assert.equal(second.reason, 'already-dead');
  assert.equal(deaths, 1);
});

test('invalid damage is rejected without corrupting HP', () => {
  const target = { hp: 100 };
  assert.equal(applyDamage(null, target, NaN).applied, false);
  assert.equal(applyDamage(null, target, -4).applied, false);
  assert.equal(target.hp, 100);
});

test('alive and damageable mean finite HP strictly greater than zero', () => {
  assert.equal(isAlive({ hp: 1 }), true);
  assert.equal(isAlive({ hp: 0 }), false);
  assert.equal(isAlive({ hp: -1 }), false);
  assert.equal(isDamageable({ hp: NaN }), false);
});

test('ground-only Mobile Artillery cannot target a Flyer', () => {
  const game = createTestGame();
  const attacker = createUnit('mobileartillery');
  const target = createEnemy('flyer');
  game.state.entities.units.push(attacker);
  game.state.entities.enemies.push(target);
  assert.equal(getUnitConfig('mobileartillery').combat.range, 540);
  assert.equal(getUnitConfig('mobileartillery').combat.minRange, 125);
  assert.equal(canAttackTarget(game, attacker, target), false);
});

test('Anti-Air can target air but not ground', () => {
  const game = createTestGame();
  const attacker = createTower('antiair');
  const air = createEnemy('flyer');
  const ground = createEnemy('ravager');
  game.state.entities.structures.push(attacker);
  game.state.entities.enemies.push(air, ground);
  assert.equal(getTowerConfig('antiair').range, 370);
  assert.equal(canAttackTarget(game, attacker, air), true);
  assert.equal(canAttackTarget(game, attacker, ground), false);
});

test('dual-capable Rifleman can target both ground and air', () => {
  const game = createTestGame();
  const attacker = createUnit('rifleman');
  const air = createEnemy('flyer');
  const ground = createEnemy('ravager');
  game.state.entities.units.push(attacker);
  game.state.entities.enemies.push(air, ground);
  assert.equal(getUnitConfig('rifleman').combat.range, 225);
  assert.equal(canAttackTarget(game, attacker, air), true);
  assert.equal(canAttackTarget(game, attacker, ground), true);
});

test('Sneaky Spotter remains excluded from generic enemy targeting', () => {
  const game = createTestGame();
  const target = createUnit('spotter');
  game.state.entities.units.push(target);
  assert.equal(canAttackTarget(game, { targeting: 'ground' }, target), false);
});

test('cloaked Saboteur requires a reveal hook and burrowed enemy stays ineligible', () => {
  const game = createTestGame();
  const cloaked = createEnemy('saboteur');
  cloaked.cloaked = true;
  const burrowed = createEnemy('burrower');
  burrowed.burrowed = true;
  game.state.entities.enemies.push(cloaked, burrowed);
  const attacker = { targeting: 'ground' };
  assert.equal(canAttackTarget(game, attacker, cloaked), false);
  assert.equal(canAttackTarget(game, attacker, cloaked, { isRevealed: () => true }), true);
  assert.equal(canAttackTarget(game, attacker, burrowed), false);
});

test('transported and garrisoned units are not eligible targets', () => {
  const game = createTestGame();
  const target = createUnit('rifleman');
  game.state.entities.units.push(target);
  const attacker = { targeting: 'ground' };
  target.transportedIn = 'apc-1';
  assert.equal(canAttackTarget(game, attacker, target), false);
  target.transportedIn = null;
  target.garrisonedIn = 'bunker-1';
  assert.equal(canAttackTarget(game, attacker, target), false);
});

test('center range preserves inclusive and strict legacy boundary variants', () => {
  const game = createTestGame();
  const attacker = { x: 0, y: 0 };
  const target = { x: 100, y: 0 };
  assert.equal(isInAttackRange(game, attacker, target, 100), true);
  assert.equal(isInAttackRange(game, attacker, target, 100, { inclusive: false }), false);
  assert.equal(isInAttackRange(game, attacker, { x: 101, y: 0 }, 100), false);
});

test('footprint mode reproduces radius-aware melee reach', () => {
  const game = createTestGame();
  const attacker = createUnit('rifleman', 0, 0);
  const target = createEnemy('flyer', 80, 0);
  assert.equal(attackDistance(game, attacker, target, { mode: RANGE_MODES.FOOTPRINT }), 48);
  assert.equal(isInAttackRange(game, attacker, target, 48, { mode: RANGE_MODES.FOOTPRINT }), true);
});

test('wall footprint range uses point-to-segment distance and half wall thickness', () => {
  const game = createTestGame();
  const attacker = createUnit('rifleman', 0, 0);
  const wall = { type: 'wall', x1: 100, y1: -50, x2: 100, y2: 50, hp: 100 };
  assert.equal(attackDistance(game, attacker, wall, { mode: RANGE_MODES.FOOTPRINT }), 71);
  assert.equal(isInAttackRange(game, attacker, wall, 71, { mode: RANGE_MODES.FOOTPRINT }), true);
});

test('cooldown decreases without clamping and becomes ready at zero', () => {
  assert.equal(tickCooldown(0.5, 0.2), 0.3);
  assert.equal(isCooldownReady(0.3), false);
  assert.equal(isCooldownReady(tickCooldown(0.1, 0.1)), true);
  assert.equal(tickCooldown(0.1, 0.2), -0.1);
});

test('cooldown reset preserves the caller-provided fire interval', () => {
  assert.equal(resetCooldown(1.42), 1.42);
  assert.equal(resetCooldown(0.12), 0.12);
});
