import { MIGRATION_STATUS } from '../core/config.js';
export { ENEMY_CONFIG, ENEMY_TYPES, getEnemyConfig, hasEnemyTrait, normalizeEnemyType } from './enemyConfig.js';

export const ENEMY_SYSTEM_STATUS = MIGRATION_STATUS.SKELETON_CREATED;

// Future owner: spawning/director integration, enemy movement and AI.
export function updateEnemies(_game, _dt) {
  // Prompt 3 still provides interface only.
}
