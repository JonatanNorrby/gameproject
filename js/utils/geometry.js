import { clamp, squaredDistance } from './math.js';

export function pointInRadius(px, py, cx, cy, radius) {
  return squaredDistance(px, py, cx, cy) <= radius * radius;
}

export const pointInCircle = pointInRadius;

export function circlesOverlap(ax, ay, ar, bx, by, br) {
  const radius = ar + br;
  return squaredDistance(ax, ay, bx, by) < radius * radius;
}

export function nearestPointOnSegment(px, py, ax, ay, bx, by) {
  const vx = bx - ax;
  const vy = by - ay;
  const wx = px - ax;
  const wy = py - ay;
  const vv = vx * vx + vy * vy;
  if (vv <= 0.0001) return { x: ax, y: ay, t: 0 };
  const t = clamp((wx * vx + wy * vy) / vv, 0, 1);
  return { x: ax + t * vx, y: ay + t * vy, t };
}

export function pointSegmentDistance(px, py, ax, ay, bx, by) {
  const q = nearestPointOnSegment(px, py, ax, ay, bx, by);
  return Math.hypot(px - q.x, py - q.y);
}

export function orient(ax, ay, bx, by, cx, cy) {
  return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
}

// Preserves the current legacy helper's strict crossing test; endpoint/collinear
// contact is handled by the distance fallback in segmentSegmentDistance().
export function segmentsCross(ax, ay, bx, by, cx, cy, dx, dy) {
  const o1 = orient(ax, ay, bx, by, cx, cy);
  const o2 = orient(ax, ay, bx, by, dx, dy);
  const o3 = orient(cx, cy, dx, dy, ax, ay);
  const o4 = orient(cx, cy, dx, dy, bx, by);
  return ((o1 > 0) !== (o2 > 0)) && ((o3 > 0) !== (o4 > 0));
}

export function segmentSegmentDistance(ax, ay, bx, by, cx, cy, dx, dy) {
  if (segmentsCross(ax, ay, bx, by, cx, cy, dx, dy)) return 0;
  return Math.min(
    pointSegmentDistance(ax, ay, cx, cy, dx, dy),
    pointSegmentDistance(bx, by, cx, cy, dx, dy),
    pointSegmentDistance(cx, cy, ax, ay, bx, by),
    pointSegmentDistance(dx, dy, ax, ay, bx, by),
  );
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
