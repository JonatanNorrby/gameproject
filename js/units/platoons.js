import { canJoinPlatoon, getUnitRadius } from '../core/entities.js';
import { setUnitDestination } from '../movement/movement.js';

const FORMATION_SPACING = 54;
const FORMATION_GOLDEN_ANGLE = 2.399963229728653;

function units(game) {
  return game?.state?.entities?.units || [];
}

function platoonId(game) {
  const create = game?.services?.units?.createPlatoonId;
  if (typeof create === 'function') return create(game);
  const now = typeof game?.services?.now === 'function' ? game.services.now() : Date.now();
  const random = typeof game?.services?.random === 'function' ? game.services.random() : Math.random();
  return `p${now}-${String(random).replace('.', '')}`;
}

export function canUsePlatoonMember(game, unit) {
  return Boolean(
    unit
    && units(game).includes(unit)
    && Number(unit.hp) > 0
    && !unit.garrisonedIn
    && !unit.transportedIn
    && !unit.attachedTo
    && canJoinPlatoon(unit)
  );
}

export function getPlatoonMembers(game, platoonId, { activeOnly = false } = {}) {
  if (!platoonId) return [];
  const members = units(game).filter(unit => unit.platoonId === platoonId);
  return activeOnly ? members.filter(unit => canUsePlatoonMember(game, unit)) : members;
}

export function getPlatoonForUnit(game, unit) {
  if (!unit?.platoonId) return null;
  return { id: unit.platoonId, members: getPlatoonMembers(game, unit.platoonId) };
}

function normalizeSmallPlatoon(game, id) {
  const members = getPlatoonMembers(game, id);
  if (members.length >= 2) return;
  for (const unit of members) {
    unit.platoonId = null;
    unit.platoonSlot = 0;
  }
}

function assignPlatoonSlots(game, id) {
  getPlatoonMembers(game, id).forEach((unit, index) => { unit.platoonSlot = index; });
}

export function removeUnitFromPlatoon(game, unit) {
  const id = unit?.platoonId;
  if (!id) return false;
  unit.platoonId = null;
  unit.platoonSlot = 0;
  normalizeSmallPlatoon(game, id);
  assignPlatoonSlots(game, id);
  return true;
}

export function createOrMergePlatoon(game, first, second) {
  if (!canUsePlatoonMember(game, first) || !canUsePlatoonMember(game, second) || first === second) return { ok: false, reason: 'invalid-member' };
  let id = first.platoonId || second.platoonId || platoonId(game);
  const firstOld = first.platoonId, secondOld = second.platoonId;
  if (firstOld && secondOld && firstOld !== secondOld) {
    const destination = firstOld;
    for (const member of getPlatoonMembers(game, secondOld)) member.platoonId = destination;
    id = destination;
  } else {
    first.platoonId = id;
    second.platoonId = id;
  }
  if (!first.platoonId) first.platoonId = id;
  if (!second.platoonId) second.platoonId = id;
  assignPlatoonSlots(game, id);
  if (firstOld && firstOld !== id) normalizeSmallPlatoon(game, firstOld);
  if (secondOld && secondOld !== id) normalizeSmallPlatoon(game, secondOld);
  return { ok: true, platoonId: id, members: getPlatoonMembers(game, id) };
}

export function disbandPlatoon(game, idOrUnit) {
  const id = typeof idOrUnit === 'string' ? idOrUnit : idOrUnit?.platoonId;
  if (!id) return 0;
  const members = getPlatoonMembers(game, id);
  for (const unit of members) { unit.platoonId = null; unit.platoonSlot = 0; }
  return members.length;
}

export function formationOffset(index) {
  if (index === 0) return { x: 0, y: 0 };
  const ring = Math.ceil(Math.sqrt(index));
  const radius = FORMATION_SPACING * ring;
  const angle = index * FORMATION_GOLDEN_ANGLE;
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
}

function cancelTruckManualRoute(unit) {
  if (unit?.type !== 'truck') return;
  unit.routeLoop = false;
  unit.routeActive = false;
  unit.routePendingStart = false;
  unit.routeInTransit = false;
}

export function issuePlatoonMove(game, id, x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return { ok: false, reason: 'invalid-destination', platoonId: id, ordered: 0, total: 0 };
  const members = getPlatoonMembers(game, id, { activeOnly: true });
  if (members.length < 2) {
    normalizeSmallPlatoon(game, id);
    return { ok: false, reason: 'platoon-too-small', platoonId: id, ordered: 0, total: members.length };
  }

  assignPlatoonSlots(game, id);
  const width = Number(game?.config?.world?.width) || 0;
  const height = Number(game?.config?.world?.height) || 0;
  let ordered = 0;
  const results = [];

  for (let index = 0; index < members.length; index++) {
    const unit = members[index];
    const offset = formationOffset(index);
    const radius = getUnitRadius(unit);
    const targetX = Math.max(radius, Math.min(width - radius, x + offset.x));
    const targetY = Math.max(radius, Math.min(height - radius, y + offset.y));
    cancelTruckManualRoute(unit);
    let ok = setUnitDestination(game, unit, targetX, targetY, { preserveRoute: unit.type === 'truck' });
    if (!ok && Math.hypot(targetX - x, targetY - y) > 1) {
      ok = setUnitDestination(game, unit, x, y, { preserveRoute: unit.type === 'truck' });
    }
    if (ok) ordered += 1;
    results.push({ unitId: unit.id, ok });
  }

  return { ok: ordered > 0, kind: 'platoon', platoonId: id, ordered, total: members.length, results };
}
