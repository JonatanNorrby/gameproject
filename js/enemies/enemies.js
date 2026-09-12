import { MIGRATION_STATUS } from '../core/config.js';

export const ENEMY_SYSTEM_STATUS = MIGRATION_STATUS.SKELETON_CREATED;

export const ENEMY_ROLES = Object.freeze([
  'ravager', 'swarm', 'runner', 'brute', 'ranged', 'flyer',
  'siegebeast', 'burrower', 'climber', 'acidlobber', 'crusher',
  'harvesterhunter', 'saboteur',
]);

// Future owner: spawning/director integration, enemy movement and AI.
export function updateEnemies(_game, _dt) {
  // Prompt 2 interface only.
}
