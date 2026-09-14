import { MIGRATION_STATUS } from '../core/config.js';

export const NAVIGATION_SYSTEM_STATUS = MIGRATION_STATUS.MIGRATED;

export {
  findNearestOpenDestination,
  findPath,
  isNavigationPointBlocked,
  isNavigationSegmentOpen,
} from './pathfinding.js';
export { isNavigationTerrainBlocked } from './terrain.js';

// Navigation is request-driven rather than frame-driven. Production Step 2 now
// routes path/blocking requests through these clean owners; the empty update hook
// remains for the future single clean update pipeline.
export function updateNavigation(_game, _dt) {}
