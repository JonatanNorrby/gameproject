import { BUILDING_CONFIG } from '../buildings/buildingConfig.js';
import { getEntityRadius } from '../core/entities.js';
import { pointSegmentDistance } from '../utils/geometry.js';

export const RANGE_MODES = Object.freeze({
  CENTER: 'center',
  FOOTPRINT: 'footprint',
});

function isWall(entity) {
  return entity?.type === 'wall'
    && Number.isFinite(entity.x1) && Number.isFinite(entity.y1)
    && Number.isFinite(entity.x2) && Number.isFinite(entity.y2);
}

export function getCombatRadius(game, entity) {
  if (!entity) return 0;
  if (entity === game?.state?.base) return Math.max(0, Number(entity.radius) || 0);
  if (isWall(entity)) {
    const thickness = Number(entity.thickness)
      || Number(game?.config?.buildings?.wall?.wall?.thickness)
      || Number(BUILDING_CONFIG.wall.wall.thickness)
      || 12;
    return Math.max(0, thickness / 2);
  }
  try {
    const radius = Number(getEntityRadius(entity));
    if (Number.isFinite(radius)) return Math.max(0, radius);
  } catch {}
  for (const value of [entity.r, entity.radius, entity.collisionRadius]) {
    const radius = Number(value);
    if (Number.isFinite(radius)) return Math.max(0, radius);
  }
  return 0;
}

function centerOrSegmentDistance(attacker, target) {
  if (!attacker || !target || !Number.isFinite(attacker.x) || !Number.isFinite(attacker.y)) return Infinity;
  if (isWall(target)) {
    return pointSegmentDistance(attacker.x, attacker.y, target.x1, target.y1, target.x2, target.y2);
  }
  if (!Number.isFinite(target.x) || !Number.isFinite(target.y)) return Infinity;
  return Math.hypot(target.x - attacker.x, target.y - attacker.y);
}

export function attackDistance(game, attacker, target, { mode = RANGE_MODES.CENTER } = {}) {
  const distance = centerOrSegmentDistance(attacker, target);
  if (!Number.isFinite(distance) || mode === RANGE_MODES.CENTER) return distance;
  if (mode !== RANGE_MODES.FOOTPRINT) return Infinity;
  return Math.max(0, distance - getCombatRadius(game, attacker) - getCombatRadius(game, target));
}

export function isInAttackRange(game, attacker, target, range, options = {}) {
  const maximum = Number(range);
  if (!Number.isFinite(maximum) || maximum < 0) return false;
  const minimum = Number(options.minRange ?? 0);
  if (!Number.isFinite(minimum) || minimum < 0 || minimum > maximum) return false;

  const distance = attackDistance(game, attacker, target, { mode: options.mode || RANGE_MODES.CENTER });
  if (!Number.isFinite(distance)) return false;

  const aboveMinimum = options.minInclusive === false ? distance > minimum : distance >= minimum;
  const belowMaximum = options.inclusive === false ? distance < maximum : distance <= maximum;
  return aboveMinimum && belowMaximum;
}
