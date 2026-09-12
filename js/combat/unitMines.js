import { getEnemyRadius, isGroundEnemy } from '../core/entities.js';
import { squaredDistance } from '../utils/math.js';
import { isAlive } from './damage.js';
import { applyPlayerEnemyDamage } from './playerDamage.js';

export function updatePlayerMines(game, mineDefinition, emitEffect = () => {}) {
  const mines = game?.state?.entities?.playerMines || [];
  const enemies = game?.state?.entities?.enemies || [];
  const triggerRadius = Number(mineDefinition?.triggerRadius) || 0;
  const splashRadius = Number(mineDefinition?.splashRadius) || 0;
  const damage = Number(mineDefinition?.damage) || 0;
  let detonations = 0;

  for (let i = mines.length - 1; i >= 0; i--) {
    const mine = mines[i];
    const trigger = enemies.find(enemy => {
      if (!isAlive(enemy) || !isGroundEnemy(enemy) || enemy.burrowed) return false;
      const r = triggerRadius + getEnemyRadius(enemy);
      return squaredDistance(enemy.x, enemy.y, mine.x, mine.y) <= r * r;
    });
    if (!trigger) continue;

    const splash2 = splashRadius * splashRadius;
    for (const enemy of [...enemies]) {
      if (!isAlive(enemy) || !isGroundEnemy(enemy) || enemy.burrowed) continue;
      if (squaredDistance(enemy.x, enemy.y, mine.x, mine.y) > splash2) continue;
      applyPlayerEnemyDamage(game, enemy, damage * (enemy === trigger ? 1 : 0.72), { source: mine, attackKind: 'mine' });
    }
    emitEffect({ kind: 'mineblast', x: mine.x, y: mine.y, r: splashRadius, durationMs: 240, legacyChannel: 'v25Effects' });
    mines.splice(i, 1);
    detonations++;
  }
  return detonations;
}
