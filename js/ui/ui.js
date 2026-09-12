import { MIGRATION_STATUS } from '../core/config.js';

export const UI_SYSTEM_STATUS = MIGRATION_STATUS.SKELETON_CREATED;

export function initUI(game) {
  if (!game) throw new TypeError('initUI requires a game context');
  // No DOM listeners or elements are changed in Prompt 2.
  return Object.freeze({
    dispose() {},
  });
}

export function renderUI(_game) {
  // Prompt 2 interface only.
}
