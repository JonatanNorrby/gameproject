function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function cameraWorldRect(game, margin = 0) {
  const camera = game?.state?.view?.camera || {};
  const viewport = game?.viewport || { width: game?.canvas?.width || 0, height: game?.canvas?.height || 0 };
  const zoom = Math.max(0.0001, finite(camera.zoom, 1));
  const pad = Math.max(0, finite(margin)) / zoom;
  return {
    x0: finite(camera.x) - pad,
    y0: finite(camera.y) - pad,
    x1: finite(camera.x) + finite(viewport.width) / zoom + pad,
    y1: finite(camera.y) + finite(viewport.height) / zoom + pad,
    zoom,
  };
}

export function pointNearView(game, x, y, margin = 120) {
  const rect = cameraWorldRect(game, margin);
  return x >= rect.x0 && x <= rect.x1 && y >= rect.y0 && y <= rect.y1;
}

export function circleNearView(game, x, y, radius = 0, margin = 120) {
  const rect = cameraWorldRect(game, margin);
  const r = Math.max(0, finite(radius));
  return x + r >= rect.x0 && x - r <= rect.x1 && y + r >= rect.y0 && y - r <= rect.y1;
}

export function segmentNearView(game, ax, ay, bx, by, margin = 720) {
  const rect = cameraWorldRect(game, margin);
  return Math.max(ax, bx) >= rect.x0
    && Math.min(ax, bx) <= rect.x1
    && Math.max(ay, by) >= rect.y0
    && Math.min(ay, by) <= rect.y1;
}

export function worldToScreen(game, x, y) {
  const camera = game?.state?.view?.camera || {};
  const zoom = Math.max(0.0001, finite(camera.zoom, 1));
  return { x: (x - finite(camera.x)) * zoom, y: (y - finite(camera.y)) * zoom };
}

export function isScreenPointVisible(game, x, y, margin = 0) {
  const viewport = game?.viewport || { width: game?.canvas?.width || 0, height: game?.canvas?.height || 0 };
  return x >= -margin && y >= -margin && x <= finite(viewport.width) + margin && y <= finite(viewport.height) + margin;
}
