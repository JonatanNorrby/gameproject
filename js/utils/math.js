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

export function distance(ax, ay, bx, by) {
  return Math.sqrt(squaredDistance(ax, ay, bx, by));
}

export function normalizeAngle(angle) {
  let result = angle % TAU;
  if (result <= -Math.PI) result += TAU;
  if (result > Math.PI) result -= TAU;
  return result;
}
