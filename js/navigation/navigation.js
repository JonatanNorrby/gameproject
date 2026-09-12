import { MIGRATION_STATUS } from '../core/config.js';

export const NAVIGATION_SYSTEM_STATUS = MIGRATION_STATUS.PARTIALLY_MIGRATED;

export {
  findNearestOpenDestination,
  findPath,
  isNavigationPointBlocked,
  isNavigationSegmentOpen,
} from './pathfinding.js';
export { isNavigationTerrainBlocked } from './terrain.js';

// Pathfinding is request-driven. This update hook remains intentionally empty
// until a later prompt migrates higher-level movement-command orchestration.
export function updateNavigation(_game, _dt) {}
