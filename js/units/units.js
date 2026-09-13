import { MIGRATION_STATUS } from '../core/config.js';
import { getUnitRadius, getUnitRole } from '../core/entities.js';
import { getBaseUnitMoveSpeed, updateUnitMovement } from '../movement/movement.js';
import { issueMove, MOVE_COMMAND_SOURCES } from './commands.js';
import { getPlatoonMembers } from './platoons.js';
import { getUnitConfig } from './unitConfig.js';

export { UNIT_ALIASES, UNIT_CONFIG, UNIT_TYPES, getUnitConfig, hasUnitTrait, normalizeUnitType } from './unitConfig.js';
export { issueManualMove, issueMove, isManuallyMovableUnit, MOVE_COMMAND_SOURCES } from './commands.js';
export {
  canUsePlatoonMember,
  createOrMergePlatoon,
  disbandPlatoon,
  formationOffset,
  getPlatoonForUnit,
  getPlatoonMembers,
  issuePlatoonMove,
  removeUnitFromPlatoon,
} from './platoons.js';
export {
  attachApcSupport,
  attachMedicFollow,
  detachApcSupport,
  detachManualMoveSupport,
  detachMedicFollow,
} from './support.js';
export { findBoardablePassenger, loadApc, unloadApc } from './transport.js';

export const UNIT_SYSTEM_STATUS = MIGRATION_STATUS.MIGRATED;

const TRUCK_ESCORT_OFFSETS = Object.freeze([
  Object.freeze([-32, 28]), Object.freeze([32, 28]), Object.freeze([-48, 0]),
  Object.freeze([48, 0]), Object.freeze([-32, -30]), Object.freeze([32, -30]),
]);

function units(game) { return game?.state?.entities?.units || []; }
function active(unit) { return Boolean(unit && Number(unit.hp) > 0 && !unit.transportedIn && !unit.garrisonedIn); }

function getSupportTargets(game, apc) {
  if (!active(apc) || getUnitRole(apc) !== 'apc') return [];
  if (apc.v47SupportPlatoonId) {
    const members = getPlatoonMembers(game, apc.v47SupportPlatoonId, { activeOnly: true }).filter(unit => unit !== apc);
    if (members.length) return members;
    apc.v47SupportPlatoonId = null;
  }
  if (apc.v47SupportUnitId) {
    const unit = units(game).find(candidate => candidate.id === apc.v47SupportUnitId);
    if (active(unit) && unit !== apc) return [unit];
    apc.v47SupportUnitId = null;
  }
  return [];
}

function supportCenter(targets) {
  if (!targets.length) return null;
  let x = 0, y = 0;
  for (const unit of targets) { x += unit.x; y += unit.y; }
  return { x: x / targets.length, y: y / targets.length, targets };
}

function followPoint(game, follower, target, distance) {
  let heading = Number(target.heading);
  if (!Number.isFinite(heading)) heading = Math.atan2(target.y - follower.y, target.x - follower.x);
  let radius = 18;
  try { radius = Number(getUnitRadius(follower)) || radius; } catch {}
  return {
    x: Math.max(radius + 6, Math.min(game.config.world.width - radius - 6, target.x - Math.cos(heading) * distance)),
    y: Math.max(radius + 6, Math.min(game.config.world.height - radius - 6, target.y - Math.sin(heading) * distance)),
  };
}

function buildSpeedCache(game) {
  const speedById = new Map();
  const platoonMinimums = new Map();
  for (const unit of units(game)) {
    if (!active(unit)) continue;
    const speed = getBaseUnitMoveSpeed(game, unit);
    speedById.set(unit.id, speed);
    if (!unit.platoonId) continue;
    const previous = platoonMinimums.get(unit.platoonId);
    if (previous === undefined || speed < previous) platoonMinimums.set(unit.platoonId, speed);
  }
  for (const unit of units(game)) {
    if (active(unit) && unit.platoonId && platoonMinimums.has(unit.platoonId)) {
      speedById.set(unit.id, platoonMinimums.get(unit.platoonId));
    }
  }

  const apcDefinition = getUnitConfig('apc');
  const support = apcDefinition.supportFollow;
  const speedCap = apcDefinition.moveSpeed * support.boostSpeedCapFraction;
  for (const apc of units(game)) {
    if (!active(apc) || getUnitRole(apc) !== 'apc' || apc.passengerId) continue;
    const targets = getSupportTargets(game, apc);
    const center = supportCenter(targets);
    if (!center || Math.hypot(apc.x - center.x, apc.y - center.y) > support.boostRadius) continue;
    for (const target of targets) {
      if (target === apc) continue;
      const base = speedById.get(target.id) ?? getBaseUnitMoveSpeed(game, target);
      speedById.set(target.id, Math.min(speedCap, base * support.boostMultiplier));
    }
  }

  game.state.unitRuntime = { ...(game.state.unitRuntime || {}), speedById };
  return speedById;
}

function updateTruckEscort(game, unit) {
  if (!unit?.attachedTo) return false;
  const truck = units(game).find(candidate => candidate.id === unit.attachedTo && candidate.type === 'truck' && Number(candidate.hp) > 0);
  if (!truck) {
    unit.attachedTo = null;
    unit.attachSlot = 0;
    return true;
  }
  const offset = TRUCK_ESCORT_OFFSETS[(Number(unit.attachSlot) || 0) % TRUCK_ESCORT_OFFSETS.length];
  const heading = Number(truck.heading) || 0;
  const c = Math.cos(heading), s = Math.sin(heading);
  unit.x = truck.x + offset[0] * c - offset[1] * s;
  unit.y = truck.y + offset[0] * s + offset[1] * c;
  unit.path = [];
  unit.moveTarget = null;
  return true;
}

function syncTransportedPassengers(game) {
  let synced = 0;
  for (const unit of units(game)) {
    if (!unit.transportedIn) continue;
    const apc = units(game).find(candidate => candidate.id === unit.transportedIn && getUnitRole(candidate) === 'apc' && Number(candidate.hp) > 0);
    if (!apc) {
      unit.transportedIn = null;
      continue;
    }
    unit.x = apc.x;
    unit.y = apc.y;
    unit.path = [];
    unit.moveTarget = null;
    synced++;
  }
  for (const apc of units(game)) {
    if (getUnitRole(apc) !== 'apc' || !apc.passengerId) continue;
    if (!units(game).some(unit => unit.id === apc.passengerId && unit.transportedIn === apc.id)) apc.passengerId = null;
  }
  return synced;
}

function updateMedicFollow(game, medic, dt) {
  if (!active(medic) || getUnitRole(medic) !== 'medic' || !medic.v47FollowId) return false;
  const target = units(game).find(unit => unit.id === medic.v47FollowId);
  if (!active(target) || target === medic || getUnitRole(target) === 'medic') {
    medic.v47FollowId = null;
    medic.v47FollowTimer = 0;
    return false;
  }
  const config = getUnitConfig('medic').supportFollow;
  medic.v47FollowTimer = Math.max(0, (Number(medic.v47FollowTimer) || 0) - dt);
  const point = followPoint(game, medic, target, config.distance);
  const distance = Math.hypot(medic.x - point.x, medic.y - point.y);
  if (distance > config.repathDistance && medic.v47FollowTimer <= 0) {
    issueMove(game, medic, point.x, point.y, { source: MOVE_COMMAND_SOURCES.SUPPORT_AI });
    medic.v47FollowTimer = config.repathInterval;
    return true;
  }
  if (distance < config.settleDistance && !(target.path?.length)) {
    medic.path = [];
    medic.moveTarget = null;
  }
  return false;
}

function updateApcSupportFollow(game, apc, dt) {
  if (!active(apc) || getUnitRole(apc) !== 'apc' || apc.passengerId) return false;
  const targets = getSupportTargets(game, apc);
  const center = supportCenter(targets);
  if (!center) return false;
  const config = getUnitConfig('apc').supportFollow;
  apc.v47SupportTimer = Math.max(0, (Number(apc.v47SupportTimer) || 0) - dt);
  const point = followPoint(game, apc, { x: center.x, y: center.y, heading: targets[0]?.heading }, config.distance);
  const distance = Math.hypot(apc.x - point.x, apc.y - point.y);
  if (distance > config.repathDistance && apc.v47SupportTimer <= 0) {
    issueMove(game, apc, point.x, point.y, { source: MOVE_COMMAND_SOURCES.SUPPORT_AI });
    apc.v47SupportTimer = config.repathInterval;
    return true;
  }
  if (distance < config.settleDistance && targets.every(unit => !(unit.path?.length))) {
    apc.path = [];
    apc.moveTarget = null;
  }
  return false;
}

// Authoritative clean unit-motion/support owner. Combat remains in the combat
// system; Truck route servicing remains in economy. This pass only advances
// movement state and current final support/transport relationships.
export function updateUnits(game, dt) {
  const step = Math.max(0, Number(dt) || 0);
  if (!game?.state?.entities || step <= 0) return { moved: 0, escorts: 0, transported: 0, supportOrders: 0 };

  buildSpeedCache(game);
  let moved = 0, escorts = 0;
  for (const unit of units(game)) {
    if (!unit || Number(unit.hp) <= 0 || unit.transportedIn || unit.garrisonedIn) continue;
    if (unit.attachedTo) {
      if (updateTruckEscort(game, unit)) escorts++;
      continue;
    }
    if (updateUnitMovement(game, unit, step)) moved++;
  }

  const transported = syncTransportedPassengers(game);
  let supportOrders = 0;
  for (const unit of units(game)) {
    const role = getUnitRole(unit);
    if (role === 'medic' && updateMedicFollow(game, unit, step)) supportOrders++;
    else if (role === 'apc' && updateApcSupportFollow(game, unit, step)) supportOrders++;
  }

  return { moved, escorts, transported, supportOrders };
}
