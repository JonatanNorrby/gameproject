import { getUnitRole } from '../core/entities.js';

export function detachMedicFollow(game, medic) {
  if (!medic || getUnitRole(medic) !== 'medic') return false;
  const hadFollow = Boolean(medic.v47FollowId) || Number(medic.v47FollowTimer) > 0;
  medic.v47FollowId = null;
  medic.v47FollowTimer = 0;
  if (game?.state?.commands) game.state.commands.medicFollowAttachMode = false;
  return hadFollow;
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

export function detachManualMoveSupport(game, unit) {
  const role = getUnitRole(unit);
  if (role === 'medic') return detachMedicFollow(game, unit);
  if (role === 'apc') return detachApcSupport(game, unit);
  return false;
}
