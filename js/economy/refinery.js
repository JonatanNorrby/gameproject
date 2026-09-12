import { initializeBuildingRuntime } from '../buildings/buildingRuntime.js';
import { getBuildingConfig } from '../buildings/buildingConfig.js';
import { addResource, getStoredResource, removeStoredResource, RESOURCE_TYPES } from './resources.js';

export function updateRefineries(game, dt) {
  const step = Math.max(0, Number(dt) || 0);
  let oreProcessed = 0;
  let metalProduced = 0;
  for (const refinery of game?.state?.entities?.structures || []) {
    if (refinery.type !== 'refinery' || !refinery.built || Number(refinery.hp) <= 0) continue;
    initializeBuildingRuntime(game, refinery);
    const stored = getStoredResource(refinery.resourceStore, RESOURCE_TYPES.ORE);
    if (stored <= 0) continue;
    const config = getBuildingConfig('refinery');
    const amount = Math.min(stored, Number(config.refineRate) * step);
    const consumed = removeStoredResource(refinery.resourceStore, RESOURCE_TYPES.ORE, amount);
    if (consumed <= 0) continue;
    const metal = consumed * Number(config.metalPerOre);
    addResource(game, RESOURCE_TYPES.METAL, metal);
    oreProcessed += consumed;
    metalProduced += metal;
  }
  return { oreProcessed, metalProduced };
}
