import { getEnemyConfig } from './enemyConfig.js';

export function enemyBountyGold(enemy) {
  try { return Number(getEnemyConfig(enemy?.type).bountyGold) || 0; }
  catch { return 0; }
}

export function grantEnemyReward(game, enemy) {
  if (!enemy || enemy.rewardGranted || enemy.removedWithoutReward) return 0;
  enemy.rewardGranted = true;
  const reward = enemyBountyGold(enemy);
  if (!game?.state?.debug?.unlimitedCash) {
    if (game?.state?.resources) game.state.resources.gold = (Number(game.state.resources.gold) || 0) + reward;
    else if (game?.state) game.state.credits = (Number(game.state.credits) || 0) + reward;
  }
  const callback = game?.services?.enemyLifecycle?.onEnemyDestroyed;
  if (typeof callback === 'function') callback(game, enemy, reward);
  return reward;
}

export function cleanupDeadEnemies(game) {
  const enemies = game?.state?.entities?.enemies;
  if (!Array.isArray(enemies)) return 0;
  let removed = 0;
  for (let i = enemies.length - 1; i >= 0; i--) {
    const enemy = enemies[i];
    if (Number(enemy?.hp) > 0) continue;
    if (!enemy?.removedWithoutReward) grantEnemyReward(game, enemy);
    enemies.splice(i, 1);
    removed++;
  }
  return removed;
}

export function removeEnemyWithoutReward(game, enemy) {
  if (!enemy) return false;
  enemy.removedWithoutReward = true;
  const enemies = game?.state?.entities?.enemies;
  const index = Array.isArray(enemies) ? enemies.indexOf(enemy) : -1;
  if (index >= 0) enemies.splice(index, 1);
  return index >= 0;
}
