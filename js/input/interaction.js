import { getEntityRadius, getUnitRole, isTower } from '../core/entities.js';
import { spendResources } from '../economy/resources.js';
import { getEffectiveTowerStats } from '../combat/towerStats.js';
import { getStorageCapacity, getStorageLevel, getStorageUpgradeCost, upgradeBuildingStorage } from '../buildings/buildingRuntime.js';
import { placeStructure, placeWallPath, placementDefinition, validateWallPath } from '../buildings/placement.js';
import { issueManualMove } from '../units/commands.js';
import { deployUnitFromBase } from '../units/deployment.js';
import { addTruckRouteStop, beginTruckRouteRecording, ensureTruckLogistics, finishTruckRouteRecording } from '../economy/truckLogistics.js';
import { createOrMergePlatoon, disbandPlatoon, removeUnitFromPlatoon } from '../units/platoons.js';
import { attachApcSupport, attachMedicFollow, detachApcSupport, detachMedicFollow } from '../units/support.js';
import { loadApc, unloadApc } from '../units/transport.js';
import { getUnitConfig, normalizeUnitType } from '../units/unitConfig.js';

const STORAGE_TYPES = new Set(['refinery', 'landingpad']);
const SERVICE_TYPES = new Set(['mine', 'oremine', 'refinery', 'landingpad']);

export function setMessage(game, message) {
  if (game?.state?.ui) game.state.ui.message = String(message ?? '');
  const callback = game?.services?.ui?.onMessage;
  if (typeof callback === 'function') callback(game, game.state.ui.message);
  return game.state.ui.message;
}

export function selectedUnit(game) {
  const id = game?.state?.selection?.unitId;
  return id ? (game.state.entities.units || []).find(unit => unit.id === id && Number(unit.hp) > 0) || null : null;
}

export function selectedTower(game) {
  const id = game?.state?.selection?.towerId;
  return id ? (game.state.entities.structures || []).find(structure => structure.id === id && Number(structure.hp) > 0 && isTower(structure)) || null : null;
}

export function selectedStorage(game) {
  const id = game?.state?.selection?.storageBuildingId;
  return id ? (game.state.entities.structures || []).find(structure => structure.id === id && Number(structure.hp) > 0 && STORAGE_TYPES.has(structure.type)) || null : null;
}

function clearModes(game) {
  const commands = game.state.commands;
  commands.routeEditing = false;
  commands.attachMode = false;
  commands.platoonAttachMode = false;
  commands.medicFollowAttachMode = false;
  commands.apcSupportAttachMode = false;
}

export function clearSelection(game, { message = null } = {}) {
  game.state.selection.unitId = null;
  game.state.selection.towerId = null;
  game.state.selection.storageBuildingId = null;
  clearModes(game);
  if (message) setMessage(game, message);
}

export function selectUnit(game, unit) {
  if (!unit || Number(unit.hp) <= 0 || unit.transportedIn || unit.garrisonedIn) return false;
  game.state.selection.unitId = unit.id;
  game.state.selection.towerId = null;
  game.state.selection.storageBuildingId = null;
  game.state.commands.buildType = null;
  game.state.commands.wall.path = [];
  game.state.commands.wall.reviewOpen = false;
  clearModes(game);
  setMessage(game, `${getUnitConfig(getUnitRole(unit)).displayName} selected.`);
  return true;
}

export function selectTower(game, tower) {
  if (!tower?.built || !isTower(tower) || Number(tower.hp) <= 0) return false;
  clearSelection(game);
  game.state.selection.towerId = tower.id;
  game.state.commands.buildType = null;
  tower.level = Math.max(1, Math.min(3, Number(tower.level) || 1));
  setMessage(game, `${getEffectiveTowerStats(tower).type} tower selected.`);
  return true;
}

export function selectStorage(game, structure) {
  if (!structure?.built || !STORAGE_TYPES.has(structure.type) || Number(structure.hp) <= 0) return false;
  clearSelection(game);
  game.state.selection.storageBuildingId = structure.id;
  game.state.commands.buildType = null;
  setMessage(game, `${structure.type === 'landingpad' ? 'Landing Pad' : 'Refinery'} selected.`);
  return true;
}

function hitUnit(game, x, y) {
  let best = null, bestDistance = Infinity;
  for (const unit of game.state.entities.units || []) {
    if (Number(unit.hp) <= 0 || unit.transportedIn || unit.garrisonedIn) continue;
    let radius = 24;
    try { radius = Number(getEntityRadius(unit)) || radius; } catch {}
    const distance = Math.hypot(x - unit.x, y - unit.y);
    if (distance <= radius + 8 && distance < bestDistance) { best = unit; bestDistance = distance; }
  }
  return best;
}

function hitStructure(game, x, y) {
  let best = null, bestDistance = Infinity;
  for (const structure of game.state.entities.structures || []) {
    if (!structure || Number(structure.hp) <= 0 || structure.type === 'wall') continue;
    let radius = 30;
    try { radius = Number(getEntityRadius(structure)) || radius; } catch {}
    const distance = Math.hypot(x - structure.x, y - structure.y);
    if (distance <= radius + 8 && distance < bestDistance) { best = structure; bestDistance = distance; }
  }
  return best;
}

export function chooseBuildType(game, rawType) {
  const role = normalizeUnitType(rawType);
  try {
    const unit = getUnitConfig(role);
    if (unit) {
      const result = deployUnitFromBase(game, role);
      if (result.ok) setMessage(game, `${unit.displayName} deployed from the Main Base.`);
      else setMessage(game, result.reason === 'max-active' ? `${unit.displayName} active limit reached.` : `Cannot afford ${unit.displayName}.`);
      return { ...result, mode: 'unit-deploy' };
    }
  } catch {}
  const definition = placementDefinition(rawType);
  if (!definition?.enabled) return { ok: false, reason: 'disabled-or-unknown' };
  clearSelection(game);
  game.state.commands.buildType = rawType;
  if (rawType !== 'wall') {
    game.state.commands.wall.path = [];
    game.state.commands.wall.reviewOpen = false;
  }
  setMessage(game, rawType === 'wall' ? 'Wall path: click bends or drag to paint. Review when ready.' : `Place ${rawType} on the battlefield.`);
  return { ok: true, mode: 'placement', type: rawType };
}

export function cancelBuildMode(game) {
  game.state.commands.buildType = null;
  game.state.commands.wall.painting = false;
  game.state.commands.wall.path = [];
  game.state.commands.wall.cursor = null;
  game.state.commands.wall.reviewOpen = false;
  setMessage(game, 'Placement cancelled.');
}

export function appendWallPoint(game, point, { force = false } = {}) {
  if (game.state.commands.buildType !== 'wall' || !point) return false;
  const wall = game.state.commands.wall;
  const spacing = game.config.buildings.wall.wall.paintPointSpacing;
  if (!wall.path.length) wall.path.push({ x: point.x, y: point.y });
  else {
    const last = wall.path.at(-1), distance = Math.hypot(point.x - last.x, point.y - last.y);
    if ((!force && distance < spacing) || (force && distance < 8)) return false;
    wall.path.push({ x: point.x, y: point.y });
  }
  wall.cursor = { x: point.x, y: point.y };
  return true;
}

export function reviewWallPath(game) {
  const result = validateWallPath(game, game.state.commands.wall.path);
  if (!result.ok) { setMessage(game, 'Wall path is not valid.'); return result; }
  game.state.commands.wall.path = result.points;
  game.state.commands.wall.reviewOpen = true;
  return result;
}

export function confirmWallPath(game) {
  const result = placeWallPath(game, game.state.commands.wall.path);
  game.state.commands.wall.reviewOpen = false;
  if (!result.ok) { setMessage(game, result.reason === 'cannot-afford' ? 'Not enough Metal for that wall.' : 'Wall path could not be built.'); return result; }
  game.state.commands.wall.path = [];
  game.state.commands.wall.painting = false;
  setMessage(game, `Wall path queued for ${result.cost} Metal.`);
  return result;
}

export function cancelWallReview(game) {
  game.state.commands.wall.reviewOpen = false;
  setMessage(game, 'Wall build not confirmed — path is still editable.');
}

export function beginOrFinishTruckRoute(game) {
  const unit = selectedUnit(game);
  if (!unit || unit.type !== 'truck') return { ok: false, reason: 'not-truck' };
  if (!game.state.commands.routeEditing) {
    beginTruckRouteRecording(game, unit);
    game.state.commands.routeEditing = true;
    setMessage(game, 'Route recording: tap points in order, then press FINISH ROUTE.');
    return { ok: true, recording: true };
  }
  const ok = finishTruckRouteRecording(game, unit);
  if (!ok) { setMessage(game, 'Route needs at least 2 points.'); return { ok: false, reason: 'route-too-short' }; }
  game.state.commands.routeEditing = false;
  game.state.selection.unitId = null;
  setMessage(game, 'Route saved and started.');
  return { ok: true, recording: false, started: true };
}

export function clearTruckRoute(game) {
  const unit = selectedUnit(game);
  if (!unit || unit.type !== 'truck') return false;
  ensureTruckLogistics(game, unit);
  unit.route = [];
  unit.routeIndex = 0;
  unit.routeLoop = false;
  unit.routeActive = false;
  unit.routeWaiting = false;
  unit.routePendingStart = false;
  unit.routeInTransit = false;
  unit.routeServiceLabel = '';
  unit.path = [];
  unit.moveTarget = null;
  game.state.commands.routeEditing = false;
  setMessage(game, 'Truck route cleared.');
  return true;
}

export function beginPlatoonAttach(game) {
  const unit = selectedUnit(game);
  if (!unit) return false;
  game.state.commands.platoonAttachMode = true;
  setMessage(game, 'Tap another eligible unit to create or merge a Platoon.');
  return true;
}

export function leavePlatoon(game) {
  const unit = selectedUnit(game);
  if (!unit) return false;
  const ok = removeUnitFromPlatoon(game, unit);
  if (ok) setMessage(game, 'Unit left Platoon.');
  return ok;
}

export function disbandSelectedPlatoon(game) {
  const unit = selectedUnit(game);
  if (!unit?.platoonId) return 0;
  const count = disbandPlatoon(game, unit);
  if (count) setMessage(game, 'Platoon disbanded.');
  return count;
}

export function beginTruckAttach(game) {
  const unit = selectedUnit(game);
  if (!unit || unit.type === 'truck') return false;
  game.state.commands.attachMode = true;
  setMessage(game, 'Tap a Logistics Truck to attach this unit.');
  return true;
}

export function detachFromTruck(game) {
  const unit = selectedUnit(game);
  if (!unit?.attachedTo) return false;
  unit.attachedTo = null;
  unit.attachSlot = 0;
  setMessage(game, 'Unit detached from Truck.');
  return true;
}

export function beginMedicFollow(game) {
  const unit = selectedUnit(game);
  if (!unit || getUnitRole(unit) !== 'medic') return false;
  game.state.commands.medicFollowAttachMode = true;
  setMessage(game, 'Tap an infantry squad for the Medic to follow.');
  return true;
}

export function beginApcSupport(game) {
  const unit = selectedUnit(game);
  if (!unit || getUnitRole(unit) !== 'apc' || unit.passengerId) return false;
  game.state.commands.apcSupportAttachMode = true;
  setMessage(game, 'Tap a unit or Platoon for APC support.');
  return true;
}

export function detachSelectedSupport(game) {
  const unit = selectedUnit(game), role = getUnitRole(unit);
  const ok = role === 'medic' ? detachMedicFollow(game, unit) : role === 'apc' ? detachApcSupport(game, unit) : false;
  if (ok) setMessage(game, 'Support assignment detached.');
  return ok;
}

export function loadSelectedApc(game) {
  const result = loadApc(game, selectedUnit(game));
  setMessage(game, result.ok ? 'Infantry loaded into APC.' : 'No boardable infantry is in range.');
  return result;
}

export function unloadSelectedApc(game) {
  const result = unloadApc(game, selectedUnit(game));
  if (result.ok) setMessage(game, 'APC passenger unloaded.');
  return result;
}

export function dropSelectedMine(game) {
  const unit = selectedUnit(game);
  if (!unit || getUnitRole(unit) !== 'minelayer') return { ok: false, reason: 'not-minelayer' };
  const config = getUnitConfig('minelayer').mines;
  const active = (game.state.entities.playerMines || []).filter(mine => mine.ownerId === unit.id).length;
  if (active >= config.maxActive) return { ok: false, reason: 'max-active' };
  if (!spendResources(game, { gold: config.goldCost })) return { ok: false, reason: 'cannot-afford' };
  const now = typeof game?.services?.now === 'function' ? game.services.now() : Date.now();
  const mine = { id: `pm${now}-${active}`, ownerId: unit.id, x: unit.x, y: unit.y };
  game.state.entities.playerMines.push(mine);
  setMessage(game, `Mine deployed for ${config.goldCost} Gold.`);
  return { ok: true, mine };
}

export function upgradeSelectedTower(game) {
  const tower = selectedTower(game);
  if (!tower) return { ok: false, reason: 'no-tower' };
  const stats = getEffectiveTowerStats(tower);
  if (stats.level >= 3) return { ok: false, reason: 'max-level' };
  const cost = stats.nextUpgradeCost;
  if (!spendResources(game, { metal: cost })) return { ok: false, reason: 'cannot-afford', cost };
  tower.level = stats.level + 1;
  tower.cool = Math.min(Number(tower.cool) || 0, 0.15);
  setMessage(game, `${stats.nextUpgradeName || 'Tower upgrade'} installed.`);
  return { ok: true, tower, cost, stats: getEffectiveTowerStats(tower) };
}

export function upgradeSelectedStorage(game) {
  const structure = selectedStorage(game);
  if (!structure) return { ok: false, reason: 'no-storage' };
  const result = upgradeBuildingStorage(game, structure);
  if (result.ok) setMessage(game, `Storage upgraded to ${result.level}/3 (${result.capacity}).`);
  return result;
}

export function selectedStorageInfo(game) {
  const structure = selectedStorage(game);
  if (!structure) return null;
  return { structure, level: getStorageLevel(structure), capacity: getStorageCapacity(structure), nextCost: getStorageUpgradeCost(structure) };
}

function attachToTruck(game, unit, truck) {
  if (!unit || !truck || truck.type !== 'truck' || unit === truck || Number(truck.hp) <= 0) return { ok: false, reason: 'invalid-target' };
  removeUnitFromPlatoon(game, unit);
  unit.attachedTo = truck.id;
  unit.attachSlot = (game.state.entities.units || []).filter(other => other !== unit && other.attachedTo === truck.id).length;
  unit.path = [];
  unit.moveTarget = null;
  game.state.commands.attachMode = false;
  return { ok: true, unit, truck };
}

export function handleWorldTap(game, x, y) {
  if (game.state.session.gameOver || game.state.session.choosing) return { ok: false, reason: 'input-blocked' };
  const commands = game.state.commands;
  if (commands.buildType === 'wall') {
    appendWallPoint(game, { x, y }, { force: true });
    setMessage(game, 'Wall path: click bends or drag to paint. Review when ready.');
    return { ok: true, action: 'wall-point' };
  }

  const unit = hitUnit(game, x, y);
  const structure = hitStructure(game, x, y);
  const current = selectedUnit(game);

  if (commands.routeEditing && current?.type === 'truck') {
    const service = structure?.built && SERVICE_TYPES.has(structure.type) ? structure : null;
    addTruckRouteStop(game, current, { x: service?.x ?? x, y: service?.y ?? y, buildingId: service?.id ?? null });
    setMessage(game, `Route stop ${current.route.length} recorded${service ? `: ${service.type}` : ''}.`);
    return { ok: true, action: 'route-stop', building: service };
  }
  if (commands.medicFollowAttachMode && current) {
    const result = attachMedicFollow(game, current, unit);
    setMessage(game, result.ok ? 'Medic follow assigned.' : 'That is not a valid Medic follow target.');
    return { ...result, action: 'medic-follow' };
  }
  if (commands.apcSupportAttachMode && current) {
    const result = attachApcSupport(game, current, unit);
    setMessage(game, result.ok ? 'APC support assigned.' : 'That is not a valid APC support target.');
    return { ...result, action: 'apc-support' };
  }
  if (commands.platoonAttachMode && current) {
    commands.platoonAttachMode = false;
    const result = createOrMergePlatoon(game, current, unit);
    setMessage(game, result.ok ? `Platoon formed (${result.members.length} units).` : 'That unit cannot join this Platoon.');
    return { ...result, action: 'platoon' };
  }
  if (commands.attachMode && current) {
    const result = attachToTruck(game, current, unit);
    setMessage(game, result.ok ? 'Unit attached to Truck.' : 'Tap a Logistics Truck.');
    return { ...result, action: 'truck-attach' };
  }
  if (commands.buildType) {
    const result = placeStructure(game, commands.buildType, x, y);
    if (result.ok) setMessage(game, `${commands.buildType} construction started.`);
    else setMessage(game, result.reason === 'cannot-afford' ? 'Cannot afford that structure.' : 'That placement is blocked.');
    return { ...result, action: 'place-structure' };
  }
  if (unit) { selectUnit(game, unit); return { ok: true, action: 'select-unit', unit }; }
  if (structure?.built && isTower(structure)) { selectTower(game, structure); return { ok: true, action: 'select-tower', structure }; }
  if (!current && structure?.built && STORAGE_TYPES.has(structure.type)) { selectStorage(game, structure); return { ok: true, action: 'select-storage', structure }; }
  if (current) {
    if (current.attachedTo) { setMessage(game, 'Detach this unit before giving it an independent move order.'); return { ok: false, reason: 'attached' }; }
    const result = issueManualMove(game, current, x, y);
    if (!result.ok) setMessage(game, 'That destination is physically blocked.');
    return { ...result, action: 'move' };
  }
  if (selectedTower(game) || selectedStorage(game)) clearSelection(game);
  return { ok: true, action: 'empty' };
}
