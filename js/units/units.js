import { MIGRATION_STATUS } from '../core/config.js';
export { UNIT_ALIASES, UNIT_CONFIG, UNIT_TYPES, getUnitConfig, hasUnitTrait, normalizeUnitType } from './unitConfig.js';

export const UNIT_SYSTEM_STATUS = MIGRATION_STATUS.SKELETON_CREATED;

// Future owner: unit lifecycle, movement orchestration, platoons and support
// coordination. Detailed movement/support behavior is intentionally not ported yet.
export function updateUnits(_game, _dt) {
  // Prompt 3 still provides interface only.
}
