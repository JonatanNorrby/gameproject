import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameConfig } from '../js/core/config.js';
import { createInitialState } from '../js/core/state.js';
import { createPlayerUnit, deployUnitFromBase } from '../js/units/deployment.js';
import { loadApc, unloadApc } from '../js/units/transport.js';

function createGame() {
  const config = createGameConfig();
  const state = createInitialState({ config, now: () => 0 });
  return {
    config,
    state,
    services: {
      now: () => 0,
      random: () => 0.5,
    },
  };
}

function blockingLake(x0, y0, x1, y1) {
  return {
    kind: 'lake',
    points: [
      { x: x0, y: y0 },
      { x: x1, y: y0 },
      { x: x1, y: y1 },
      { x: x0, y: y1 },
    ],
  };
}

test('ground deployment fails and refunds instead of using an unchecked blocked fallback', () => {
  const game = createGame();
  const beforeGold = game.state.resources.gold;
  game.state.entities.terrain.push(blockingLake(0, 0, game.config.world.width, game.config.world.height));

  const result = deployUnitFromBase(game, 'rifleman');
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'no-open-deployment-point');
  assert.equal(game.state.resources.gold, beforeGold);
  assert.equal(game.state.entities.units.length, 0);
});

test('voluntary APC unload keeps passenger loaded when every nearby unload point is blocked', () => {
  const game = createGame();
  const apc = createPlayerUnit(game, 'apc', { x: 2500, y: 2500 });
  const passenger = createPlayerUnit(game, 'rifleman', { x: 2540, y: 2500 });
  game.state.entities.units.push(apc, passenger);
  assert.equal(loadApc(game, apc, passenger).ok, true);

  game.state.entities.terrain.push(blockingLake(2200, 2200, 2800, 2800));
  const before = { x: passenger.x, y: passenger.y, hp: passenger.hp };
  const result = unloadApc(game, apc);

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'no-open-unload-point');
  assert.equal(apc.passengerId, passenger.id);
  assert.equal(passenger.transportedIn, apc.id);
  assert.deepEqual({ x: passenger.x, y: passenger.y, hp: passenger.hp }, before);
});
