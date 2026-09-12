import { getEntityRadius, getUnitRadius } from '../core/entities.js';
import { pointSegmentDistance } from '../utils/geometry.js';

function worldEntities(game) {
  return game?.state?.entities || {};
}

function worldDimensions(game) {
  return {
    width: Number(game?.config?.world?.width) || 0,
    height: Number(game?.config?.world?.height) || 0,
  };
}

function unitRadius(unitOrRadius) {
  if (typeof unitOrRadius === 'number') return Math.max(4, Number(unitOrRadius) || 18);
  try { return Math.max(4, Number(getUnitRadius(unitOrRadius)) || 18); }
  catch { return 18; }
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

function polygonDistance(x, y, points) {
  if (pointInPolygon(x, y, points)) return 0;
  let best = Infinity;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    best = Math.min(best, pointSegmentDistance(x, y, a.x, a.y, b.x, b.y));
  }
  return best;
}

function terrainBlocksUnit(game, x, y, radius) {
  for (const terrain of worldEntities(game).terrain || []) {
    // Current v48 behavior: forests and hills are traversable; lakes block.
    // Old terrain records without a kind remain blocking for compatibility.
    if (terrain?.kind && terrain.kind !== 'lake') continue;
    if (Array.isArray(terrain?.points)) {
      if (polygonDistance(x, y, terrain.points) <= radius + 2) return true;
    } else if (Number.isFinite(terrain?.x) && Number.isFinite(terrain?.r)) {
      if (Math.hypot(x - terrain.x, y - terrain.y) < terrain.r + radius + 2) return true;
    }
  }
  return false;
}

function structureRadius(structure) {
  try { return Number(getEntityRadius(structure)) || 28; }
  catch { return Number(structure?.collisionRadius) || Number(structure?.radius) || 28; }
}

function wallThickness(game, wall) {
  return Number(wall?.thickness)
    || Number(game?.config?.buildings?.wall?.wall?.thickness)
    || 12;
}

export function isNavigationPointBlocked(game, x, y, radius) {
  const r = Math.max(4, Number(radius) || 18);
  const { width, height } = worldDimensions(game);
  const base = game?.state?.base;
  if (x < r + 5 || y < r + 5 || x > width - r - 5 || y > height - r - 5) return true;
  if (base && Math.hypot(x - base.x, y - base.y) < base.radius + r + 4) return true;
  if (terrainBlocksUnit(game, x, y, r)) return true;

  for (const depot of worldEntities(game).depots || []) {
    if (!Number.isFinite(depot?.x) || !Number.isFinite(depot?.y)) continue;
    if (Math.hypot(x - depot.x, y - depot.y) < (Number(depot.r) || 34) + r + 2) return true;
  }

  for (const structure of worldEntities(game).structures || []) {
    if (!structure || structure.hp <= 0 || structure.type === 'safespot' || structure.type === 'bunker') continue;
    if (structure.type === 'wall'
      && Number.isFinite(structure.x1) && Number.isFinite(structure.y1)
      && Number.isFinite(structure.x2) && Number.isFinite(structure.y2)) {
      const thickness = wallThickness(game, structure);
      if (pointSegmentDistance(x, y, structure.x1, structure.y1, structure.x2, structure.y2) < thickness / 2 + r + 3) return true;
    } else if (Number.isFinite(structure.x) && Number.isFinite(structure.y)) {
      if (Math.hypot(x - structure.x, y - structure.y) < structureRadius(structure) + r + 3) return true;
    }
  }

  return false;
}

export function isNavigationSegmentOpen(game, ax, ay, bx, by, radius) {
  const cellSize = Math.max(36, Math.min(48, Number(game?.config?.pathfinding?.cellSize) || 48));
  const distance = Math.hypot(bx - ax, by - ay);
  if (distance < 1) return !isNavigationPointBlocked(game, bx, by, radius);
  const step = Math.max(12, cellSize * 0.42);
  const samples = Math.max(1, Math.ceil(distance / step));
  for (let i = 1; i <= samples; i++) {
    const t = i / samples;
    const x = ax + (bx - ax) * t;
    const y = ay + (by - ay) * t;
    if (isNavigationPointBlocked(game, x, y, radius)) return false;
  }
  return true;
}

class MinHeap {
  constructor() { this.a = []; }
  push(node) {
    const a = this.a;
    a.push(node);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].f <= node.f) break;
      a[i] = a[p];
      i = p;
    }
    a[i] = node;
  }
  pop() {
    const a = this.a;
    if (!a.length) return null;
    const root = a[0], last = a.pop();
    if (a.length) {
      let i = 0;
      while (true) {
        const left = i * 2 + 1, right = left + 1;
        if (left >= a.length) break;
        const child = right < a.length && a[right].f < a[left].f ? right : left;
        if (a[child].f >= last.f) break;
        a[i] = a[child];
        i = child;
      }
      a[i] = last;
    }
    return root;
  }
  get length() { return this.a.length; }
}

function createGrid(game) {
  const { width, height } = worldDimensions(game);
  const cell = Math.max(36, Math.min(48, Number(game?.config?.pathfinding?.cellSize) || 48));
  const cols = Math.ceil(width / cell), rows = Math.ceil(height / cell);
  const maxVisited = Math.max(cols * rows + 32, Number(game?.config?.pathfinding?.maxVisited) || 50000);
  const index = (x, y) => y * cols + x;
  const centerX = x => Math.min(width - 6, x * cell + cell / 2);
  const centerY = y => Math.min(height - 6, y * cell + cell / 2);
  const cellForPoint = (x, y) => ({
    x: Math.max(0, Math.min(cols - 1, Math.floor(x / cell))),
    y: Math.max(0, Math.min(rows - 1, Math.floor(y / cell))),
  });
  return { cell, cols, rows, maxVisited, index, centerX, centerY, cellForPoint };
}

function nearestOpenGoal(game, grid, goalX, goalY, radius) {
  const goal = grid.cellForPoint(goalX, goalY);
  let best = null, bestDistance = Infinity;
  for (let ring = 0; ring <= 7; ring++) {
    for (let oy = -ring; oy <= ring; oy++) {
      for (let ox = -ring; ox <= ring; ox++) {
        if (ring && Math.max(Math.abs(ox), Math.abs(oy)) !== ring) continue;
        const x = goal.x + ox, y = goal.y + oy;
        if (x < 0 || y < 0 || x >= grid.cols || y >= grid.rows) continue;
        const worldX = grid.centerX(x), worldY = grid.centerY(y);
        if (isNavigationPointBlocked(game, worldX, worldY, radius)) continue;
        const distance = (worldX - goalX) ** 2 + (worldY - goalY) ** 2;
        if (distance < bestDistance) {
          bestDistance = distance;
          best = { x, y };
        }
      }
    }
    if (best) return best;
  }
  return null;
}

function smoothPath(game, startX, startY, path, radius) {
  if (path.length < 2) return path;
  const out = [];
  let ax = startX, ay = startY, i = 0;
  while (i < path.length) {
    let best = i;
    for (let j = path.length - 1; j >= i; j--) {
      const point = path[j];
      if (isNavigationSegmentOpen(game, ax, ay, point.x, point.y, radius)) {
        best = j;
        break;
      }
    }
    const point = path[best];
    out.push(point);
    ax = point.x;
    ay = point.y;
    i = best + 1;
  }
  return out;
}

export function findNearestOpenDestination(game, x, y, unitOrRadius) {
  const radius = unitRadius(unitOrRadius);
  if (!isNavigationPointBlocked(game, x, y, radius)) return { x, y };
  for (const distance of [18, 30, 44, 60, 80, 105]) {
    for (let i = 0; i < 24; i++) {
      const angle = i / 24 * Math.PI * 2;
      const nx = x + Math.cos(angle) * distance;
      const ny = y + Math.sin(angle) * distance;
      const { width, height } = worldDimensions(game);
      if (nx < radius + 5 || ny < radius + 5 || nx > width - radius - 5 || ny > height - radius - 5) continue;
      if (!isNavigationPointBlocked(game, nx, ny, radius)) return { x: nx, y: ny };
    }
  }
  return null;
}

export function findPath(game, start, destination, unitOrRadius) {
  const startX = Number(start?.x), startY = Number(start?.y);
  const goalX = Number(destination?.x), goalY = Number(destination?.y);
  if (![startX, startY, goalX, goalY].every(Number.isFinite)) return [];

  const radius = unitRadius(unitOrRadius);
  if (!isNavigationPointBlocked(game, goalX, goalY, radius)
    && isNavigationSegmentOpen(game, startX, startY, goalX, goalY, radius)) {
    return [{ x: goalX, y: goalY }];
  }

  const grid = createGrid(game);
  const startCell = grid.cellForPoint(startX, startY);
  const goalCell = nearestOpenGoal(game, grid, goalX, goalY, radius);
  if (!goalCell) return [];

  const total = grid.cols * grid.rows;
  const startIndex = grid.index(startCell.x, startCell.y);
  const goalIndex = grid.index(goalCell.x, goalCell.y);
  const gScore = new Float64Array(total);
  gScore.fill(Infinity);
  gScore[startIndex] = 0;
  const came = new Int32Array(total);
  came.fill(-1);
  const closed = new Uint8Array(total);
  const heap = new MinHeap();
  heap.push({
    i: startIndex,
    x: startCell.x,
    y: startCell.y,
    g: 0,
    f: Math.hypot(goalCell.x - startCell.x, goalCell.y - startCell.y),
  });

  const directions = [
    [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
    [1, 1, 1.41421356237], [1, -1, 1.41421356237],
    [-1, 1, 1.41421356237], [-1, -1, 1.41421356237],
  ];
  let visited = 0, found = -1;

  while (heap.length && visited++ < grid.maxVisited) {
    const current = heap.pop();
    if (!current || closed[current.i]) continue;
    closed[current.i] = 1;
    if (current.i === goalIndex) {
      found = current.i;
      break;
    }

    for (const [dx, dy, cost] of directions) {
      const nx = current.x + dx, ny = current.y + dy;
      if (nx < 0 || ny < 0 || nx >= grid.cols || ny >= grid.rows) continue;
      const nextIndex = grid.index(nx, ny);
      if (closed[nextIndex]) continue;
      const worldX = grid.centerX(nx), worldY = grid.centerY(ny);
      if (nextIndex !== goalIndex && isNavigationPointBlocked(game, worldX, worldY, radius)) continue;

      if (dx && dy) {
        const ax = grid.centerX(current.x + dx), ay = grid.centerY(current.y);
        const bx = grid.centerX(current.x), by = grid.centerY(current.y + dy);
        if (isNavigationPointBlocked(game, ax, ay, radius)
          || isNavigationPointBlocked(game, bx, by, radius)) continue;
      }

      const nextG = current.g + cost;
      if (nextG >= gScore[nextIndex]) continue;
      gScore[nextIndex] = nextG;
      came[nextIndex] = current.i;
      heap.push({
        i: nextIndex,
        x: nx,
        y: ny,
        g: nextG,
        f: nextG + Math.hypot(goalCell.x - nx, goalCell.y - ny),
      });
    }
  }

  if (found < 0) return [];

  const reversed = [];
  let current = found;
  while (current !== startIndex && current >= 0) {
    const x = current % grid.cols, y = (current / grid.cols) | 0;
    reversed.push({ x: grid.centerX(x), y: grid.centerY(y) });
    current = came[current];
  }
  reversed.reverse();

  const previous = reversed.length ? reversed[reversed.length - 1] : { x: startX, y: startY };
  if (!isNavigationPointBlocked(game, goalX, goalY, radius)
    && isNavigationSegmentOpen(game, previous.x, previous.y, goalX, goalY, radius)) {
    reversed.push({ x: goalX, y: goalY });
  }

  return smoothPath(game, startX, startY, reversed, radius);
}
