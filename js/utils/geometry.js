import { clamp, squaredDistance } from './math.js';

export function pointInRadius(px, py, cx, cy, radius) {
  return squaredDistance(px, py, cx, cy) <= radius * radius;
}

export function circlesOverlap(ax, ay, ar, bx, by, br) {
  const radius = ar + br;
  return squaredDistance(ax, ay, bx, by) < radius * radius;
}

export function pointSegmentDistance(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(px - ax, py - ay);
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / lengthSquared, 0, 1);
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

export function isPointInsideWorld(x, y, radius, worldWidth, worldHeight, padding = 6) {
  return x >= radius + padding
    && y >= radius + padding
    && x <= worldWidth - radius - padding
    && y <= worldHeight - radius - padding;
}

export function clampPointToWorld(x, y, radius, worldWidth, worldHeight, padding = 6) {
  return {
    x: clamp(x, radius + padding, worldWidth - radius - padding),
    y: clamp(y, radius + padding, worldHeight - radius - padding),
  };
}
