import { MIGRATION_STATUS } from '../core/config.js';
export { UNIT_ALIASES, UNIT_CONFIG, UNIT_TYPES, getUnitConfig, hasUnitTrait, normalizeUnitType } from './unitConfig.js';
export { issueManualMove, issueMove, isManuallyMovableUnit, MOVE_COMMAND_SOURCES } from './commands.js';
export { formationOffset, getPlatoonForUnit, getPlatoonMembers, issuePlatoonMove } from './platoons.js';
export { attachApcSupport, attachMedicFollow, detachApcSupport, detachManualMoveSupport, detachMedicFollow } from './support.js';
export { createPlayerUnit, deployUnitFromBase, findBaseDeploymentPoint } from './deployment.js';
export { canBoardApc, findNearestBoardableUnit, getApcPassenger, loadApc, unloadApc } from './transport.js';

export const UNIT_SYSTEM_STATUS = MIGRATION_STATUS.PARTIALLY_MIGRATED;

// Production migration Step 3 owns canonical unit identity/deployment, APC
// transport actions and unit-only destruction cleanup. Step 2 remains the only
// production movement owner, while selection/action UI and rendering are still
// intentionally legacy until their later migration steps.
export function updateUnits(_game, _dt) {}
