import { MIGRATION_STATUS } from '../core/config.js';
import { createResourceDepot, depotStockForPosition } from '../economy/depots.js';
import { RESOURCE_TYPES } from '../economy/resources.js';
import { isNavigationTerrainBlocked } from '../navigation/terrain.js';
import { pointSegmentDistance } from '../utils/geometry.js';

export const WORLD_SYSTEM_STATUS = MIGRATION_STATUS.MIGRATED;

function random(game) {
  return typeof game?.services?.random === 'function' ? game.services.random() : Math.random();
}

function pointInPolygon(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i], b = points[j];
    const hit = ((a.y > y) !== (b.y > y))
      && (x < (b.x - a.x) * (y - a.y) / (b.y - a.y || 1e-9) + a.x);
    if (hit) inside = !inside;
  }
  return inside;
}

function makeTerrainBlob(game, kind, x, y, rx, ry) {
  const pointCount = kind === 'lake' ? 16 : kind === 'forest' ? 14 : 12;
  const points = [];
  for (let i = 0; i < pointCount; i++) {
    const angle = i / pointCount * Math.PI * 2;
    const jitter = 0.78 + random(game) * 0.34;
    points.push({ x: x + Math.cos(angle) * rx * jitter, y: y + Math.sin(angle) * ry * jitter });
  }
  const feature = { kind, x, y, rx, ry, r: Math.max(rx, ry), points, decor: [] };
  if (kind === 'forest') {
    let tries = 0;
    while (feature.decor.length < 18 && tries++ < 180) {
      const px = x + (random(game) * 2 - 1) * rx * 0.88;
      const py = y + (random(game) * 2 - 1) * ry * 0.88;
      if (pointInPolygon(px, py, points)) feature.decor.push({ x: px, y: py, s: 7 + random(game) * 7 });
    }
  }
  return feature;
}

export function generateTerrain(game) {
  const config = game.config.terrain;
  const world = game.config.world;
  const base = game.state.base;
  const terrain = [];
  let tries = 0;
  while (terrain.length < config.featureCount && tries++ < 2000) {
    const rx = config.minRadiusX + random(game) * (config.maxRadiusX - config.minRadiusX);
    const ry = config.minRadiusY + random(game) * (config.maxRadiusY - config.minRadiusY);
    const x = rx + 70 + random(game) * (world.width - rx * 2 - 140);
    const y = ry + 70 + random(game) * (world.height - ry * 2 - 140);
    const bound = Math.max(rx, ry);
    if (Math.hypot(x - base.x, y - base.y) < base.radius + world.baseTerrainClearance + bound * 0.25) continue;
    if (terrain.some(feature => Math.hypot(x - feature.x, y - feature.y) < bound + feature.r + config.featureSeparation)) continue;
    const roll = random(game);
    const kind = roll < 0.40 ? 'forest' : roll < 0.70 ? 'hill' : 'lake';
    terrain.push(makeTerrainBlob(game, kind, x, y, rx, ry));
  }
  return terrain;
}

function generateDepotType(game, type, config, existing) {
  let tries = 0, placed = 0;
  const world = game.config.world;
  const base = game.state.base;
  while (placed < config.depotCount && tries++ < 2000) {
    const x = 100 + random(game) * (world.width - 200);
    const y = 100 + random(game) * (world.height - 200);
    if (Math.hypot(x - base.x, y - base.y) < config.depotBaseClearance) continue;
    if (isNavigationTerrainBlocked(game, x, y, config.depotRadius + 6, { allTerrainKinds: true })) continue;
    if (existing.some(depot => Math.hypot(x - depot.x, y - depot.y) < Math.max(config.depotSeparation, 220))) continue;
    const stock = depotStockForPosition(game, type, x, y);
    existing.push(createResourceDepot(game, type, { id: `${type}-depot-${placed}`, x, y, stock }));
    placed++;
  }
  return placed;
}

export function generateDepots(game) {
  const depots = [];
  generateDepotType(game, RESOURCE_TYPES.CRYSTAL, game.config.economy.crystal, depots);
  generateDepotType(game, RESOURCE_TYPES.ORE, game.config.economy.ore, depots);
  return depots;
}

export function riverConflictsWithAssets(game, points, width) {
  if (!Array.isArray(points) || points.length < 2) return true;
  for (const depot of game.state.entities.depots || []) {
    for (let i = 1; i < points.length; i++) {
      if (pointSegmentDistance(depot.x, depot.y, points[i - 1].x, points[i - 1].y, points[i].x, points[i].y) < depot.r + width / 2 + 34) return true;
    }
  }
  const base = game.state.base;
  for (let i = 1; i < points.length; i++) {
    if (pointSegmentDistance(base.x, base.y, points[i - 1].x, points[i - 1].y, points[i].x, points[i].y) < base.radius + width / 2 + 170) return true;
  }
  return false;
}

function randomHorizontalRiver(game, baseY, index) {
  const config = game.config.rivers;
  const world = game.config.world;
  for (let attempt = 0; attempt < 120; attempt++) {
    const width = config.minWidth + random(game) * (config.maxWidth - config.minWidth);
    const points = [];
    const count = 9;
    const phase = random(game) * Math.PI * 2;
    const amplitude = 95 + random(game) * 85;
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      const x = -80 + t * (world.width + 160);
      const jitter = (random(game) - 0.5) * 70;
      const y = baseY + Math.sin(t * Math.PI * 2.1 + phase) * amplitude + jitter;
      points.push({ x, y: Math.max(width, Math.min(world.height - width, y)) });
    }
    if (!riverConflictsWithAssets(game, points, width)) return { id: `river-${index}-${attempt}`, points, width };
  }
  return null;
}

function deterministicSafeRiver(game, baseY, index) {
  const config = game.config.rivers;
  const world = game.config.world;
  const width = config.minWidth;
  const offsets = [0, -180, 180, -360, 360, -540, 540, -720, 720, -900, 900];
  for (const offset of offsets) {
    const y = Math.max(width, Math.min(world.height - width, baseY + offset));
    const points = [{ x: -80, y }, { x: world.width + 80, y }];
    if (!riverConflictsWithAssets(game, points, width)) return { id: `river-${index}-fallback`, points, width };
  }
  return null;
}

function makeHorizontalRiver(game, baseY, index) {
  const randomRiver = randomHorizontalRiver(game, baseY, index);
  if (randomRiver) return randomRiver;
  const fallback = deterministicSafeRiver(game, baseY, index);
  if (fallback) return fallback;
  throw new Error(`Unable to place river ${index} without intersecting Base or resource depots`);
}

export function generateRivers(game) {
  const config = game.config.rivers;
  const world = game.config.world;
  const centers = config.horizontalCenters || [0.27, 0.73];
  const jitter = Number(config.centerJitterWorldHeightFraction) || 0;
  return centers.slice(0, config.count).map((fraction, index) => {
    const baseY = world.height * fraction + random(game) * world.height * jitter;
    return makeHorizontalRiver(game, baseY, index + 1);
  });
}

export function initializeWorld(game, { force = false } = {}) {
  if (!game?.state?.entities) throw new TypeError('initializeWorld requires game state');
  if (!force && game.state.worldRuntime?.initialized) return game.state.worldRuntime;
  game.state.entities.terrain = generateTerrain(game);
  game.state.entities.depots = generateDepots(game);
  game.state.entities.rivers = generateRivers(game);
  game.state.worldRuntime = {
    initialized: true,
    terrainCount: game.state.entities.terrain.length,
    depotCount: game.state.entities.depots.length,
    riverCount: game.state.entities.rivers.length,
  };
  return game.state.worldRuntime;
}
