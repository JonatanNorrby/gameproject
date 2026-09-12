import { pointSegmentDistance } from '../utils/geometry.js';

function pointInPolygon(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i], b = points[j];
    const hit = ((a.y > y) !== (b.y > y))
      && (x < (b.x - a.x) * (y - a.y) / (b.y - a.y || 1e-9) + a.x);
    if (hit) inside = !inside;
  }
  return inside;
}

function polygonDistance(x, y, points) {
  if (pointInPolygon(x, y, points)) return 0;
  let best = Infinity;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    best = Math.min(best, pointSegmentDistance(x, y, a.x, a.y, b.x, b.y));
  }
  return best;
}

// Narrow navigation-owned predicate for systems that intentionally need terrain
// without the full Base/depot/building/Wall blocker. By default it matches v48
// player navigation (lakes plus old untyped obstacles). `allTerrainKinds` is used
// only where current enemy/cache behavior still calls legacy pointBlockedByTerrain.
export function isNavigationTerrainBlocked(game, x, y, radius, { allTerrainKinds = false } = {}) {
  const r = Math.max(0, Number(radius) || 0);
  for (const terrain of game?.state?.entities?.terrain || []) {
    if (!allTerrainKinds && terrain?.kind && terrain.kind !== 'lake') continue;
    if (Array.isArray(terrain?.points)) {
      if (polygonDistance(x, y, terrain.points) <= r + 2) return true;
    } else if (Number.isFinite(terrain?.x) && Number.isFinite(terrain?.r)) {
      if (Math.hypot(x - terrain.x, y - terrain.y) < terrain.r + r + 2) return true;
    }
  }
  return false;
}
