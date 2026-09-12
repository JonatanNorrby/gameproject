import { getUnitConfig } from '../units/unitConfig.js';
import { issueMove, MOVE_COMMAND_SOURCES } from '../units/commands.js';
import { removeUnitFromPlatoon } from '../units/platoons.js';
import { getStorageCapacity, initializeBuildingRuntime } from '../buildings/buildingRuntime.js';
import { getBuildingConfig } from '../buildings/buildingConfig.js';
import { getDepotStock, initializeResourceDepotRuntime } from './depots.js';
import { getMineResourceType } from './mining.js';
import { createResourceStore, getStoredResource, RESOURCE_TYPES, transferResource } from './resources.js';

const EPSILON = 0.001;

export function getTruckCapacity(game, truck) {
  const base = Number(getUnitConfig('truck').logistics.capacity) || 45;
  const modifier = Number(game?.state?.modifiers?.truckCapacity);
  return Math.round(base * (Number.isFinite(modifier) ? modifier : 1));
}

export function ensureTruckLogistics(game, truck) {
  if (!truck || truck.type !== 'truck') return null;
  if (!truck.cargoStore) {
    const amount = typeof truck.cargo === 'number' ? Math.max(0, truck.cargo) : 0;
    const type = truck.cargoType === RESOURCE_TYPES.CRYSTAL || truck.cargoType === RESOURCE_TYPES.ORE ? truck.cargoType : null;
    truck.cargoStore = createResourceStore(type, amount, { lockedType: false });
    Object.defineProperty(truck, 'cargo', { configurable: true, enumerable: true, get: () => truck.cargoStore.amount, set: value => { truck.cargoStore.amount = Math.max(0, Number(value) || 0); if (truck.cargoStore.amount <= 0) truck.cargoStore.type = null; } });
    Object.defineProperty(truck, 'cargoType', { configurable: true, enumerable: true, get: () => truck.cargoStore.type, set: value => { truck.cargoStore.type = value === RESOURCE_TYPES.CRYSTAL || value === RESOURCE_TYPES.ORE ? value : null; } });
  }
  truck.cargoCapacity = getTruckCapacity(game, truck);
  truck.route = Array.isArray(truck.route) ? truck.route : [];
  truck.routeIndex = Number.isFinite(Number(truck.routeIndex)) ? Number(truck.routeIndex) : 0;
  truck.routeLoop = Boolean(truck.routeLoop);
  truck.routeActive = Boolean(truck.routeActive);
  truck.routeWaiting = Boolean(truck.routeWaiting);
  truck.routePendingStart = Boolean(truck.routePendingStart);
  truck.routeServiceLabel = truck.routeServiceLabel || '';
  truck.routeInTransit = Boolean(truck.routeInTransit);
  return truck;
}

export function getTruckCargo(game, truck) {
  ensureTruckLogistics(game, truck);
  return { type: truck.cargoStore.type, amount: truck.cargoStore.amount, capacity: getTruckCapacity(game, truck) };
}

export function loadTruckAtMine(game, truck, mine) {
  ensureTruckLogistics(game, truck);
  if (!mine || !mine.built || (mine.type !== 'mine' && mine.type !== 'oremine')) return true;
  initializeBuildingRuntime(game, mine);
  const type = getMineResourceType(mine);
  if (truck.cargoStore.type && truck.cargoStore.type !== type) return true;
  const capacity = getTruckCapacity(game, truck);
  transferResource({ from: mine.resourceStore, to: truck.cargoStore, type, amount: Infinity, toCapacity: capacity });
  const depot = (game.state.entities.depots || []).find(item => item.id === mine.depotId);
  if (depot) initializeResourceDepotRuntime(game, depot);
  const depleted = (!depot || getDepotStock(game, depot) <= EPSILON) && getStoredResource(mine.resourceStore, type) <= EPSILON;
  truck.routeServiceLabel = `LOADING ${Math.floor(getStoredResource(truck.cargoStore, type))}/${capacity}`;
  return getStoredResource(truck.cargoStore, type) >= capacity - EPSILON || depleted;
}

export function unloadTruckAtRefinery(game, truck, refinery) {
  ensureTruckLogistics(game, truck); initializeBuildingRuntime(game, refinery);
  if (truck.cargoStore.amount <= EPSILON) { truck.cargoStore.amount = 0; truck.cargoStore.type = null; return true; }
  if (truck.cargoStore.type !== RESOURCE_TYPES.ORE) return true;
  transferResource({ from: truck.cargoStore, to: refinery.resourceStore, type: RESOURCE_TYPES.ORE, amount: Infinity, toCapacity: getStorageCapacity(refinery) });
  if (truck.cargoStore.amount <= EPSILON) { truck.cargoStore.amount = 0; truck.cargoStore.type = null; return true; }
  truck.routeServiceLabel = `UNLOADING ORE ${Math.floor(truck.cargoStore.amount)} LEFT`;
  return false;
}

export function unloadTruckAtLandingPad(game, truck, pad) {
  ensureTruckLogistics(game, truck); initializeBuildingRuntime(game, pad);
  if (truck.cargoStore.amount <= EPSILON) { truck.cargoStore.amount = 0; truck.cargoStore.type = null; return true; }
  if (truck.cargoStore.type !== RESOURCE_TYPES.CRYSTAL) return true;
  transferResource({ from: truck.cargoStore, to: pad.resourceStore, type: RESOURCE_TYPES.CRYSTAL, amount: Infinity, toCapacity: getStorageCapacity(pad) });
  if (truck.cargoStore.amount <= EPSILON) { truck.cargoStore.amount = 0; truck.cargoStore.type = null; return true; }
  truck.routeServiceLabel = `UNLOADING CRYSTAL ${Math.floor(truck.cargoStore.amount)} LEFT`;
  return false;
}

export function serviceTruckAtBuilding(game, truck, building) {
  if (!building) return true;
  if (building.type === 'mine' || building.type === 'oremine') return loadTruckAtMine(game, truck, building);
  if (building.type === 'refinery') return unloadTruckAtRefinery(game, truck, building);
  if (building.type === 'landingpad') return unloadTruckAtLandingPad(game, truck, building);
  return true;
}

export function routeStopPoint(game, truck, index = truck.routeIndex) {
  const stop = truck.route?.[index];
  if (!stop) return null;
  if (stop.buildingId) {
    const building = (game.state.entities.structures || []).find(item => item.id === stop.buildingId && item.built);
    if (building) return { x: building.x, y: building.y, buildingId: building.id };
  }
  return { x: stop.x, y: stop.y, buildingId: stop.buildingId || null };
}

function logisticsMove(game, truck, point) {
  const external = game?.services?.logistics?.issueMove;
  const result = typeof external === 'function'
    ? external(game, truck, point.x, point.y, { source: MOVE_COMMAND_SOURCES.LOGISTICS })
    : issueMove(game, truck, point.x, point.y, { source: MOVE_COMMAND_SOURCES.LOGISTICS });
  return typeof result === 'boolean' ? result : Boolean(result?.ok);
}

export function sendTruckToRouteIndex(game, truck, index) {
  ensureTruckLogistics(game, truck);
  if (!truck.route.length) return false;
  truck.routeIndex = ((index % truck.route.length) + truck.route.length) % truck.route.length;
  truck.routeWaiting = false;
  truck.routeServiceLabel = '';
  const point = routeStopPoint(game, truck, truck.routeIndex);
  if (!point) return false;
  const ok = logisticsMove(game, truck, point);
  truck.routeInTransit = ok;
  return ok;
}

export function startTruckRoute(game, truck) {
  ensureTruckLogistics(game, truck);
  if (truck.route.length < 2) return false;
  removeUnitFromPlatoon(game, truck);
  truck.routeLoop = true;
  truck.routeActive = true;
  truck.routePendingStart = false;
  truck.routeWaiting = false;
  truck.routeIndex = 0;
  return sendTruckToRouteIndex(game, truck, 0);
}

export function beginTruckRouteRecording(game, truck) {
  ensureTruckLogistics(game, truck);
  removeUnitFromPlatoon(game, truck);
  truck.route = [];
  truck.routeLoop = false;
  truck.routeActive = false;
  truck.routeWaiting = false;
  truck.routePendingStart = false;
  truck.routeInTransit = false;
  truck.routeServiceLabel = '';
  truck.path = [];
  truck.moveTarget = null;
  return true;
}

export function addTruckRouteStop(game, truck, { x, y, buildingId = null } = {}) {
  ensureTruckLogistics(game, truck);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  truck.route.push({ x, y, buildingId });
  return true;
}

export function finishTruckRouteRecording(game, truck) {
  ensureTruckLogistics(game, truck);
  return truck.route.length >= 2 && startTruckRoute(game, truck);
}

export function markTruckRouteArrived(game, truck) {
  ensureTruckLogistics(game, truck);
  truck.routeInTransit = false;
  if (!truck.routeLoop || truck.route.length < 2) {
    truck.routeActive = false;
    truck.routeWaiting = false;
    return false;
  }
  truck.routeWaiting = true;
  truck.path = [];
  truck.moveTarget = null;
  return true;
}

export function finishTruckRouteStop(game, truck) {
  ensureTruckLogistics(game, truck);
  if (!truck.routeActive || !truck.routeLoop || truck.route.length < 2) return false;
  truck.routeWaiting = false;
  truck.routeServiceLabel = '';
  return sendTruckToRouteIndex(game, truck, (truck.routeIndex + 1) % truck.route.length);
}

function serviceRange(building) {
  if (building.type === 'landingpad') return Number(getBuildingConfig('landingpad').truckUnloadRange) || 120;
  if (building.type === 'refinery') return Number(getBuildingConfig('refinery').unloadRange) || 105;
  return Number(getUnitConfig('truck').logistics.pickupRange) || 100;
}

export function nearestManualService(game, truck) {
  let best = null, bestDistance = Infinity;
  for (const building of game?.state?.entities?.structures || []) {
    if (!building.built || !['mine', 'oremine', 'refinery', 'landingpad'].includes(building.type)) continue;
    const range = serviceRange(building);
    const distance = Math.hypot(truck.x - building.x, truck.y - building.y);
    if (distance <= range && distance < bestDistance) { best = building; bestDistance = distance; }
  }
  return best;
}

export function updateTruckLogistics(game) {
  let serviced = 0;
  for (const truck of game?.state?.entities?.units || []) {
    if (truck.type !== 'truck' || Number(truck.hp) <= 0) continue;
    ensureTruckLogistics(game, truck);
    if (truck.routeActive && truck.routeInTransit && (!truck.path || !truck.path.length) && !truck.moveTarget) markTruckRouteArrived(game, truck);
    if (truck.routeActive && truck.routeWaiting) {
      const stop = truck.route?.[truck.routeIndex];
      const building = stop?.buildingId ? (game.state.entities.structures || []).find(item => item.id === stop.buildingId && item.built) : null;
      if (!stop?.buildingId || !building || serviceTruckAtBuilding(game, truck, building)) finishTruckRouteStop(game, truck);
      serviced++;
      continue;
    }
    if (truck.path?.length || truck.routeActive) continue;
    const building = nearestManualService(game, truck);
    if (building) { serviceTruckAtBuilding(game, truck, building); serviced++; }
  }
  return serviced;
}
