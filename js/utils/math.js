export const TAU = Math.PI * 2;

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function squaredDistance(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export const distanceSquared = squaredDistance;

export function distance(ax, ay, bx, by) {
  return Math.sqrt(squaredDistance(ax, ay, bx, by));
}

export function angleBetween(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

export function normalizeAngle(angle) {
  let result = angle % TAU;
  if (result <= -Math.PI) result += TAU;
  if (result > Math.PI) result -= TAU;
  return result;
}

export function nearlyEqual(a, b, epsilon = 1e-9) {
  return Math.abs(a - b) <= epsilon;
}
