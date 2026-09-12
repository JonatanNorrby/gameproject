import { MIGRATION_STATUS } from '../core/config.js';
export { UNIT_ALIASES, UNIT_CONFIG, UNIT_TYPES, getUnitConfig, hasUnitTrait, normalizeUnitType } from './unitConfig.js';
export { issueManualMove, issueMove, isManuallyMovableUnit, MOVE_COMMAND_SOURCES } from './commands.js';
export { formationOffset, getPlatoonForUnit, getPlatoonMembers, issuePlatoonMove } from './platoons.js';
export { detachApcSupport, detachManualMoveSupport, detachMedicFollow } from './support.js';

export const UNIT_SYSTEM_STATUS = MIGRATION_STATUS.PARTIALLY_MIGRATED;

// Prompt 5 owns only manual move-command routing, Platoon movement routing and
// support detach-on-player-move. Unit lifecycle, support-follow updates, Platoon
// management UI and combat remain legacy-owned.
export function updateUnits(_game, _dt) {}
