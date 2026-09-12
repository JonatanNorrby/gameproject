import { getBuildingConfig } from '../buildings/buildingConfig.js';
import { initializeBuildingRuntime } from '../buildings/buildingRuntime.js';
import { getDepotStock, initializeResourceDepotRuntime } from './depots.js';
import { RESOURCE_TYPES, transferResource } from './resources.js';

export function getMineResourceType(mine) {
  return mine?.type === 'oremine' ? RESOURCE_TYPES.ORE : RESOURCE_TYPES.CRYSTAL;
}

export function getMineStorageCapacity(game, mine) {
  const base = Number(getBuildingConfig(mine.type).storageCapacity) || 0;
  const modifier = Number(game?.state?.modifiers?.mineStorage);
  return base * (Number.isFinite(modifier) ? modifier : 1);
}

export function updateResourceMines(game, dt) {
  const step = Math.max(0, Number(dt) || 0);
  let extracted = 0;
  for (const mine of game?.state?.entities?.structures || []) {
    if ((mine.type !== 'mine' && mine.type !== 'oremine') || !mine.built || Number(mine.hp) <= 0) continue;
    initializeBuildingRuntime(game, mine);
    const depot = (game.state.entities.depots || []).find(item => item.id === mine.depotId);
    if (!depot) continue;
    initializeResourceDepotRuntime(game, depot);
    if (getDepotStock(game, depot) <= 0) continue;
    const definition = getBuildingConfig(mine.type);
    const modifier = Number(game?.state?.modifiers?.mineRate);
    const rate = Number(definition.productionRate) * (Number.isFinite(modifier) ? modifier : 1);
    const type = getMineResourceType(mine);
    extracted += transferResource({
      from: depot.resourceStore,
      to: mine.resourceStore,
      type,
      amount: rate * step,
      toCapacity: getMineStorageCapacity(game, mine),
    });
  }
  return extracted;
}
