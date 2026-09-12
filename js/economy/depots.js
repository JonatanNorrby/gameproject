import { ECONOMY_CONFIG } from './economyConfig.js';
import { createResourceStore, getStoredResource, RESOURCE_TYPES, spendResources } from './resources.js';
import { createBuildingRuntime } from '../buildings/buildingRuntime.js';

const MINE_SLOT_OFFSETS = Object.freeze([[0, -12], [-15, 10], [15, 10]]);

function depotConfig(type) {
  if (type === RESOURCE_TYPES.CRYSTAL) return ECONOMY_CONFIG.crystal;
  if (type === RESOURCE_TYPES.ORE) return ECONOMY_CONFIG.ore;
  throw new Error(`Unsupported depot resource: ${type}`);
}

export function depotStockForPosition(game, type, x, y) {
  const config = depotConfig(type);
  const base = game?.state?.base;
  if (!base) throw new TypeError('Game base state is required');
  const distance = Math.hypot(Number(x) - base.x, Number(y) - base.y);
  return Math.round(config.nearStock + distance * config.stockPerPixel);
}

export function initializeResourceDepotRuntime(game, depot) {
  if (!depot?.resourceType) throw new TypeError('Resource depot type is required');
  const config = depotConfig(depot.resourceType);
  depot.r = Number(depot.r) || config.depotRadius;
  const amount = Number.isFinite(Number(depot.stock)) ? Math.max(0, Number(depot.stock)) : depotStockForPosition(game, depot.resourceType, depot.x, depot.y);
  depot.resourceStore ||= createResourceStore(depot.resourceType, amount, { lockedType: true });
  const stockDescriptor = Object.getOwnPropertyDescriptor(depot, 'stock');
  if (!(stockDescriptor?.get && stockDescriptor?.set)) Object.defineProperty(depot, 'stock', { configurable: true, enumerable: true, get: () => depot.resourceStore.amount, set: value => { depot.resourceStore.amount = Math.max(0, Number(value) || 0); } });
  depot.mineIds = Array.isArray(depot.mineIds) ? depot.mineIds : [];
  depot.mineId = depot.mineIds[0] || depot.mineId || null;
  return depot;
}

export function createResourceDepot(game, type, { id = null, x, y, stock = null } = {}) {
  const config = depotConfig(type);
  const amount = stock === null ? depotStockForPosition(game, type, x, y) : Math.max(0, Number(stock) || 0);
  const depot = {
    id: id || `${type[0]}-${Math.random().toString(36).slice(2)}`,
    resourceType: type,
    x: Number(x) || 0,
    y: Number(y) || 0,
    r: config.depotRadius,
    stock: amount,
    mineId: null,
    mineIds: [],
  };
  initializeResourceDepotRuntime(game, depot);
  return depot;
}

export function getDepotStock(game, depot) {
  initializeResourceDepotRuntime(game, depot);
  return getStoredResource(depot.resourceStore, depot.resourceType);
}

export function getDepotMines(game, depot) {
  if (!depot) return [];
  return (game?.state?.entities?.structures || []).filter(structure => (
    (structure.type === 'mine' || structure.type === 'oremine')
    && structure.depotId === depot.id
    && Number(structure.hp) > 0
  ));
}

export function maxMinesForDepot(depot) {
  return depot?.resourceType === RESOURCE_TYPES.ORE
    ? ECONOMY_CONFIG.ore.maxMinesPerDepot
    : ECONOMY_CONFIG.crystal.maxMinesPerDepot;
}

export function canAttachResourceMine(game, depot) {
  return Boolean(depot && getDepotMines(game, depot).length < maxMinesForDepot(depot));
}

export function canAttachCrystalMine(game, depot) {
  return depot?.resourceType === RESOURCE_TYPES.CRYSTAL && canAttachResourceMine(game, depot);
}

export function mineSlotPosition(depot, slot) {
  const offset = MINE_SLOT_OFFSETS[slot] || [0, 0];
  return { x: depot.x + offset[0], y: depot.y + offset[1] };
}

export function normalizeDepotMineLinks(game, depot = null) {
  const depots = depot ? [depot] : (game?.state?.entities?.depots || []);
  for (const item of depots) {
    const mines = getDepotMines(game, item);
    item.mineIds = mines.map(mine => mine.id);
    item.mineId = item.mineIds[0] || null;
  }
}

export function createMineForDepot(game, mineType, depot, { id = null, built = false, spendCost = false } = {}) {
  const resource = mineType === 'mine' ? RESOURCE_TYPES.CRYSTAL : mineType === 'oremine' ? RESOURCE_TYPES.ORE : null;
  if (!resource || !depot || depot.resourceType !== resource) return { ok: false, reason: 'wrong-depot-type' };
  if (!canAttachResourceMine(game, depot)) return { ok: false, reason: 'depot-mine-limit' };
  const slot = getDepotMines(game, depot).length;
  const point = mineSlotPosition(depot, slot);
  const result = createBuildingRuntime(game, mineType, { id, x: point.x, y: point.y, built, depotId: depot.id, mineSlot: slot });
  if (!result.ok) return result;
  if (spendCost) {
    const cost = mineType === 'mine' ? { metal: ECONOMY_CONFIG.crystal.mineCost } : { gold: ECONOMY_CONFIG.ore.mineCost };
    if (!spendResources(game, cost)) return { ok: false, reason: 'cannot-afford' };
  }
  game.state.entities.structures.push(result.building);
  normalizeDepotMineLinks(game, depot);
  return { ok: true, building: result.building, slot };
}
