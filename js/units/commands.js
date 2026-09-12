import { getUnitRole } from '../core/entities.js';
import { setUnitDestination } from '../movement/movement.js';
import { getPlatoonForUnit, issuePlatoonMove } from './platoons.js';
import { detachManualMoveSupport } from './support.js';

export const MOVE_COMMAND_SOURCES = Object.freeze({
  PLAYER: 'player',
  SUPPORT_AI: 'support-ai',
  LOGISTICS: 'logistics',
});

export function isManuallyMovableUnit(game, unit) {
  return Boolean(
    unit
    && game?.state?.entities?.units?.includes(unit)
    && Number(unit.hp) > 0
    && Number.isFinite(unit.x)
    && Number.isFinite(unit.y)
    && !unit.garrisonedIn
    && !unit.transportedIn
    && !unit.attachedTo
  );
}

function cancelManualTruckRoute(unit) {
  if (unit?.type !== 'truck') return;
  unit.routeLoop = false;
  unit.routeActive = false;
  unit.routePendingStart = false;
  // Clean logistics tracks whether the current route leg owns movement. This has
  // no legacy balance meaning, but must be cleared when the player takes control.
  unit.routeInTransit = false;
}

export function issueMove(game, unit, x, y, { source = MOVE_COMMAND_SOURCES.PLAYER } = {}) {
  if (!isManuallyMovableUnit(game, unit)) return { ok: false, reason: unit?.attachedTo ? 'attached-to-truck' : 'unit-not-movable' };
  if (!Number.isFinite(x) || !Number.isFinite(y)) return { ok: false, reason: 'invalid-destination' };

  if (source === MOVE_COMMAND_SOURCES.PLAYER) {
    detachManualMoveSupport(game, unit);
    const platoon = getPlatoonForUnit(game, unit);
    if (platoon) return issuePlatoonMove(game, platoon.id, x, y);
    cancelManualTruckRoute(unit);
  }

  const ok = setUnitDestination(game, unit, x, y, {
    // Route/service orchestration now has one owner in economy/truckLogistics.js.
    // Logistics and support movement preserve that state; a player order cancels
    // it above before using the same Prompt-4 destination primitive.
    preserveRoute: unit.type === 'truck' || source !== MOVE_COMMAND_SOURCES.PLAYER,
  });
  return { ok, kind: 'individual', unitId: unit.id, role: getUnitRole(unit), source };
}

export function issueManualMove(game, unit, x, y) {
  return issueMove(game, unit, x, y, { source: MOVE_COMMAND_SOURCES.PLAYER });
}
