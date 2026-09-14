import { getUnitRadius, getUnitRole, isInfantryUnit } from '../core/entities.js';
import { getUnitConfig } from '../units/unitConfig.js';
import { getPlatoonMembers } from '../units/platoons.js';
import { getIntrinsicUnitMoveSpeed, setUnitDestination, updateUnitMovement } from './movement.js';

// Final legacy v47 movement semantics that sit above the path follower. Keeping
// these in one clean runtime removes the old v25/v28/v29/v32/v47 wrapper chain.
const ATTACH_OFFSETS = Object.freeze([
  Object.freeze([-32, 28]), Object.freeze([32, 28]),
  Object.freeze([-48, 0]), Object.freeze([48, 0]),
  Object.freeze([-32, -30]), Object.freeze([32, -30]),
]);

const MEDIC_FOLLOW = Object.freeze({
  followDistance: 58,
  orderDistance: 78,
  stopDistance: 34,
  repathSeconds: 0.42,
});

const APC_SUPPORT = Object.freeze({
  activeRange: 360,
  speedMultiplier: 1.28,
  speedCapFactor: 0.94,
  followDistance: 110,
  orderDistance: 145,
  stopDistance: 58,
  repathSeconds: 0.48,
});

function entities(game) { return game?.state?.entities || {}; }
function units(game) { return entities(game).units || []; }

function activeUnit(unit) {
  return Boolean(
    unit
    && Number(unit.hp) > 0
    && Number.isFinite(unit.x)
    && Number.isFinite(unit.y)
    && !unit.transportedIn
    && !unit.garrisonedIn
  );
}

function unitMoveModifier(game) {
  const value = Number(game?.state?.modifiers?.unitMove);
  return Number.isFinite(value) ? value : 1;
}

function supportTargets(game, apc) {
  if (!apc || getUnitRole(apc) !== 'apc' || Number(apc.hp) <= 0) return [];
  if (apc.v47SupportPlatoonId) {
    const group = getPlatoonMembers(game, apc.v47SupportPlatoonId, { activeOnly: false }).filter(activeUnit);
    if (group.length) return group;
    apc.v47SupportPlatoonId = null;
  }
  if (apc.v47SupportUnitId) {
    const target = units(game).find(unit => unit.id === apc.v47SupportUnitId);
    if (target && target !== apc && activeUnit(target)) return [target];
    apc.v47SupportUnitId = null;
  }
  return [];
}

function supportCenter(game, apc) {
  const targets = supportTargets(game, apc);
  if (!targets.length) return null;
  let x = 0, y = 0;
  for (const target of targets) { x += target.x; y += target.y; }
  return { x: x / targets.length, y: y / targets.length, targets };
}

export function buildEffectiveMovementSpeedMap(game) {
  const speed = new Map();
  const platoonMinimum = new Map();

  for (const unit of units(game)) {
    const intrinsic = getIntrinsicUnitMoveSpeed(game, unit);
    speed.set(unit.id, intrinsic);
    if (!unit.platoonId || !activeUnit(unit)) continue;
    const previous = platoonMinimum.get(unit.platoonId);
    if (previous === undefined || intrinsic < previous) platoonMinimum.set(unit.platoonId, intrinsic);
  }

  for (const unit of units(game)) {
    if (unit.platoonId && platoonMinimum.has(unit.platoonId)) speed.set(unit.id, platoonMinimum.get(unit.platoonId));
  }

  const apcCap = Number(getUnitConfig('apc').moveSpeed) * APC_SUPPORT.speedCapFactor;
  for (const apc of units(game)) {
    if (getUnitRole(apc) !== 'apc' || !activeUnit(apc) || apc.passengerId) continue;
    const center = supportCenter(game, apc);
    if (!center || Math.hypot(apc.x - center.x, apc.y - center.y) > APC_SUPPORT.activeRange) continue;
    for (const target of center.targets) {
      if (target === apc) continue;
      const base = speed.get(target.id) ?? getIntrinsicUnitMoveSpeed(game, target);
      speed.set(target.id, Math.min(apcCap, base * APC_SUPPORT.speedMultiplier));
    }
  }

  const modifier = unitMoveModifier(game);
  for (const [id, value] of speed) speed.set(id, value * modifier);
  return speed;
}

export function getEffectiveUnitMoveSpeed(game, unit) {
  const speed = buildEffectiveMovementSpeedMap(game).get(unit?.id);
  if (Number.isFinite(speed)) return speed;
  return getIntrinsicUnitMoveSpeed(game, unit) * unitMoveModifier(game);
}

function syncTruckEscort(game, unit) {
  if (!unit?.attachedTo) return false;
  const truck = units(game).find(candidate => candidate.id === unit.attachedTo && candidate.type === 'truck');
  if (!truck) {
    unit.attachedTo = null;
    unit.attachSlot = 0;
    return false;
  }
  const offset = ATTACH_OFFSETS[(Number(unit.attachSlot) || 0) % ATTACH_OFFSETS.length];
  const heading = Number(truck.heading) || 0;
  const cos = Math.cos(heading), sin = Math.sin(heading);
  unit.x = truck.x + offset[0] * cos - offset[1] * sin;
  unit.y = truck.y + offset[0] * sin + offset[1] * cos;
  unit.path = [];
  unit.moveTarget = null;
  return true;
}

function syncTransportedUnits(game) {
  let synced = 0;
  for (const unit of units(game)) {
    if (!unit.transportedIn) continue;
    const apc = units(game).find(candidate => (
      candidate.id === unit.transportedIn
      && getUnitRole(candidate) === 'apc'
      && Number(candidate.hp) > 0
    ));
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
    if (!units(game).some(unit => unit.id === apc.passengerId)) apc.passengerId = null;
  }
  return synced;
}

function medicFollowTarget(game, medic) {
  const target = units(game).find(unit => unit.id === medic?.v47FollowId);
  if (target && target !== medic && activeUnit(target) && isInfantryUnit(target) && getUnitRole(target) !== 'medic') return target;
  if (medic) medic.v47FollowId = null;
  return null;
}

function followPoint(game, follower, target, distance) {
  let angle = Number(target?.heading);
  if (!Number.isFinite(angle)) angle = Math.atan2(target.y - follower.y, target.x - follower.x);
  let radius = 18;
  try { radius = Number(getUnitRadius(follower)) || radius; } catch {}
  const width = Number(game?.config?.world?.width) || 0;
  const height = Number(game?.config?.world?.height) || 0;
  return {
    x: Math.max(radius + 6, Math.min(width - radius - 6, target.x - Math.cos(angle) * distance)),
    y: Math.max(radius + 6, Math.min(height - radius - 6, target.y - Math.sin(angle) * distance)),
  };
}

function updateMedicFollow(game, dt) {
  let ordered = 0;
  for (const medic of units(game)) {
    if (getUnitRole(medic) !== 'medic' || !activeUnit(medic)) continue;
    const target = medicFollowTarget(game, medic);
    if (!target) continue;
    medic.v47FollowTimer = Math.max(0, (Number(medic.v47FollowTimer) || 0) - dt);
    const point = followPoint(game, medic, target, MEDIC_FOLLOW.followDistance);
    const distance = Math.hypot(medic.x - point.x, medic.y - point.y);
    if (distance > MEDIC_FOLLOW.orderDistance && medic.v47FollowTimer <= 0) {
      if (setUnitDestination(game, medic, point.x, point.y, { preserveRoute: true })) ordered++;
      medic.v47FollowTimer = MEDIC_FOLLOW.repathSeconds;
    } else if (distance < MEDIC_FOLLOW.stopDistance && !target.path?.length) {
      medic.path = [];
      medic.moveTarget = null;
    }
  }
  return ordered;
}

function updateApcSupportFollow(game, dt) {
  let ordered = 0;
  for (const apc of units(game)) {
    if (getUnitRole(apc) !== 'apc' || !activeUnit(apc) || apc.passengerId) continue;
    const center = supportCenter(game, apc);
    if (!center) continue;
    apc.v47SupportTimer = Math.max(0, (Number(apc.v47SupportTimer) || 0) - dt);
    const point = followPoint(game, apc, {
      x: center.x,
      y: center.y,
      heading: center.targets[0]?.heading,
    }, APC_SUPPORT.followDistance);
    const distance = Math.hypot(apc.x - point.x, apc.y - point.y);
    if (distance > APC_SUPPORT.orderDistance && apc.v47SupportTimer <= 0) {
      if (setUnitDestination(game, apc, point.x, point.y, { preserveRoute: true })) ordered++;
      apc.v47SupportTimer = APC_SUPPORT.repathSeconds;
    } else if (distance < APC_SUPPORT.stopDistance && center.targets.every(unit => !unit.path?.length)) {
      apc.path = [];
      apc.moveTarget = null;
    }
  }
  return ordered;
}

// Authoritative production movement pass for Step 2. Navigation requests,
// waypoint following, Truck escorts, transported passengers, Platoon speed,
// APC support speed and Medic/APC follow movement all resolve here exactly once.
export function updateMovementRuntime(game, dt) {
  const step = Math.max(0, Number(dt) || 0);
  if (!game?.state?.entities || step <= 0) return { moved: 0, escorts: 0, transported: 0, supportOrders: 0 };

  const speedMap = buildEffectiveMovementSpeedMap(game);
  let moved = 0, escorts = 0;

  for (const unit of units(game)) {
    if (!unit || Number(unit.hp) <= 0 || unit.garrisonedIn || unit.transportedIn) continue;
    if (syncTruckEscort(game, unit)) { escorts++; continue; }
    if (updateUnitMovement(game, unit, step, { speed: speedMap.get(unit.id) })) moved++;
  }

  const transported = syncTransportedUnits(game);
  const supportOrders = updateMedicFollow(game, step) + updateApcSupportFollow(game, step);
  return { moved, escorts, transported, supportOrders };
}
