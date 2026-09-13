import { getUnitRole } from '../core/entities.js';
import { getUnitConfig } from '../units/unitConfig.js';

export function activeConstructionGroups(game) {
  const groups = new Map();
  for (const structure of game?.state?.entities?.structures || []) {
    if (!structure || structure.built !== false || Number(structure.hp) <= 0) continue;
    const key = structure.groupId || structure.id;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(structure);
  }
  return groups;
}

export function updateConstruction(game, dt) {
  const step = Math.max(0, Number(dt) || 0);
  if (step <= 0) return { groups: 0, completedGroups: 0, completedStructures: 0 };
  const groups = activeConstructionGroups(game);
  if (!groups.size) return { groups: 0, completedGroups: 0, completedStructures: 0 };
  const engineerConfig = getUnitConfig('engineer');
  const engineers = (game.state.entities.units || []).filter(unit => getUnitRole(unit) === 'engineer' && Number(unit.hp) > 0 && !unit.garrisonedIn && !unit.transportedIn);
  let completedGroups = 0, completedStructures = 0;
  for (const items of groups.values()) {
    let count = 0;
    for (const engineer of engineers) {
      if (items.some(item => Math.hypot(engineer.x - item.x, engineer.y - item.y) <= engineerConfig.repair.range)) {
        count++;
        if (count >= 2) break;
      }
    }
    const bonus = step * Number(engineerConfig.constructionBonus || 0) * count;
    const remaining = Math.max(0, (Number(items[0].buildRemaining) || Number(items[0].buildTime) || 0) - step - bonus);
    for (const item of items) item.buildRemaining = remaining;
    if (remaining > 0) continue;
    completedGroups++;
    completedStructures += items.length;
    for (const item of items) item.built = true;
    const callback = game?.services?.buildings?.onConstructionComplete;
    if (typeof callback === 'function') callback(game, items[0], { group: items });
  }
  return { groups: groups.size, completedGroups, completedStructures };
}
