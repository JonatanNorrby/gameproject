import { MIGRATION_STATUS } from '../core/config.js';
import { getUnitDefinition, getUnitRadius, isFlyingUnit } from '../core/entities.js';
import { pointSegmentDistance } from '../utils/geometry.js';
import { findNearestOpenDestination, findPath } from '../navigation/pathfinding.js';

export const BASIC_MOVEMENT_SYSTEM_STATUS = MIGRATION_STATUS.MIGRATED;
export const WAYPOINT_ARRIVAL_DISTANCE = 5;

function movementRadius(unit) {
  try { return Math.max(4, Number(getUnitRadius(unit)) || 18); }
  catch { return 18; }
}

function riverDistanceToPoint(river, x, y) {
  let best = Infinity;
  for (let i = 1; i < (river?.points?.length || 0); i++) {
    const a = river.points[i - 1], b = river.points[i];
    best = Math.min(best, pointSegmentDistance(x, y, a.x, a.y, b.x, b.y));
  }
  return best;
}

export function pointInRiver(game, x, y) {
  for (const river of game?.state?.entities?.rivers || []) {
    if (riverDistanceToPoint(river, x, y) <= Number(river.width) / 2) return true;
  }
  return false;
}

// Intrinsic + terrain + global movement modifier. This deliberately ignores the
// per-frame Platoon/APC support cache so the unit runtime can rebuild that cache
// without recursively applying group/support modifiers or river slowdown twice.
export function getBaseUnitMoveSpeed(game, unit) {
  const definition = getUnitDefinition(unit);
  let speed = Number(definition?.moveSpeed) || 0;
  if (!isFlyingUnit(unit) && pointInRiver(game, unit.x, unit.y)) {
    const riverSlow = Number(game?.config?.rivers?.slowFactor);
    speed *= Number.isFinite(riverSlow) ? riverSlow : 1;
  }
  const moveModifier = Number(game?.state?.modifiers?.unitMove);
  return speed * (Number.isFinite(moveModifier) ? moveModifier : 1);
}

export function getIndividualUnitMoveSpeed(game, unit) {
  const speeds = game?.state?.unitRuntime?.speedById;
  if (speeds instanceof Map && speeds.has(unit?.id)) return speeds.get(unit.id);
  return getBaseUnitMoveSpeed(game, unit);
}

export function setUnitDestination(game, unit, x, y, options = {}) {
  if (!game || !unit || !Number.isFinite(x) || !Number.isFinite(y)) return false;
  if (!Number.isFinite(unit.x) || !Number.isFinite(unit.y)) return false;

  const radius = movementRadius(unit);
  const width = Number(game?.config?.world?.width) || 0;
  const height = Number(game?.config?.world?.height) || 0;

  // Current v25/v48 behavior: player aircraft ignore ground navigation and use
  // the same path follower with one direct waypoint.
  if (isFlyingUnit(unit)) {
    if (x < radius + 5 || y < radius + 5 || x > width - radius - 5 || y > height - radius - 5) return false;
    unit.path = [{ x, y }];
    unit.moveTarget = { x, y };
    return true;
  }

  // Current v51 behavior repairs a blocked click to the nearest open point before
  // delegating to the v48 destination/pathfinder implementation.
  const destination = findNearestOpenDestination(game, x, y, radius);
  if (!destination) return false;

  const oldPath = Array.isArray(unit.path) ? unit.path : [];
  const oldTarget = unit.moveTarget ?? null;
  const path = findPath(game, { x: unit.x, y: unit.y }, destination, radius);
  if (!path.length) {
    unit.path = oldPath;
    unit.moveTarget = oldTarget;
    return false;
  }

  unit.path = path;
  unit.moveTarget = { x: destination.x, y: destination.y };

  // Preserve the small compatibility side effect already owned by the current
  // destination primitive. Route creation/service/loop orchestration stays legacy.
  if (unit.type === 'truck' && !options.preserveRoute) {
    unit.routeActive = false;
    unit.routeLoop = false;
  }
  return true;
}

export function updateUnitMovement(game, unit, dt) {
  if (!game || !unit || !Number.isFinite(dt) || dt <= 0) return false;
  if (!Array.isArray(unit.path) || !unit.path.length) return false;

  const point = unit.path[0];
  const dx = point.x - unit.x, dy = point.y - unit.y;
  const distance = Math.hypot(dx, dy);

  // Preserve the legacy <5px snap/shift behavior exactly. If a movement step
  // lands exactly on a waypoint, the waypoint is consumed on the next update.
  if (distance < WAYPOINT_ARRIVAL_DISTANCE) {
    unit.x = point.x;
    unit.y = point.y;
    unit.path.shift();
    if (!unit.path.length) unit.moveTarget = null;
    return true;
  }

  const speed = getIndividualUnitMoveSpeed(game, unit);
  const step = Math.min(distance, speed * dt);
  unit.heading = Math.atan2(dy, dx);
  unit.x += dx / distance * step;
  unit.y += dy / distance * step;
  return true;
}
