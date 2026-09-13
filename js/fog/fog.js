import { MIGRATION_STATUS } from '../core/config.js';
import { getUnitDefinition, getUnitRole, isFlyingUnit, isTower } from '../core/entities.js';
import { getEffectiveTowerStats } from '../combat/towerStats.js';

export const FOG_SYSTEM_STATUS = MIGRATION_STATUS.MIGRATED;
export const FOG_EXPLORED_ALPHA = 0.62;
export const FOG_UNEXPLORED_ALPHA = 0.985;
export const FOG_REVEAL_FEATHER_START = 0.84;
export const FOG_REVEAL_OUTER_ALPHA = 0.92;
export const FOG_EXPLORE_CELL_PADDING = 0.72;

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function fogGrid(game) {
  const cellSize = Math.max(1, finite(game?.config?.fog?.cellSize, 96));
  return {
    cellSize,
    cols: Math.ceil(finite(game?.config?.world?.width) / cellSize),
    rows: Math.ceil(finite(game?.config?.world?.height) / cellSize),
  };
}

export function ensureFogState(game) {
  if (!game?.state) throw new TypeError('ensureFogState requires game.state');
  const grid = fogGrid(game);
  const length = grid.cols * grid.rows;
  if (!game.state.fog || typeof game.state.fog !== 'object') game.state.fog = {};
  if (!(game.state.fog.explored instanceof Uint8Array) || game.state.fog.explored.length !== length) {
    game.state.fog.explored = new Uint8Array(length);
  }
  if (!Array.isArray(game.state.fog.visionSources)) game.state.fog.visionSources = [];
  if (!Number.isFinite(Number(game.state.fog.lastExploreMarkAt))) game.state.fog.lastExploreMarkAt = -Infinity;
  game.state.fog.grid = grid;
  return game.state.fog;
}

export function unitVisionRadius(game, unit) {
  const role = getUnitRole(unit);
  const config = game?.config?.fog?.unitVision || {};
  if (role === 'scout') return finite(config.scout, 460);
  if (role === 'spotter') return finite(config.spotter, 440);
  if (role === 'sniper') return finite(config.sniper, 520);
  if (isFlyingUnit(unit)) return finite(config.flying, 350);
  const definition = getUnitDefinition(unit) || {};
  const weaponRange = finite(definition.combat?.range);
  const detectRange = finite(definition.detectionRange);
  const spotRange = finite(definition.spotting?.range);
  return Math.max(
    finite(config.groundMinimum, 250),
    weaponRange + finite(config.weaponRangePadding, 65),
    detectRange,
    spotRange,
  );
}

export function structureVisionRadius(game, structure) {
  if (!structure || structure.built === false || finite(structure.hp) <= 0) return 0;
  const config = game?.config?.fog?.structureVision || {};
  if (structure.type === 'wall' || structure.type === 'bunker') return 0;
  if (isTower(structure)) {
    const stats = getEffectiveTowerStats(game, structure);
    return Math.max(
      finite(config.towerMinimum, 265),
      finite(stats?.range) + finite(config.towerRangePadding, 55),
    );
  }
  if (structure.type === 'landingpad') return finite(config.landingPad, 330);
  if (structure.type === 'refinery') return finite(config.refinery, 275);
  if (structure.type === 'mine' || structure.type === 'oremine') return finite(config.mine, 210);
  return finite(config.other, 225);
}

export function collectVisionSources(game) {
  const sources = [];
  const base = game?.state?.base;
  if (base) sources.push({ x: base.x, y: base.y, r: finite(game.config.fog.baseVision, 390), kind: 'base', id: 'base' });
  for (const unit of game?.state?.entities?.units || []) {
    if (!unit || finite(unit.hp) <= 0 || unit.transportedIn || unit.garrisonedIn) continue;
    sources.push({ x: unit.x, y: unit.y, r: unitVisionRadius(game, unit), kind: 'unit', id: unit.id ?? null });
  }
  for (const structure of game?.state?.entities?.structures || []) {
    const radius = structureVisionRadius(game, structure);
    if (radius <= 0) continue;
    sources.push({ x: structure.x, y: structure.y, r: radius, kind: 'structure', id: structure.id ?? null });
  }
  return sources;
}

function markExplored(game, sources) {
  const fog = ensureFogState(game);
  const { cellSize, cols, rows } = fog.grid;
  for (const source of sources) {
    const c0 = Math.max(0, Math.floor((source.x - source.r) / cellSize));
    const c1 = Math.min(cols - 1, Math.floor((source.x + source.r) / cellSize));
    const r0 = Math.max(0, Math.floor((source.y - source.r) / cellSize));
    const r1 = Math.min(rows - 1, Math.floor((source.y + source.r) / cellSize));
    const limit = source.r + cellSize * FOG_EXPLORE_CELL_PADDING;
    const limit2 = limit * limit;
    for (let gy = r0; gy <= r1; gy++) {
      for (let gx = c0; gx <= c1; gx++) {
        const cx = gx * cellSize + cellSize / 2;
        const cy = gy * cellSize + cellSize / 2;
        const dx = cx - source.x, dy = cy - source.y;
        if (dx * dx + dy * dy <= limit2) fog.explored[gy * cols + gx] = 1;
      }
    }
  }
}

export function refreshFog(game, { forceExplore = false, now = null } = {}) {
  const fog = ensureFogState(game);
  fog.visionSources = collectVisionSources(game);
  if (game?.state?.debug?.allVision) {
    fog.explored.fill(1);
    return fog;
  }
  const clock = now ?? (typeof game?.services?.now === 'function' ? game.services.now() : 0);
  const interval = Math.max(0, finite(game?.config?.fog?.explorationRefreshMs, 120));
  if (forceExplore || clock - fog.lastExploreMarkAt >= interval) {
    markExplored(game, fog.visionSources);
    fog.lastExploreMarkAt = clock;
  }
  return fog;
}

export function isPointVisible(game, x, y) {
  if (game?.state?.debug?.allVision) return true;
  const sources = ensureFogState(game).visionSources;
  for (const source of sources) {
    const dx = x - source.x, dy = y - source.y;
    if (dx * dx + dy * dy <= source.r * source.r) return true;
  }
  return false;
}

export function isPointExplored(game, x, y) {
  if (game?.state?.debug?.allVision) return true;
  const fog = ensureFogState(game);
  const { cellSize, cols, rows } = fog.grid;
  const gx = Math.floor(x / cellSize), gy = Math.floor(y / cellSize);
  if (gx < 0 || gy < 0 || gx >= cols || gy >= rows) return false;
  return Boolean(fog.explored[gy * cols + gx]);
}

export function fogCellOpacity(game, gx, gy) {
  if (game?.state?.debug?.allVision) return 0;
  const fog = ensureFogState(game);
  const { cols, rows, cellSize } = fog.grid;
  if (gx < 0 || gy < 0 || gx >= cols || gy >= rows) return FOG_UNEXPLORED_ALPHA;
  const cx = gx * cellSize + cellSize / 2, cy = gy * cellSize + cellSize / 2;
  if (isPointVisible(game, cx, cy)) return 0;
  return fog.explored[gy * cols + gx] ? FOG_EXPLORED_ALPHA : FOG_UNEXPLORED_ALPHA;
}

export function updateFog(game, dt) {
  void dt;
  return refreshFog(game);
}
