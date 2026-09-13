import { MIGRATION_STATUS } from '../core/config.js';

export const CAMERA_SYSTEM_STATUS = MIGRATION_STATUS.MIGRATED;

function camera(game) {
  const value = game?.state?.view?.camera;
  if (!value) throw new TypeError('Camera state is required');
  return value;
}

export function getCameraZoom(game) {
  const raw = Number(camera(game).zoom);
  const value = Number.isFinite(raw) && raw > 0 ? raw : 1;
  return Math.max(game.config.camera.minZoom, Math.min(game.config.camera.maxZoom, value));
}

export function clampCamera(game) {
  const cam = camera(game);
  const zoom = getCameraZoom(game);
  const width = Number(game?.viewport?.width) || Number(game.config.viewport.width);
  const height = Number(game?.viewport?.height) || Number(game.config.viewport.height);
  const visibleWidth = width / zoom;
  const visibleHeight = height / zoom;
  cam.x = Math.max(0, Math.min(Math.max(0, game.config.world.width - visibleWidth), Number(cam.x) || 0));
  cam.y = Math.max(0, Math.min(Math.max(0, game.config.world.height - visibleHeight), Number(cam.y) || 0));
  cam.zoom = zoom;
  return cam;
}

export function setCameraZoom(game, nextZoom, screenX = null, screenY = null) {
  const cam = camera(game);
  const oldZoom = getCameraZoom(game);
  const width = Number(game?.viewport?.width) || game.config.viewport.width;
  const height = Number(game?.viewport?.height) || game.config.viewport.height;
  const sx = Math.max(0, Math.min(width, Number.isFinite(Number(screenX)) ? Number(screenX) : width / 2));
  const sy = Math.max(0, Math.min(height, Number.isFinite(Number(screenY)) ? Number(screenY) : height / 2));
  let zoom = Number(nextZoom);
  if (!Number.isFinite(zoom)) zoom = oldZoom;
  zoom = Math.max(game.config.camera.minZoom, Math.min(game.config.camera.maxZoom, zoom));
  const worldX = cam.x + sx / oldZoom;
  const worldY = cam.y + sy / oldZoom;
  cam.zoom = zoom;
  cam.x = worldX - sx / zoom;
  cam.y = worldY - sy / zoom;
  clampCamera(game);
  return zoom;
}

export function zoomCameraStep(game, direction, screenX = null, screenY = null) {
  const dir = Math.sign(Number(direction) || 0);
  if (!dir) return getCameraZoom(game);
  return setCameraZoom(game, getCameraZoom(game) + dir * game.config.camera.zoomStep, screenX, screenY);
}

export function centerCameraOnBase(game) {
  const cam = camera(game);
  const zoom = getCameraZoom(game);
  const width = Number(game?.viewport?.width) || game.config.viewport.width;
  const height = Number(game?.viewport?.height) || game.config.viewport.height;
  cam.x = game.state.base.x - width / (2 * zoom);
  cam.y = game.state.base.y - height / (2 * zoom);
  return clampCamera(game);
}

export function panCameraByScreenDelta(game, dx, dy, { cssWidth = null, cssHeight = null } = {}) {
  const cam = camera(game);
  const viewportWidth = Number(game?.viewport?.width) || game.config.viewport.width;
  const viewportHeight = Number(game?.viewport?.height) || game.config.viewport.height;
  const scaleX = viewportWidth / Math.max(1, Number(cssWidth) || viewportWidth);
  const scaleY = viewportHeight / Math.max(1, Number(cssHeight) || viewportHeight);
  const zoom = getCameraZoom(game);
  cam.x -= Number(dx || 0) * scaleX / zoom;
  cam.y -= Number(dy || 0) * scaleY / zoom;
  return clampCamera(game);
}

export function updateCameraFromKeys(game, dt, keys = {}) {
  const cam = camera(game);
  const right = keys.ArrowRight ? 1 : 0;
  const left = keys.ArrowLeft ? 1 : 0;
  const down = keys.ArrowDown ? 1 : 0;
  const up = keys.ArrowUp ? 1 : 0;
  let dx = right - left, dy = down - up;
  if (!dx && !dy) return false;
  const length = Math.hypot(dx, dy) || 1;
  dx /= length; dy /= length;
  cam.x += dx * Number(cam.speed || game.config.camera.speed) * Math.max(0, Number(dt) || 0);
  cam.y += dy * Number(cam.speed || game.config.camera.speed) * Math.max(0, Number(dt) || 0);
  clampCamera(game);
  return true;
}

export function screenToWorld(game, screenX, screenY) {
  const cam = camera(game);
  const zoom = getCameraZoom(game);
  return { x: cam.x + Number(screenX) / zoom, y: cam.y + Number(screenY) / zoom, sx: Number(screenX), sy: Number(screenY) };
}

export function eventToWorld(game, event) {
  const canvas = game?.canvas;
  if (!canvas || !event) return null;
  const rect = canvas.getBoundingClientRect();
  const cssWidth = canvas.clientWidth || rect.width || game.viewport.width;
  const cssHeight = canvas.clientHeight || rect.height || game.viewport.height;
  const localX = Number(event.clientX) - rect.left - (canvas.clientLeft || 0);
  const localY = Number(event.clientY) - rect.top - (canvas.clientTop || 0);
  const sx = localX * (game.viewport.width / Math.max(1, cssWidth));
  const sy = localY * (game.viewport.height / Math.max(1, cssHeight));
  return screenToWorld(game, sx, sy);
}
