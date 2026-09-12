import { MIGRATION_STATUS } from '../core/config.js';

export const RENDERING_SYSTEM_STATUS = MIGRATION_STATUS.SKELETON_CREATED;

// Future owner of the single world render pass. It must not wrap or invoke the
// legacy draw chain when migrated.
export function renderWorld(_game, _ctx) {
  // Prompt 2 interface only.
}
