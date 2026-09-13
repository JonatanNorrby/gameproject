import { getUnitRadius, getUnitRole } from '../core/entities.js';
import { isNavigationPointBlocked } from '../navigation/pathfinding.js';
import { cleanupDeadEnemies } from '../enemies/enemyLifecycle.js';
import { removeUnitFromPlatoon } from '../units/platoons.js';
import { applyDamage, isAlive } from './damage.js';

function units(game) { return game?.state?.entities?.units || []; }
function structures(game) { return game?.state?.entities?.structures || []; }

function safeEjectPoint(game, carrier, passenger) {
  const radius = (() => { try { return getUnitRadius(passenger); } catch { return 18; } })();
  const distance = Number(game?.config?.units?.apc?.transport?.unloadDistance) || 56;
  for (let i = 0; i < 12; i++) {
    const angle = i / 12 * Math.PI * 2;
    const x = carrier.x + Math.cos(angle) * distance;
    const y = carrier.y + Math.sin(angle) * distance;
    if (!isNavigationPointBlocked(game, x, y, radius)) return { x, y };
  }
  return { x: carrier.x + distance, y: carrier.y };
}

export function ejectDestroyedApcPassenger(game, apc) {
  if (!apc || getUnitRole(apc) !== 'apc') return null;
  const passenger = units(game).find(unit => unit.id === apc.passengerId || unit.transportedIn === apc.id) || null;
  apc.passengerId = null;
  if (!passenger) return null;
  passenger.transportedIn = null;
  const point = safeEjectPoint(game, apc, passenger);
  passenger.x = point.x; passenger.y = point.y;
  passenger.path = []; passenger.moveTarget = null;
  // v28 unloadAPC(apc,.30): passenger loses 30% of CURRENT HP, min 1.
  passenger.hp = Math.max(1, (Number(passenger.hp) || 1) * 0.70);
  return passenger;
}

function clearRelationshipsToDeadUnit(game, dead) {
  for (const unit of units(game)) {
    if (unit === dead) continue;
    if (unit.attachedTo === dead.id) {
      unit.attachedTo = null; unit.attachSlot = 0;
      unit.path = []; unit.moveTarget = null;
    }
    if (unit.v47FollowId === dead.id) { unit.v47FollowId = null; unit.v47FollowTimer = 0; }
    if (unit.v47SupportUnitId === dead.id) { unit.v47SupportUnitId = null; unit.v47SupportTimer = 0; }
  }
}

function cleanupDeadUnits(game) {
  const list = units(game);
  let removed = 0;
  for (let i = list.length - 1; i >= 0; i--) {
    const unit = list[i];
    if (Number(unit?.hp) > 0) continue;
    if (getUnitRole(unit) === 'apc') ejectDestroyedApcPassenger(game, unit);
    removeUnitFromPlatoon(game, unit);
    clearRelationshipsToDeadUnit(game, unit);
    if (game?.state?.selection?.unitId === unit.id) game.state.selection.unitId = null;
    list.splice(i, 1); removed++;
    const callback = game?.services?.lifecycle?.onUnitDestroyed;
    if (typeof callback === 'function') callback(game, unit);
  }
  return removed;
}

function cleanupDeadStructures(game) {
  const list = structures(game);
  let removed = 0;
  for (let i = list.length - 1; i >= 0; i--) {
    const structure = list[i];
    if (Number(structure?.hp) > 0) continue;
    if (game?.state?.selection?.towerId === structure.id) game.state.selection.towerId = null;
    if (game?.state?.selection?.storageBuildingId === structure.id) game.state.selection.storageBuildingId = null;
    list.splice(i, 1); removed++;
    const callback = game?.services?.lifecycle?.onStructureDestroyed;
    if (typeof callback === 'function') callback(game, structure);
  }
  return removed;
}

export function applyBaseDamage(game, amount, context = {}) {
  const base = game?.state?.base;
  if (!base) return { applied: false, destroyed: false, reason: 'missing-base' };
  if (game?.state?.debug?.unlimitedLives) return { applied: false, destroyed: false, reason: 'unlimited-lives', hp: base.hp };
  const result = applyDamage(game, base, amount, { ...context, onDestroyed: undefined });
  if (result.destroyed && !game.state.session.gameOver) {
    game.state.session.gameOver = true;
    const callback = context.onDestroyed ?? game?.services?.lifecycle?.onBaseDestroyed;
    if (typeof callback === 'function') callback(game, base, result, context);
  }
  return result;
}

export function cleanupDestroyedEntities(game) {
  const enemies = cleanupDeadEnemies(game);
  const unitsRemoved = cleanupDeadUnits(game);
  const structuresRemoved = cleanupDeadStructures(game);
  if (game?.state?.base && Number(game.state.base.hp) <= 0 && !game.state.session.gameOver) {
    game.state.session.gameOver = true;
    const callback = game?.services?.lifecycle?.onBaseDestroyed;
    if (typeof callback === 'function') callback(game, game.state.base, { destroyed: true, hp: game.state.base.hp });
  }
  return { enemies, units: unitsRemoved, structures: structuresRemoved, gameOver: Boolean(game?.state?.session?.gameOver) };
}
