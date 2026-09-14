import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../js/core/game.js';
import { drawProductionProjectiles } from '../js/rendering/projectilePresentation.js';

function context() {
  const calls = { arcs: 0, lines: 0, fills: 0, strokes: 0 };
  return {
    calls,
    beginPath() {},
    moveTo() {},
    lineTo() { calls.lines++; },
    arc() { calls.arcs++; },
    fill() { calls.fills++; },
    stroke() { calls.strokes++; },
    save() {},
    restore() {},
  };
}

test('unified hostile projectile renders as the current green orb rather than a friendly tracer', () => {
  const game = createGame();
  game.state.entities.projectiles.push({ team: 'enemy', type: 'spitter', x: 10, y: 20, vx: 100, vy: 0 });
  const ctx = context();
  drawProductionProjectiles(game, ctx);
  assert.equal(ctx.calls.arcs, 1);
  assert.equal(ctx.calls.fills, 1);
  assert.equal(ctx.calls.lines, 0);
  assert.equal(ctx.calls.strokes, 0);
  assert.equal(ctx.fillStyle, '#9cff55');
});

test('friendly projectile still renders as a motion tracer from the same collection', () => {
  const game = createGame();
  game.state.entities.projectiles.push({ team: 'player', type: 'laser', x: 10, y: 20, vx: 100, vy: 0 });
  const ctx = context();
  drawProductionProjectiles(game, ctx);
  assert.equal(ctx.calls.arcs, 0);
  assert.equal(ctx.calls.fills, 0);
  assert.equal(ctx.calls.lines, 1);
  assert.equal(ctx.calls.strokes, 1);
  assert.equal(ctx.strokeStyle, '#ff5967');
});
