import { createGame } from './core/game.js';
import {
  initializeRuntime,
  renderRuntime,
  resetRuntime,
  runRuntimeFrame,
  startRuntimeLoop,
  stepRuntime,
  stopRuntimeLoop,
} from './core/runtime.js';
import { initInput } from './input/input.js';
import { initUI } from './ui/ui.js';
import { ensureRuntimeControls } from './ui/domSetup.js';

// Clean-runtime entry point. It is intentionally NOT imported by index.html yet
// and does not auto-run on module evaluation. `autoStart` exists for the eventual
// production cutover and defaults to false while the legacy page remains live.
export function bootGame({ canvas = null, ctx = null, now = () => 0, services = {}, autoStart = false } = {}) {
  const game = createGame({ canvas, ctx, now, services });
  const doc = services?.ui?.document || (typeof document !== 'undefined' ? document : null);
  ensureRuntimeControls(doc);
  const input = initInput(game);
  // Expose gesture cancellation to UI overlays without giving UI ownership of
  // raw pointer state.
  if (game.input) game.input.cancelGesture = input.cancelGesture;
  const ui = initUI(game);

  initializeRuntime(game);
  const rawReset = game.reset.bind(game);
  game.resetStateOnly = rawReset;
  game.reset = options => resetRuntime(game, { preserveSession: options?.preserveSession !== false });
  renderRuntime(game);

  const runtime = Object.freeze({
    initialize: options => initializeRuntime(game, options),
    step: dt => stepRuntime(game, dt),
    frame: timestamp => runRuntimeFrame(game, timestamp),
    render: alpha => renderRuntime(game, alpha),
    reset: options => resetRuntime(game, options),
    start: () => startRuntimeLoop(game),
    stop: () => stopRuntimeLoop(game),
  });

  Object.assign(game, {
    runtime,
    controllers: Object.freeze({ input, ui, runtime }),
  });
  if (autoStart) runtime.start();
  return game;
}
