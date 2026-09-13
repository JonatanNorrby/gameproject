import { getUnitRole } from '../core/entities.js';
import { getUnitConfig, hasUnitTrait } from './unitConfig.js';
import { removeUnitFromPlatoon } from './platoons.js';
import { findNearestOpenDestination } from '../navigation/pathfinding.js';

export function getApcPassenger(game, apc) {
  if (!apc || getUnitRole(apc) !== 'apc' || !apc.passengerId) return null;
  return (game?.state?.entities?.units || []).find(unit => unit.id === apc.passengerId) || null;
}

export function canBoardApc(unit) {
  const role = getUnitRole(unit);
  return Boolean(unit && role && Number(unit.hp) > 0 && hasUnitTrait(role, 'boardable')
    && !unit.transportedIn && !unit.garrisonedIn);
}

export function findNearestBoardableUnit(game, apc) {
  if (!apc || getUnitRole(apc) !== 'apc' || getApcPassenger(game, apc)) return null;
  const range = getUnitConfig('apc').transport.loadRange;
  let best = null, bestDistance = range;
  for (const unit of game?.state?.entities?.units || []) {
    if (unit === apc || !canBoardApc(unit)) continue;
    const distance = Math.hypot(unit.x - apc.x, unit.y - apc.y);
    if (distance < bestDistance) { best = unit; bestDistance = distance; }
  }
  return best;
}

export function loadApc(game, apc, unit = null) {
  if (!apc || getUnitRole(apc) !== 'apc') return { ok: false, reason: 'not-apc' };
  if (getApcPassenger(game, apc)) return { ok: false, reason: 'already-loaded' };
  const passenger = unit || findNearestBoardableUnit(game, apc);
  if (!passenger || !canBoardApc(passenger)) return { ok: false, reason: 'no-boardable-unit' };
  const range = getUnitConfig('apc').transport.loadRange;
  if (Math.hypot(passenger.x - apc.x, passenger.y - apc.y) >= range) return { ok: false, reason: 'out-of-range' };
  removeUnitFromPlatoon(game, passenger);
  passenger.transportedIn = apc.id;
  passenger.attachedTo = null;
  passenger.attachSlot = 0;
  passenger.path = [];
  passenger.moveTarget = null;
  passenger.x = apc.x;
  passenger.y = apc.y;
  apc.passengerId = passenger.id;
  return { ok: true, passenger };
}

export function unloadApc(game, apc) {
  if (!apc || getUnitRole(apc) !== 'apc') return { ok: false, reason: 'not-apc' };
  const passenger = getApcPassenger(game, apc);
  if (!passenger) { apc.passengerId = null; return { ok: false, reason: 'empty' }; }
  const distance = getUnitConfig('apc').transport.unloadDistance;
  let point = null;
  for (let i = 0; i < 12 && !point; i++) {
    const angle = (Number(apc.heading) || 0) + i / 12 * Math.PI * 2;
    point = findNearestOpenDestination(game, apc.x + Math.cos(angle) * distance, apc.y + Math.sin(angle) * distance, passenger);
  }
  passenger.transportedIn = null;
  passenger.x = point?.x ?? apc.x + distance;
  passenger.y = point?.y ?? apc.y;
  passenger.path = [];
  passenger.moveTarget = null;
  apc.passengerId = null;
  return { ok: true, passenger };
}
