import test from 'node:test';
import assert from 'node:assert/strict';
import { createEnemy } from '../js/enemies/enemySpawning.js';
import { updateEnemyActor } from '../js/enemies/enemyAi.js';
import { isNavigationPointBlocked } from '../js/navigation/pathfinding.js';

function gameFixture() {
  return {
    config: {
      world: { width: 2200, height: 1800, baseRadius: 68 },
      pathfinding: { cellSize: 48, maxVisited: 50000, maxOpenDetourAngle: 0.78 },
      rivers: { slowFactor: 0.50 },
      towerDurability: {
        enemyMeleeAttackRange: 20,
        enemyMeleeAggroRange: 105,
        enemyMeleeDamageMultiplier: 1,
      },
      director: { enemySpeedMultiplier: 0.30 },
      buildings: { wall: { wall: { thickness: 12 } } },
    },
    state: {
      time: { elapsed: 100 },
      base: { x: 600, y: 300, radius: 68, hp: 300, maxHp: 300 },
      entities: {
        units: [], enemies: [], structures: [], terrain: [], depots: [], rivers: [],
        projectiles: [], enemyProjectiles: [], particles: [], playerMines: [], effects: [], resourceCaches: [],
      },
      modifiers: { flameDamage: 1 },
      debug: { unlimitedCash: false, unlimitedLives: false },
    },
    services: { random: () => 0.5 },
  };
}

test('Burrower repairs a blocked emergence point and never exits inside world collision', () => {
  const game = gameFixture();
  const wall = {
    id: 'wall-1', type: 'wall', x: 370, y: 300,
    x1: 370, y1: 220, x2: 370, y2: 380,
    thickness: 12, built: true, hp: 1000, maxHp: 1000,
  };
  // The raw v24 emergence point for this geometry is approximately x=433,y=300.
  // Put a real building there so the repaired exit must account for object collision,
  // not only natural terrain. The closer Wall leaves enough legitimate space for a
  // repaired point while still enforcing the real 155px maximum burrow distance.
  const blocker = {
    id: 'refinery-1', type: 'refinery', x: 433, y: 300,
    built: true, hp: 200, maxHp: 200,
  };
  game.state.entities.structures.push(wall, blocker);

  const enemy = createEnemy(game, 'burrower', {
    horde: false,
    position: { x: 300, y: 300 },
  });
  enemy.effectiveSpeed = enemy.speed;
  enemy.burrowCooldown = 0;
  game.state.entities.enemies.push(enemy);

  updateEnemyActor(game, enemy, 0.1);

  assert.equal(enemy.burrowed, true);
  assert.ok(enemy.burrowExit);
  assert.equal(isNavigationPointBlocked(game, enemy.burrowExit.x, enemy.burrowExit.y, enemy.r + 2), false);
  assert.ok(Math.hypot(enemy.burrowExit.x - enemy.x, enemy.burrowExit.y - enemy.y) <= 155);
  assert.ok(Math.hypot(enemy.burrowExit.x - blocker.x, enemy.burrowExit.y - blocker.y) > 1);
});
