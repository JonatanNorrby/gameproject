import { MIGRATION_STATUS } from '../core/config.js';

export const INPUT_SYSTEM_STATUS = MIGRATION_STATUS.SKELETON_CREATED;

export function initInput(game) {
  if (!game) throw new TypeError('initInput requires a game context');
  // No listeners are registered in Prompt 2. This keeps the dormant runtime from
  // competing with the current pointer/keyboard ownership chain.
  return Object.freeze({
    dispose() {},
  });
}

export function applyInputCommands(_game, _dt) {
  // Prompt 2 interface only.
}
