import { getEntityRadius, isTower } from '../core/entities.js';
import { createBuildingRuntime } from './buildingRuntime.js';
import { getBuildingConfig, wallBuildTime, wallCost, wallHp } from './buildingConfig.js';
import { canAttachResourceMine, createMineForDepot } from '../economy/depots.js';
import { spendResources } from '../economy/resources.js';
import { getTowerConfig } from '../towers/towerConfig.js';
import { isNavigationTerrainBlocked } from '../navigation/terrain.js';
import { pointSegmentDistance } from '../utils/geometry.js';

const BUILDING_TYPES = new Set(['mine', 'oremine', 'refinery', 'landingpad']);

function id(game, prefix) {
  const now = typeof game?.services?.now === 'function' ? game.services.now() : Date.now();
  const random = typeof game?.services?.random === 'function' ? game.services.random() : Math.random();
  return `${prefix}${now}-${String(random).replace('.', '')}`;
}

function structureRadius(structure) {
  try { return Number(getEntityRadius(structure)) || 28; } catch { return Number(structure?.collisionRadius) || 28; }
}

function insideWorld(game, x, y, radius) {
  return x >= radius && y >= radius && x <= game.config.world.width - radius && y <= game.config.world.height - radius;
}

export function activeConstructionCount(game) {
  const groups = new Set();
  for (const structure of game?.state?.entities?.structures || []) {
    if (structure && structure.built === false && Number(structure.hp) > 0) groups.add(structure.groupId || structure.id);
  }
  return groups.size;
}

export function freeWorkers(game) {
  return Math.max(0, Number(game.config.workers.count) - activeConstructionCount(game));
}

export function findResourceDepotForPlacement(game, x, y, resourceType) {
  let best = null, bestDistance = Infinity;
  for (const depot of game?.state?.entities?.depots || []) {
    if (depot.resourceType !== resourceType || !canAttachResourceMine(game, depot)) continue;
    const distance = Math.hypot(x - depot.x, y - depot.y);
    if (distance <= (Number(depot.r) || 34) + 30 && distance < bestDistance) { best = depot; bestDistance = distance; }
  }
  return best;
}

export function placementBlocked(game, x, y, radius, type, { ignoreId = null, ignoreDepotId = null, sameDepotId = null } = {}) {
  const r = Math.max(1, Number(radius) || 20);
  if (!insideWorld(game, x, y, r)) return true;
  if (Math.hypot(x - game.state.base.x, y - game.state.base.y) < game.state.base.radius + r + game.config.world.baseBuildClearance) return true;
  if (isNavigationTerrainBlocked(game, x, y, r, { allTerrainKinds: true })) return true;
  for (const structure of game.state.entities.structures || []) {
    if (!structure || structure.id === ignoreId || Number(structure.hp) <= 0) continue;
    // v26 deliberately allows the three Mine slots on one depot to overlap each
    // other's broad placement footprints. Other structures remain blockers.
    if ((type === 'mine' || type === 'oremine') && sameDepotId
      && (structure.type === 'mine' || structure.type === 'oremine')
      && structure.depotId === sameDepotId) continue;
    if (structure.type === 'wall' && Number.isFinite(structure.x1)) {
      const thickness = Number(structure.thickness) || game.config.buildings.wall.wall.thickness;
      if (pointSegmentDistance(x, y, structure.x1, structure.y1, structure.x2, structure.y2) < r + thickness / 2 + 3) return true;
    } else if (Number.isFinite(structure.x)) {
      if (Math.hypot(x - structure.x, y - structure.y) < r + structureRadius(structure) + 4) return true;
    }
  }
  if (type !== 'mine' && type !== 'oremine') {
    for (const depot of game.state.entities.depots || []) {
      if (depot.id === ignoreDepotId) continue;
      if (Math.hypot(x - depot.x, y - depot.y) < r + (Number(depot.r) || 34) + 3) return true;
    }
  }
  return false;
}

export function placementDefinition(type) {
  if (BUILDING_TYPES.has(type)) {
    const definition = getBuildingConfig(type);
    return { kind: 'building', type, radius: definition.placementRadius, cost: definition.cost, enabled: definition.enabled !== false };
  }
  try {
    const tower = getTowerConfig(type);
    return { kind: 'tower', type, radius: tower.placementRadius, cost: tower.cost, enabled: true };
  } catch {}
  if (type === 'wall') return { kind: 'wall', type, radius: getBuildingConfig('wall').placementRadius, cost: null, enabled: true };
  return null;
}

export function validatePlacement(game, type, x, y) {
  const definition = placementDefinition(type);
  if (!definition || !definition.enabled) return { ok: false, reason: 'disabled-or-unknown' };
  if (freeWorkers(game) <= 0) return { ok: false, reason: 'no-workers' };
  if (type === 'mine' || type === 'oremine') {
    const resourceType = type === 'mine' ? 'crystal' : 'ore';
    const depot = findResourceDepotForPlacement(game, x, y, resourceType);
    if (!depot) return { ok: false, reason: 'no-matching-depot' };
    if (placementBlocked(game, depot.x, depot.y, 24, type, { ignoreDepotId: depot.id, sameDepotId: depot.id })) return { ok: false, reason: 'blocked', depot };
    return { ok: true, definition, depot, x: depot.x, y: depot.y };
  }
  if (placementBlocked(game, x, y, definition.radius, type)) return { ok: false, reason: 'blocked' };
  return { ok: true, definition, x, y };
}

export function placeStructure(game, type, x, y) {
  const validation = validatePlacement(game, type, x, y);
  if (!validation.ok) return validation;
  if (type === 'wall') return { ok: false, reason: 'use-wall-path' };
  const { definition } = validation;
  if (!spendResources(game, definition.cost)) return { ok: false, reason: 'cannot-afford', cost: definition.cost };
  if (type === 'mine' || type === 'oremine') {
    const result = createMineForDepot(game, type, validation.depot, { id: id(game, 's'), built: false, spendCost: false });
    if (!result.ok) return result;
    return { ok: true, structure: result.building, type, cost: definition.cost };
  }
  if (definition.kind === 'building') {
    const result = createBuildingRuntime(game, type, { id: id(game, 's'), x, y, built: false });
    if (!result.ok) return result;
    game.state.entities.structures.push(result.building);
    return { ok: true, structure: result.building, type, cost: definition.cost };
  }
  const config = getTowerConfig(type);
  const tower = {
    id: id(game, 't'), type, x, y,
    hp: config.maxHp, maxHp: config.maxHp,
    built: false, buildTime: config.buildTime, buildRemaining: config.buildTime,
    cool: 0, level: 1, protected: false, safeSpotId: null,
  };
  game.state.entities.structures.push(tower);
  return { ok: true, structure: tower, type, cost: definition.cost };
}

export function wallPathLength(points) {
  let total = 0;
  for (let i = 1; i < (points?.length || 0); i++) total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  return total;
}

export function normalizeWallPath(game, points) {
  const min = getBuildingConfig('wall').wall.minLength;
  const out = [];
  for (const point of points || []) {
    if (!out.length || Math.hypot(point.x - out.at(-1).x, point.y - out.at(-1).y) >= min) out.push({ x: point.x, y: point.y });
  }
  if (out.length >= 3 && Math.hypot(out.at(-1).x - out.at(-2).x, out.at(-1).y - out.at(-2).y) < min) out.splice(-2, 1);
  return out;
}

export function validateWallSegment(game, a, b) {
  const config = getBuildingConfig('wall').wall;
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  const half = config.thickness / 2;
  if (length < config.minLength) return { ok: false, reason: 'too-short' };
  if (length > config.maxLength) return { ok: false, reason: 'too-long' };
  if (!insideWorld(game, a.x, a.y, half) || !insideWorld(game, b.x, b.y, half)) return { ok: false, reason: 'outside-world' };
  if (pointSegmentDistance(game.state.base.x, game.state.base.y, a.x, a.y, b.x, b.y) < game.state.base.radius + half + 2) return { ok: false, reason: 'base-overlap' };
  const samples = Math.max(2, Math.ceil(length / 24));
  for (let i = 0; i <= samples; i++) {
    const t = i / samples, x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
    if (isNavigationTerrainBlocked(game, x, y, half, { allTerrainKinds: true })) return { ok: false, reason: 'terrain-overlap' };
  }
  for (const depot of game.state.entities.depots || []) if (pointSegmentDistance(depot.x, depot.y, a.x, a.y, b.x, b.y) < (Number(depot.r) || 34) + half + 2) return { ok: false, reason: 'depot-overlap' };
  for (const structure of game.state.entities.structures || []) {
    if (!structure || Number(structure.hp) <= 0) continue;
    if (structure.type === 'wall' && Number.isFinite(structure.x1)) {
      for (let i = 0; i <= samples; i++) {
        const t = i / samples, x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
        const thickness = Number(structure.thickness) || config.thickness;
        if (pointSegmentDistance(x, y, structure.x1, structure.y1, structure.x2, structure.y2) < half + thickness / 2 + 3) return { ok: false, reason: 'wall-overlap' };
      }
    } else if (Number.isFinite(structure.x) && pointSegmentDistance(structure.x, structure.y, a.x, a.y, b.x, b.y) < structureRadius(structure) + half + 3) return { ok: false, reason: 'structure-overlap' };
  }
  return { ok: true, length };
}

export function validateWallPath(game, points) {
  const normalized = normalizeWallPath(game, points);
  if (normalized.length < 2) return { ok: false, reason: 'empty-path' };
  const total = wallPathLength(normalized);
  if (total > getBuildingConfig('wall').wall.maxPathLength) return { ok: false, reason: 'path-too-long', total };
  for (let i = 1; i < normalized.length; i++) {
    const result = validateWallSegment(game, normalized[i - 1], normalized[i]);
    if (!result.ok) return { ...result, segment: i - 1, total };
  }
  return { ok: true, points: normalized, total, cost: wallCost(total), buildTime: wallBuildTime(total) };
}

export function placeWallPath(game, points) {
  const validation = validateWallPath(game, points);
  if (!validation.ok) return validation;
  if (freeWorkers(game) <= 0) return { ok: false, reason: 'no-workers' };
  if (!spendResources(game, { metal: validation.cost })) return { ok: false, reason: 'cannot-afford', cost: { metal: validation.cost } };
  const groupId = id(game, 'wg');
  const structures = [];
  for (let i = 1; i < validation.points.length; i++) {
    const a = validation.points[i - 1], b = validation.points[i];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    const structure = {
      id: id(game, 'w'), groupId, type: 'wall',
      x: (a.x + b.x) / 2, y: (a.y + b.y) / 2,
      x1: a.x, y1: a.y, x2: b.x, y2: b.y,
      length, thickness: getBuildingConfig('wall').wall.thickness,
      hp: wallHp(length), maxHp: wallHp(length), built: false,
      buildTime: validation.buildTime, buildRemaining: validation.buildTime,
      cool: 0, protected: false, safeSpotId: null,
    };
    game.state.entities.structures.push(structure);
    structures.push(structure);
  }
  return { ok: true, structures, groupId, cost: validation.cost, buildTime: validation.buildTime, total: validation.total };
}

export function isUpgradeableTower(structure) {
  return Boolean(structure?.built && isTower(structure));
}
