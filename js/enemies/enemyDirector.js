import { ENEMY_CONFIG } from './enemyConfig.js';
import { enemyElapsedSeconds, hordeSpawnPoint, spawnEnemy } from './enemySpawning.js';

function random(game) {
  const source = game?.services?.random;
  return typeof source === 'function' ? source() : Math.random();
}

function hordeConfig(game) {
  return game?.config?.director?.horde || {};
}

export function ensureEnemyDirector(game) {
  const horde = hordeConfig(game);
  const state = game.state;
  const current = state.director || {};
  state.director = {
    hordeNumber: Number(current.hordeNumber) || 0,
    queuedEnemies: Number(current.queuedEnemies) || 0,
    batchTimer: Number(current.batchTimer) || 0,
    nextHordeIn: current.nextHordeIn === Infinity
      ? Infinity
      : (Number.isFinite(Number(current.nextHordeIn)) ? Number(current.nextHordeIn) : Number(horde.firstDelay) || 26),
    angle: Number(current.angle) || 0,
    spawnRadius: Number(current.spawnRadius) || Number(horde.startRadius) || 1500,
    threatAtLaunch: Number(current.threatAtLaunch) || 0,
    unitsAtLaunch: Number(current.unitsAtLaunch) || 0,
    buildingsAtLaunch: Number(current.buildingsAtLaunch) || 0,
    lastThreat: current.lastThreat || null,
  };
  return state.director;
}

export function enemyThreatSnapshot(game) {
  let units = 0, buildings = 0, construction = 0, walls = 0;
  for (const unit of game?.state?.entities?.units || []) {
    if (Number(unit?.hp) > 0) units++;
  }
  for (const structure of game?.state?.entities?.structures || []) {
    if (Number(structure?.hp) <= 0) continue;
    if (structure.type === 'wall') {
      walls++;
      continue;
    }
    if (structure.built === false) construction++;
    else buildings++;
  }
  const threat = units + buildings * 0.9 + construction * 0.55 + Math.min(6, walls * 0.12);
  return {
    units,
    buildings,
    construction,
    walls,
    threat,
    sizeMultiplier: 1 + Math.min(1.35, threat * 0.032),
    frequencyMultiplier: 1 + Math.min(0.45, threat * 0.018),
  };
}

export function baseHordeSize(game) {
  const horde = hordeConfig(game);
  const minutes = Math.floor(enemyElapsedSeconds(game) / 60);
  return Math.min(
    Number(horde.baseMaxSize) || 100,
    (Number(horde.startSize) || 34) + minutes * (Number(horde.sizePerMinute) || 6),
  );
}

export function nextHordeGap(game) {
  const horde = hordeConfig(game);
  const minutes = Math.floor(enemyElapsedSeconds(game) / 60);
  return Math.max(
    Number(horde.minGap) || 36,
    (Number(horde.baseGap) || 48) - minutes * (Number(horde.gapDropPerMinute) || 1.2),
  );
}

export function currentHordeRadius(game) {
  const horde = hordeConfig(game);
  return Math.min(
    Number(horde.maxRadius) || 2350,
    (Number(horde.startRadius) || 1500)
      + enemyElapsedSeconds(game) * (Number(horde.radiusGrowthPerSecond) || 0.85),
  );
}

function eligibleSpecials(game) {
  const elapsed = enemyElapsedSeconds(game);
  return Object.values(ENEMY_CONFIG).filter(config => (
    config.spawn?.enabled
    && Number.isFinite(Number(config.spawn?.specialWeight))
    && elapsed >= (Number(config.spawn?.startAfterSeconds) || 0)
  ));
}

function weightedSpecial(game, configs) {
  let total = 0;
  for (const config of configs) total += Number(config.spawn.specialWeight) || 1;
  let roll = random(game) * total;
  for (const config of configs) {
    roll -= Number(config.spawn.specialWeight) || 1;
    if (roll <= 0) return config.id;
  }
  return configs[0]?.id || 'ravager';
}

function commonEnemyType(game) {
  const common = Object.values(ENEMY_CONFIG).filter(config => (
    config.spawn?.enabled && Number.isFinite(Number(config.spawn?.commonWeight))
  ));
  let total = 0;
  for (const config of common) total += Number(config.spawn.commonWeight) || 0;
  let roll = random(game) * total;
  for (const config of common) {
    roll -= Number(config.spawn.commonWeight) || 0;
    if (roll <= 0) return config.id;
  }
  return 'ravager';
}

export function chooseHordeEnemyType(game) {
  const elapsed = enemyElapsedSeconds(game);
  const caps = hordeConfig(game).spawnCaps || {};
  const flyer = ENEMY_CONFIG.flyer;
  if (elapsed >= (Number(flyer.spawn?.startAfterSeconds) || 0)
    && random(game) < (Number(caps.flyerChance) || 0.06)) return 'flyer';

  if (random(game) < (Number(caps.spitterChance) || 0.03)) return 'spitter';

  const specials = eligibleSpecials(game);
  const rampSeconds = Number(caps.specialRampSeconds) || 600;
  const baseChance = Number(caps.specialBaseChance) || 0.05;
  const maxChance = Number(caps.specialMaxChance) || 0.18;
  const specialChance = Math.min(
    maxChance,
    baseChance + Math.min(1, elapsed / rampSeconds) * (maxChance - baseChance),
  );
  if (specials.length && random(game) < specialChance) return weightedSpecial(game, specials);
  return commonEnemyType(game);
}

export function spawnHordeEnemy(game, director = ensureEnemyDirector(game)) {
  const type = chooseHordeEnemyType(game);
  const position = hordeSpawnPoint(game, type, director);
  return spawnEnemy(game, type, { position, horde: true });
}

export function updateEnemyDirector(game, dt) {
  const step = Math.max(0, Number(dt) || 0);
  const horde = hordeConfig(game);
  const director = ensureEnemyDirector(game);
  let spawned = 0;

  if (director.queuedEnemies > 0) {
    director.batchTimer -= step;
    while (director.queuedEnemies > 0 && director.batchTimer <= 0) {
      const count = Math.min(Number(horde.batchSize) || 5, director.queuedEnemies);
      for (let i = 0; i < count; i++) {
        spawnHordeEnemy(game, director);
        spawned++;
      }
      director.queuedEnemies -= count;
      director.batchTimer += Number(horde.batchInterval) || 0.50;
    }
    if (director.queuedEnemies <= 0) director.nextHordeIn = nextHordeGap(game);
    return { spawned, launched: false, director };
  }

  const threat = director.hordeNumber > 0 ? enemyThreatSnapshot(game) : null;
  const frequencyMultiplier = threat?.frequencyMultiplier || 1;
  director.nextHordeIn -= step * frequencyMultiplier;
  if (director.nextHordeIn > 0) return { spawned, launched: false, director };

  director.hordeNumber += 1;
  const launchThreat = enemyThreatSnapshot(game);
  const baseSize = baseHordeSize(game);
  director.queuedEnemies = Math.min(
    Number(horde.maxSize) || 220,
    Math.max(baseSize, Math.round(baseSize * launchThreat.sizeMultiplier)),
  );
  director.batchTimer = 0;
  director.angle = random(game) * Math.PI * 2;
  director.spawnRadius = currentHordeRadius(game);
  director.nextHordeIn = Infinity;
  director.threatAtLaunch = launchThreat.threat;
  director.unitsAtLaunch = launchThreat.units;
  director.buildingsAtLaunch = launchThreat.buildings + launchThreat.construction;
  director.lastThreat = launchThreat;
  return { spawned, launched: true, director };
}
