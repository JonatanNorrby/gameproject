import { MIGRATION_STATUS } from '../core/config.js';
import { eventToWorld, panCameraByScreenDelta, setCameraZoom, updateCameraFromKeys, zoomCameraStep, getCameraZoom } from './camera.js';
import { appendWallPoint, clearSelection, handleWorldTap } from './interaction.js';

export const INPUT_SYSTEM_STATUS = MIGRATION_STATUS.MIGRATED;
const DRAG_THRESHOLD = 8;

function commandMenuOpen(game) { return Boolean(game?.state?.ui?.commandMenuOpen); }
function titleMenuOpen(game) { return Boolean(game?.state?.ui?.titleMenuOpen); }

function addListener(target, name, handler, options, disposers) {
  if (!target?.addEventListener) return;
  target.addEventListener(name, handler, options);
  disposers.push(() => target.removeEventListener(name, handler, options));
}

function localScreenPoint(game, event) {
  const canvas = game.canvas;
  const rect = canvas.getBoundingClientRect();
  const cssWidth = canvas.clientWidth || rect.width || game.viewport.width;
  const cssHeight = canvas.clientHeight || rect.height || game.viewport.height;
  return {
    x: event.clientX - rect.left - (canvas.clientLeft || 0),
    y: event.clientY - rect.top - (canvas.clientTop || 0),
    cssWidth,
    cssHeight,
  };
}

export function initInput(game) {
  if (!game) throw new TypeError('initInput requires a game context');
  const canvas = game.canvas;
  const disposers = [];
  const keys = Object.create(null);
  const pointers = new Map();
  let primaryId = null;
  let primary = null;
  let pinch = null;

  game.input = { keys, pointers };
  if (!canvas?.addEventListener) return Object.freeze({ dispose() {}, cancelGesture() {}, keys });

  function cancelGesture() {
    primaryId = null;
    primary = null;
    pinch = null;
    pointers.clear();
    game.state.commands.wall.painting = false;
  }

  function beginPinch() {
    const touch = [...pointers.values()].filter(pointer => pointer.pointerType === 'touch');
    if (touch.length < 2) { pinch = null; return; }
    const [a, b] = touch;
    pinch = {
      ids: [a.id, b.id],
      distance: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)),
      zoom: getCameraZoom(game),
    };
    if (primary) primary.dragged = true;
  }

  function updatePointerRecord(event) {
    const point = localScreenPoint(game, event);
    const record = pointers.get(event.pointerId) || { id: event.pointerId, pointerType: event.pointerType || 'mouse' };
    record.x = point.x; record.y = point.y; record.cssWidth = point.cssWidth; record.cssHeight = point.cssHeight;
    pointers.set(event.pointerId, record);
    return record;
  }

  const pointerDown = event => {
    if (commandMenuOpen(game) || titleMenuOpen(game)) return;
    const record = updatePointerRecord(event);
    try { canvas.setPointerCapture?.(event.pointerId); } catch {}
    if (record.pointerType === 'touch' && [...pointers.values()].filter(pointer => pointer.pointerType === 'touch').length >= 2) {
      beginPinch();
      event.preventDefault?.();
      return;
    }
    if (primaryId !== null) return;
    primaryId = event.pointerId;
    primary = { ...record, startX: record.x, startY: record.y, lastX: record.x, lastY: record.y, dragged: false };
    if (game.state.commands.buildType === 'wall') {
      const world = eventToWorld(game, event);
      if (world) appendWallPoint(game, world, { force: true });
      game.state.commands.wall.painting = true;
      primary.dragged = true;
      event.preventDefault?.();
    }
  };

  const pointerMove = event => {
    if (!pointers.has(event.pointerId)) return;
    const record = updatePointerRecord(event);
    if (pinch) {
      const a = pointers.get(pinch.ids[0]), b = pointers.get(pinch.ids[1]);
      if (a && b) {
        const distance = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
        const rect = canvas.getBoundingClientRect();
        const cssWidth = canvas.clientWidth || rect.width || game.viewport.width;
        const cssHeight = canvas.clientHeight || rect.height || game.viewport.height;
        const midX = (a.x + b.x) / 2 * game.viewport.width / Math.max(1, cssWidth);
        const midY = (a.y + b.y) / 2 * game.viewport.height / Math.max(1, cssHeight);
        setCameraZoom(game, pinch.zoom * distance / pinch.distance, midX, midY);
      }
      event.preventDefault?.();
      return;
    }
    if (event.pointerId !== primaryId || !primary) return;
    const total = Math.hypot(record.x - primary.startX, record.y - primary.startY);
    if (total > DRAG_THRESHOLD) primary.dragged = true;
    if (game.state.commands.buildType === 'wall' && game.state.commands.wall.painting) {
      const world = eventToWorld(game, event);
      if (world) appendWallPoint(game, world);
      event.preventDefault?.();
    } else if (primary.pointerType === 'touch' && primary.dragged) {
      panCameraByScreenDelta(game, record.x - primary.lastX, record.y - primary.lastY, { cssWidth: record.cssWidth, cssHeight: record.cssHeight });
      event.preventDefault?.();
    }
    primary.lastX = record.x; primary.lastY = record.y;
  };

  function endPointer(event, cancelled = false) {
    const wasPrimary = event.pointerId === primaryId;
    const oldPrimary = primary;
    if (pointers.has(event.pointerId)) updatePointerRecord(event);
    if (wasPrimary && oldPrimary && !cancelled) {
      if (game.state.commands.buildType === 'wall' && game.state.commands.wall.painting) {
        const world = eventToWorld(game, event);
        if (world) appendWallPoint(game, world, { force: true });
        game.state.commands.wall.painting = false;
      } else if (!oldPrimary.dragged && !pinch) {
        const world = eventToWorld(game, event);
        if (world) handleWorldTap(game, world.x, world.y);
      }
    }
    pointers.delete(event.pointerId);
    if (wasPrimary) { primaryId = null; primary = null; }
    if (pinch && pinch.ids.includes(event.pointerId)) pinch = null;
    if (!pinch && primaryId === null) {
      const next = [...pointers.values()].find(pointer => pointer.pointerType === 'touch');
      if (next) {
        primaryId = next.id;
        primary = { ...next, startX: next.x, startY: next.y, lastX: next.x, lastY: next.y, dragged: true };
      }
    }
  }

  const pointerUp = event => endPointer(event, false);
  const pointerCancel = event => endPointer(event, true);
  const wheel = event => {
    if (commandMenuOpen(game) || titleMenuOpen(game)) return;
    event.preventDefault?.();
    event.stopImmediatePropagation?.();
    const point = localScreenPoint(game, event);
    const sx = point.x * game.viewport.width / Math.max(1, point.cssWidth);
    const sy = point.y * game.viewport.height / Math.max(1, point.cssHeight);
    zoomCameraStep(game, event.deltaY < 0 ? 1 : -1, sx, sy);
  };
  const context = event => event.preventDefault?.();
  const keyDown = event => {
    keys[event.key] = true;
    if (event.key !== 'Escape') return;
    if (titleMenuOpen(game)) {
      if (game.state.ui.titlePanel) game.state.ui.titlePanel = null;
      return;
    }
    if (game.state.selection.unitId) {
      event.preventDefault?.(); event.stopImmediatePropagation?.();
      clearSelection(game, { message: 'Unit deselected.' });
      return;
    }
    event.preventDefault?.(); event.stopImmediatePropagation?.();
    game.state.ui.commandMenuOpen = !game.state.ui.commandMenuOpen;
    cancelGesture();
  };
  const keyUp = event => { keys[event.key] = false; };
  const resize = () => cancelGesture();

  addListener(canvas, 'pointerdown', pointerDown, { passive: false }, disposers);
  addListener(canvas, 'pointermove', pointerMove, { passive: false }, disposers);
  addListener(canvas, 'pointerup', pointerUp, { passive: false }, disposers);
  addListener(canvas, 'pointercancel', pointerCancel, { passive: false }, disposers);
  addListener(canvas, 'wheel', wheel, { capture: true, passive: false }, disposers);
  addListener(canvas, 'contextmenu', context, false, disposers);
  const root = typeof window !== 'undefined' ? window : null;
  addListener(root, 'keydown', keyDown, true, disposers);
  addListener(root, 'keyup', keyUp, true, disposers);
  addListener(root, 'resize', resize, { passive: true }, disposers);
  addListener(root, 'orientationchange', resize, { passive: true }, disposers);

  return Object.freeze({
    keys,
    cancelGesture,
    dispose() {
      for (const dispose of disposers.splice(0)) dispose();
      cancelGesture();
    },
  });
}

export function applyInputCommands(game, dt) {
  if (!game) return false;
  return updateCameraFromKeys(game, dt, game.input?.keys || {});
}
