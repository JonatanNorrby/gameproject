import { bootGame } from './main.js';
import { createProductionRenderingServices } from './rendering/presentation.js';

export const PRODUCTION_ENTRY = 'js/production.js';

function browserServices(doc) {
  const hasRaf = typeof requestAnimationFrame === 'function';
  return {
    random: Math.random,
    ui: { document: doc },
    rendering: createProductionRenderingServices(),
    runtime: {
      requestFrame: hasRaf ? callback => requestAnimationFrame(callback) : undefined,
      cancelFrame: typeof cancelAnimationFrame === 'function' ? handle => cancelAnimationFrame(handle) : undefined,
    },
  };
}

export function bootProductionGame({ doc = typeof document !== 'undefined' ? document : null, autoStart = true } = {}) {
  if (!doc?.getElementById) return null;
  const canvas = doc.getElementById('game');
  if (!canvas?.getContext) throw new Error('Production canvas #game is missing');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Unable to create 2D rendering context');

  doc.title = 'Alien Planet Defense';
  const clock = () => (typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now());
  const game = bootGame({
    canvas,
    ctx,
    now: clock,
    services: browserServices(doc),
    autoStart,
  });

  game.assets.loadAll().catch(error => console.warn('Asset preload failed; procedural fallbacks remain active.', error));
  globalThis.__apdGame = game;
  globalThis.__apdAudit = Object.freeze({
    version: 'clean-runtime',
    productionEntry: PRODUCTION_ENTRY,
    legacyScriptCount: 0,
    migrationBridgeCount: 0,
    runtimeOwner: 'js/core/runtime.js',
    inputOwner: 'js/input/input.js',
    uiOwner: 'js/ui/ui.js',
    renderingOwner: 'js/rendering/renderer.js',
    presentationOwner: 'js/rendering/presentation.js',
    fogOwner: 'js/fog/fog.js',
    cameraOwner: 'js/input/camera.js',
    configOwner: 'js/core/config.js',
  });
  return game;
}

if (typeof document !== 'undefined') {
  try {
    bootProductionGame();
  } catch (error) {
    console.error('Alien Planet Defense failed to boot the clean runtime.', error);
    const message = document.getElementById?.('message');
    if (message) message.textContent = 'Game failed to start. Check the browser console for details.';
  }
}
