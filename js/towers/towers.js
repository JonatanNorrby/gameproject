import { MIGRATION_STATUS } from '../core/config.js';

export const TOWER_SYSTEM_STATUS = MIGRATION_STATUS.SKELETON_CREATED;

export const TOWER_TYPES = Object.freeze([
  'laser', 'flame', 'railgun', 'tesla', 'antiair', 'cryo',
  'mortar', 'minigun', 'missile', 'dronebay',
]);

// Future owner: tower lifecycle, combat behavior and the existing 1/3 upgrade model.
export function updateTowers(_game, _dt) {
  // Prompt 2 interface only.
}
