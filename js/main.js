import { createGame } from './core/game.js';
import { initializeRuntime, resetRuntime, startRuntimeLoop, stopRuntimeLoop } from './core/runtime.js';
import { initInput } from './input/input.js';
import { renderFrame } from './rendering/renderer.js';
import { initUI, renderUI } from './ui/ui.js';
import { ensureRuntimeControls } from './ui/domSetup.js';

export function bootGame({ canvas = null, ctx = null, now = () => 0, services = {}, autoStart = false } = {}) {
  const doc = services?.ui?.document || (typeof document !== 'undefined' ? document : null);
  ensureRuntimeControls(doc);

  const productionServices = {
    ...services,
    ui: {
      ...(services.ui || {}),
      document: doc,
      restart: game => resetRuntime(game, { preserveSession: true }),
    },
  };
  const game = createGame({ canvas, ctx, now, services: productionServices });
  initializeRuntime(game, { forceWorld: true });

  const input = initInput(game);
  if (game.input) game.input.cancelGesture = input.cancelGesture;
  const ui = initUI(game);

  game.reset = options => resetRuntime(game, options);
  game.start = () => startRuntimeLoop(game);
  game.stop = () => stopRuntimeLoop(game);
  game.controllers = Object.freeze({ input, ui });

  renderFrame(game);
  renderUI(game);
  if (autoStart) startRuntimeLoop(game);
  return game;
}
