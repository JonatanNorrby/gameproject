import { createGame } from './core/game.js';
import { initInput } from './input/input.js';
import { initUI } from './ui/ui.js';

// Future clean-runtime entry point. It is intentionally NOT imported by index.html
// and does not auto-run on module evaluation.
export function bootGame({ canvas = null, ctx = null, now = () => 0, services = {} } = {}) {
  const game = createGame({ canvas, ctx, now, services });
  const input = initInput(game);
  const ui = initUI(game);

  return Object.assign(game, {
    controllers: Object.freeze({ input, ui }),
  });
}
