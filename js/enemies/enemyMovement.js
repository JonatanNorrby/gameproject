import { getEnemyConfig } from './enemyConfig.js';
import { getEntityRadius } from '../core/entities.js';
import { isNavigationPointBlocked } from '../navigation/pathfinding.js';
import { isNavigationTerrainBlocked } from '../navigation/terrain.js';
import { nearestPointOnSegment, pointSegmentDistance, segmentSegmentDistance } from '../utils/geometry.js';

const NORMAL_STEER_OFFSETS = Object.freeze([0, 0.32, -0.32, 0.62, -0.62, 0.92, -0.92, 1.22, -1.22]);
const GUARD_STEER_OFFSETS = Object.freeze([0, 0.48, -0.48, 0.9, -0.9, 1.35, -1.35]);

export function enemyRadius(enemy) {
  if (Number.isFinite(Number(enemy?.r))) return Math.max(1, Number(enemy.r));
  try { return Math.max(1, Number(getEnemyConfig(enemy?.type).radius) || 8); }
  catch { return 8; }
}

export function wallThickness(game, wall) {
  return Number(wall?.thickness)
    || Number(game?.config?.buildings?.wall?.wall?.thickness)
    || 12;
}

export function enemyTargetRadius(game, target) {
  if (!target) return 0;
  if (target === game?.state?.base) return Number(target.radius) || 0;
  if (target.type === 'wall') return wallThickness(game, target) / 2;
  try { return Number(getEntityRadius(target)) || 0; }
  catch {
    return Number(target.r) || Number(target.radius) || Number(target.collisionRadius) || 0;
  }
}

export function findBlockingWall(game, enemy, tx, ty, lookAhead = Infinity) {
  const dx = tx - enemy.x;
  const dy = ty - enemy.y;
  const distance = Math.hypot(dx, dy) || 1;
  const rawLookAhead = Number(lookAhead);
  const length = Number.isFinite(rawLookAhead) ? Math.min(distance, Math.max(0, rawLookAhead)) : distance;
  const ex = enemy.x + dx / distance * length;
  const ey = enemy.y + dy / distance * length;
  let best = null;
  let bestDistance = Infinity;
  for (const wall of game?.state?.entities?.structures || []) {
    if (!wall || wall.type !== 'wall' || wall.built === false || Number(wall.hp) <= 0) continue;
    if (![wall.x1, wall.y1, wall.x2, wall.y2].every(Number.isFinite)) continue;
    if (segmentSegmentDistance(enemy.x, enemy.y, ex, ey, wall.x1, wall.y1, wall.x2, wall.y2)
      > enemyRadius(enemy) + wallThickness(game, wall) / 2 + 3) continue;
    const d = pointSegmentDistance(enemy.x, enemy.y, wall.x1, wall.y1, wall.x2, wall.y2);
    if (d < bestDistance) {
      best = wall;
      bestDistance = d;
    }
  }
  return best;
}

export function nearestPointOnWall(enemy, wall) {
  return nearestPointOnSegment(enemy.x, enemy.y, wall.x1, wall.y1, wall.x2, wall.y2);
}

function insideWorld(game, x, y, radius) {
  const width = Number(game?.config?.world?.width) || 0;
  const height = Number(game?.config?.world?.height) || 0;
  return x >= radius && y >= radius && x <= width - radius && y <= height - radius;
}

function wallAtPoint(game, x, y, radius) {
  let best = null;
  let bestDistance = Infinity;
  for (const wall of game?.state?.entities?.structures || []) {
    if (!wall || wall.type !== 'wall' || wall.built === false || Number(wall.hp) <= 0) continue;
    const distance = pointSegmentDistance(x, y, wall.x1, wall.y1, wall.x2, wall.y2);
    if (distance < radius + wallThickness(game, wall) / 2 && distance < bestDistance) {
      best = wall;
      bestDistance = distance;
    }
  }
  return best;
}

function normalEnemyStepOpen(game, enemy, x, y) {
  // Final v18/v24 normal enemy navigation is intentionally narrower than v48
  // player/guard navigation: every shaped terrain feature and built Wall blocks,
  // while ordinary buildings/depots/Base are handled as targets rather than path blockers.
  return !isNavigationTerrainBlocked(game, x, y, enemyRadius(enemy) + 1, { allTerrainKinds: true })
    && !wallAtPoint(game, x, y, enemyRadius(enemy) + 1);
}

export function navigateGroundEnemy(game, enemy, tx, ty, speed, dt) {
  const dx = tx - enemy.x;
  const dy = ty - enemy.y;
  const distance = Math.hypot(dx, dy) || 1;
  const baseAngle = Math.atan2(dy, dx);
  const step = Math.max(0, Number(speed) || 0) * Math.max(0, Number(dt) || 0);
  if (step <= 0) return null;

  const directX = enemy.x + dx / distance * step;
  const directY = enemy.y + dy / distance * step;
  const directWall = wallAtPoint(game, directX, directY, enemyRadius(enemy) + 2);
  const maxDetour = Number(game?.config?.pathfinding?.maxOpenDetourAngle) || 0.78;

  for (const offset of NORMAL_STEER_OFFSETS) {
    const angle = baseAngle + offset;
    const nx = enemy.x + Math.cos(angle) * step;
    const ny = enemy.y + Math.sin(angle) * step;
    if (!insideWorld(game, nx, ny, enemyRadius(enemy))) continue;
    if (!normalEnemyStepOpen(game, enemy, nx, ny)) continue;
    if (directWall && Math.abs(offset) > maxDetour) break;
    enemy.x = nx;
    enemy.y = ny;
    return null;
  }

  if (directWall) return directWall;

  // Final v18 fallback: if boxed by a non-wall feature, try the same steering
  // angles using terrain-only validation. Walls are intentionally ignored here.
  for (const offset of NORMAL_STEER_OFFSETS) {
    const angle = baseAngle + offset;
    const nx = enemy.x + Math.cos(angle) * step;
    const ny = enemy.y + Math.sin(angle) * step;
    if (!insideWorld(game, nx, ny, enemyRadius(enemy))) continue;
    if (isNavigationTerrainBlocked(game, nx, ny, enemyRadius(enemy) + 1, { allTerrainKinds: true })) continue;
    enemy.x = nx;
    enemy.y = ny;
    return null;
  }
  return null;
}

export function approachBlockingWall(game, enemy, wall, speed, dt, meleeRange) {
  const point = nearestPointOnWall(enemy, wall);
  const distance = Math.hypot(enemy.x - point.x, enemy.y - point.y);
  const step = Math.min(
    Math.max(0, Number(speed) || 0) * Math.max(0, Number(dt) || 0),
    Math.max(0, distance - meleeRange * 0.7),
  );
  if (step <= 0) return false;
  const dx = point.x - enemy.x;
  const dy = point.y - enemy.y;
  const length = Math.hypot(dx, dy) || 1;
  const nx = enemy.x + dx / length * step;
  const ny = enemy.y + dy / length * step;
  if (!insideWorld(game, nx, ny, enemyRadius(enemy))) return false;
  if (isNavigationTerrainBlocked(game, nx, ny, enemyRadius(enemy) + 1, { allTerrainKinds: true })) return false;
  enemy.x = nx;
  enemy.y = ny;
  return true;
}

export function stepDirectTerrainOnly(game, enemy, tx, ty, speed, dt) {
  const dx = tx - enemy.x;
  const dy = ty - enemy.y;
  const distance = Math.hypot(dx, dy);
  if (!Number.isFinite(distance) || distance < 1e-6) return false;
  const step = Math.min(distance, Math.max(0, Number(speed) || 0) * Math.max(0, Number(dt) || 0));
  if (step <= 0) return false;
  const radius = enemyRadius(enemy);
  const nx = enemy.x + dx / distance * step;
  const ny = enemy.y + dy / distance * step;
  if (!insideWorld(game, nx, ny, radius)) return false;
  // Final v24 direct special movement still respects every shaped terrain kind,
  // but deliberately ignores Walls/structures. This is not ground A*.
  if (isNavigationTerrainBlocked(game, nx, ny, radius + 1, { allTerrainKinds: true })) return false;
  enemy.x = nx;
  enemy.y = ny;
  return true;
}

export function stepCacheGuard(game, enemy, tx, ty, speed, dt) {
  const dx = tx - enemy.x;
  const dy = ty - enemy.y;
  const distance = Math.hypot(dx, dy) || 1;
  const step = Math.min(distance, Math.max(0, Number(speed) || 0) * Math.max(0, Number(dt) || 0));
  if (step <= 0) return false;
  const baseAngle = Math.atan2(dy, dx);
  const radius = enemyRadius(enemy);
  for (const offset of GUARD_STEER_OFFSETS) {
    const angle = baseAngle + offset;
    const nx = enemy.x + Math.cos(angle) * step;
    const ny = enemy.y + Math.sin(angle) * step;
    if (!insideWorld(game, nx, ny, radius)) continue;
    // Confirmed cache bug fix: guards use the complete v48 blocker, including
    // Base, buildings, depots, Walls and blocking terrain.
    if (isNavigationPointBlocked(game, nx, ny, radius)) continue;
    enemy.x = nx;
    enemy.y = ny;
    return true;
  }
  return false;
}

export function movementSpeedAt(game, enemy, baseSpeed) {
  let speed = Math.max(0, Number(baseSpeed) || 0);
  const custom = game?.services?.enemyAI?.movementMultiplierAt;
  if (typeof custom === 'function') {
    const multiplier = Number(custom(enemy, game));
    if (Number.isFinite(multiplier) && multiplier >= 0) return speed * multiplier;
  }
  const inRiver = game?.services?.enemyAI?.isInRiver;
  if (typeof inRiver === 'function' && inRiver(enemy, game)) {
    speed *= Number(game?.config?.rivers?.slowFactor) || 0.5;
  }
  return speed;
}
