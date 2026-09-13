import { getUnitRole, isInfantryUnit } from '../core/entities.js';
import { removeUnitFromPlatoon } from './platoons.js';

export function detachMedicFollow(game, medic) {
  if (!medic || getUnitRole(medic) !== 'medic') return false;
  const hadFollow = Boolean(medic.v47FollowId) || Number(medic.v47FollowTimer) > 0;
  medic.v47FollowId = null;
  medic.v47FollowTimer = 0;
  if (game?.state?.commands) game.state.commands.medicFollowAttachMode = false;
  return hadFollow;
}

export function attachMedicFollow(game, medic, target) {
  if (!medic || getUnitRole(medic) !== 'medic') return { ok: false, reason: 'not-medic' };
  if (!target || target === medic || Number(target.hp) <= 0 || !isInfantryUnit(target) || getUnitRole(target) === 'medic' || target.transportedIn || target.garrisonedIn) {
    return { ok: false, reason: 'invalid-target' };
  }
  removeUnitFromPlatoon(game, medic);
  medic.attachedTo = null;
  medic.v47FollowId = target.id;
  medic.v47FollowTimer = 0;
  game.state.commands.medicFollowAttachMode = false;
  return { ok: true, medic, target };
}

export function detachApcSupport(game, apc) {
  if (!apc || getUnitRole(apc) !== 'apc') return false;
  const hadSupport = Boolean(apc.v47SupportUnitId || apc.v47SupportPlatoonId) || Number(apc.v47SupportTimer) > 0;
  apc.v47SupportUnitId = null;
  apc.v47SupportPlatoonId = null;
  apc.v47SupportTimer = 0;
  if (game?.state?.commands) game.state.commands.apcSupportAttachMode = false;
  return hadSupport;
}

export function attachApcSupport(game, apc, target) {
  if (!apc || getUnitRole(apc) !== 'apc') return { ok: false, reason: 'not-apc' };
  if (apc.passengerId) return { ok: false, reason: 'passenger-loaded' };
  if (!target || target === apc || Number(target.hp) <= 0 || target.transportedIn || target.garrisonedIn) return { ok: false, reason: 'invalid-target' };
  removeUnitFromPlatoon(game, apc);
  apc.v47SupportUnitId = target.platoonId ? null : target.id;
  apc.v47SupportPlatoonId = target.platoonId || null;
  apc.v47SupportTimer = 0;
  game.state.commands.apcSupportAttachMode = false;
  return { ok: true, apc, target, platoonId: apc.v47SupportPlatoonId };
}

export function detachManualMoveSupport(game, unit) {
  const role = getUnitRole(unit);
  if (role === 'medic') return detachMedicFollow(game, unit);
  if (role === 'apc') return detachApcSupport(game, unit);
  return false;
}
