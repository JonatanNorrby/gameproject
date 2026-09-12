import {
  ENEMY_CONFIG,
  enemyContactDamage,
  enemyHpAtLevel,
  enemySpeedAtLevel,
  getEnemyConfig,
} from './enemyConfig.js';
import { isNavigationTerrainBlocked } from '../navigation/terrain.js';

let fallbackEnemyId = 0;

function random(game) {
  const source = game?.services?.random;
  return typeof source === 'function' ? source() : Math.random();
}

export function enemyElapsedSeconds(game) {
  return Number(game?.state?.time?.elapsed ?? game?.state?.elapsed) || 0;
}

export function enemyLevel(game) {
  return Math.floor(enemyElapsedSeconds(game) / 60) + 1;
}

function createEnemyId(game, type) {
  const service = game?.services?.enemyLifecycle?.createEnemyId;
  if (typeof service === 'function') return service(type, game);
  fallbackEnemyId += 1;
  return `e-${type}-${fallbackEnemyId}`;
}

export function randomEdgeSpawnPoint(game, type) {
  getEnemyConfig(type);
  const width = Number(game?.config?.world?.width) || 0;
  const height = Number(game?.config?.world?.height) || 0;
  const margin = 28;
  const edge = Math.floor(random(game) * 4);
  if (edge === 0) return { x: margin + random(game) * (width - margin * 2), y: margin };
  if (edge === 1) return { x: width - margin, y: margin + random(game) * (height - margin * 2) };
  if (edge === 2) return { x: margin + random(game) * (width - margin * 2), y: height - margin };
  return { x: margin, y: margin + random(game) * (height - margin * 2) };
}

export function hordeSpawnPoint(game, type, director) {
  const config = getEnemyConfig(type);
  const base = game?.state?.base;
  const horde = game?.config?.director?.horde || {};
  const width = Number(game?.config?.world?.width) || 0;
  const height = Number(game?.config?.world?.height) || 0;
  const radius = Number(director?.spawnRadius) || Number(horde.startRadius) || 1500;
  const angle = Number(director?.angle) || 0;
  const arc = Number(horde.arc) || 0.62;
  const radialJitter = Number(horde.radialJitter) || 300;
  const enemyRadius = Number(config.radius) || 8;
  const validationRadius = enemyRadius + 8;

  for (let attempt = 0; attempt < 20; attempt++) {
    const a = angle + (random(game) - 0.5) * arc;
    const rr = radius + (random(game) - 0.5) * radialJitter;
    const x = base.x + Math.cos(a) * rr;
    const y = base.y + Math.sin(a) * rr;
    if (x < validationRadius + 24 || y < validationRadius + 24
      || x > width - validationRadius - 24 || y > height - validationRadius - 24) continue;
    // Current v47 horde placement intentionally checks shaped terrain only. It
    // does not run the full structure/depot navigation blocker at spawn time.
    if (isNavigationTerrainBlocked(game, x, y, validationRadius * 0.65, { allTerrainKinds: true })) continue;
    return { x, y };
  }

  return {
    x: Math.max(30, Math.min(width - 30, base.x + Math.cos(angle) * radius)),
    y: Math.max(30, Math.min(height - 30, base.y + Math.sin(angle) * radius)),
  };
}

export function createEnemy(game, type, {
  position = null,
  horde = true,
  cacheGuard = null,
} = {}) {
  const config = getEnemyConfig(type);
  const level = enemyLevel(game);
  const point = position || randomEdgeSpawnPoint(game, type);
  const hp = enemyHpAtLevel(type, level, { horde });
  const speed = enemySpeedAtLevel(type, level, Number(game?.config?.director?.enemySpeedMultiplier) || 0.30);
  const damage = enemyContactDamage(type, { horde });
  const spitterInterval = Number(getEnemyConfig('spitter').rangedAttack?.fireInterval) || 1;

  const enemy = {
    id: createEnemyId(game, type),
    type,
    x: point.x,
    y: point.y,
    hp,
    maxHp: hp,
    speed,
    effectiveSpeed: speed,
    r: Number(config.radius) || 8,
    damage,
    burn: 0,
    burnTick: 0,
    slowFactor: 1,
    slowTime: 0,
    animOffset: random(game) * 100,
    rangeCooldown: random(game) * spitterInterval,
    specialCooldown: random(game) * 1.2,
    burrowCooldown: random(game) * 3,
    burrowed: false,
    burrowTimer: 0,
    burrowExit: null,
    climbing: false,
    chargeCooldown: 2 + random(game) * 3,
    chargeWindup: 0,
    charging: false,
    chargeWallId: null,
    cloaked: type === 'saboteur',
    horde,
  };

  if (cacheGuard) {
    enemy.cacheGuard = {
      cacheId: cacheGuard.cacheId,
      homeX: cacheGuard.homeX,
      homeY: cacheGuard.homeY,
    };
    enemy.horde = false;
  }
  return enemy;
}

export function spawnEnemy(game, type, options = {}) {
  if (!ENEMY_CONFIG[type]) throw new Error(`Unknown enemy type: ${type}`);
  const enemies = game?.state?.entities?.enemies;
  if (!Array.isArray(enemies)) throw new TypeError('spawnEnemy requires state.entities.enemies');
  const enemy = createEnemy(game, type, options);
  enemies.push(enemy);
  const callback = game?.services?.enemyLifecycle?.onEnemySpawned;
  if (typeof callback === 'function') callback(game, enemy, options);
  return enemy;
}
