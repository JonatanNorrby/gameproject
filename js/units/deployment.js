import { getEntityRadius, getUnitRole, isFlyingUnit } from '../core/entities.js';
import { spendResources, refundResources } from '../economy/resources.js';
import { getUnitConfig, normalizeUnitType } from './unitConfig.js';
import { isNavigationTerrainBlocked } from '../navigation/terrain.js';
import { pointSegmentDistance } from '../utils/geometry.js';
import { ensureTruckLogistics } from '../economy/truckLogistics.js';

function random(game) {
  return typeof game?.services?.random === 'function' ? game.services.random() : Math.random();
}

function id(game, role) {
  const create = game?.services?.units?.createUnitId;
  if (typeof create === 'function') return create(role, game);
  const now = typeof game?.services?.now === 'function' ? game.services.now() : Date.now();
  return `u${now}-${role}-${String(random(game)).replace('.', '')}`;
}

function active(unit) {
  return unit && Number(unit.hp) > 0 && !unit.transportedIn && !unit.garrisonedIn;
}

function spawnBlocked(game, x, y, radius, air) {
  const r = Math.max(4, Number(radius) || 20);
  const { width, height } = game.config.world;
  if (x < r + 8 || y < r + 8 || x > width - r - 8 || y > height - r - 8) return true;
  if (air) return false;
  if (isNavigationTerrainBlocked(game, x, y, r * 0.45)) return true;
  for (const structure of game.state.entities.structures || []) {
    if (!structure || Number(structure.hp) <= 0) continue;
    if (structure.type === 'wall' && Number.isFinite(structure.x1)) {
      const thickness = Number(structure.thickness) || game.config.buildings.wall.wall.thickness;
      if (pointSegmentDistance(x, y, structure.x1, structure.y1, structure.x2, structure.y2) < r + thickness / 2 + 6) return true;
    } else if (Number.isFinite(structure.x) && Number.isFinite(structure.y)) {
      let sr = 30;
      try { sr = Number(getEntityRadius(structure)) || sr; } catch {}
      if (Math.hypot(x - structure.x, y - structure.y) < r + sr + 7) return true;
    }
  }
  for (const depot of game.state.entities.depots || []) {
    if (Number.isFinite(depot.x) && Math.hypot(x - depot.x, y - depot.y) < r + (Number(depot.r) || 34) + 6) return true;
  }
  for (const unit of game.state.entities.units || []) {
    if (!active(unit) || !Number.isFinite(unit.x)) continue;
    let ur = 20;
    try { ur = Number(getEntityRadius(unit)) || ur; } catch {}
    if (Math.hypot(x - unit.x, y - unit.y) < r + ur + 5) return true;
  }
  return false;
}

export function findBaseDeploymentPoint(game, roleOrType) {
  const role = normalizeUnitType(roleOrType);
  const config = getUnitConfig(role);
  const radius = config.radius;
  const base = game.state.base;
  const air = config.traits.includes('air');
  if (air) {
    const count = (game.state.entities.units || []).filter(unit => active(unit) && isFlyingUnit(unit)).length;
    const angle = (count * 1.73 + 0.35) % (Math.PI * 2);
    const distance = base.radius + radius + 74 + (count % 3) * 24;
    return {
      x: Math.max(radius + 8, Math.min(game.config.world.width - radius - 8, base.x + Math.cos(angle) * distance)),
      y: Math.max(radius + 8, Math.min(game.config.world.height - radius - 8, base.y + Math.sin(angle) * distance)),
    };
  }
  for (let ring = 0; ring < 15; ring++) {
    const distance = base.radius + radius + 48 + ring * 34;
    for (let i = 0; i < 64; i++) {
      const angle = i / 64 * Math.PI * 2 + ring * 0.173;
      const x = base.x + Math.cos(angle) * distance;
      const y = base.y + Math.sin(angle) * distance;
      if (!spawnBlocked(game, x, y, radius, false)) return { x, y };
    }
  }
  return {
    x: Math.max(radius + 8, Math.min(game.config.world.width - radius - 8, base.x + base.radius + radius + 70)),
    y: base.y,
  };
}

export function createPlayerUnit(game, roleOrType, point = null) {
  const role = normalizeUnitType(roleOrType);
  const config = getUnitConfig(role);
  const position = point || findBaseDeploymentPoint(game, role);
  const members = Math.max(1, Number(config.members) || Number(config.barrels) || 1);
  const unit = {
    id: id(game, role),
    type: config.runtimeType,
    role: role === 'rifleman' ? 'rifleman' : role,
    x: position.x,
    y: position.y,
    hp: config.maxHp,
    maxHp: config.maxHp,
    moveTarget: null,
    path: [],
    heading: 0,
    cooldowns: Array.from({ length: members }, () => random(game) * 0.24),
    platoonId: null,
    platoonSlot: 0,
    garrisonedIn: null,
    transportedIn: null,
    attachedTo: null,
    attachSlot: 0,
  };
  if (role === 'medic') unit.healFxCooldown = 0;
  if (role === 'engineer' || role === 'repairvehicle') unit.repairFxCooldown = 0;
  if (role === 'apc') unit.passengerId = null;
  if (role === 'truck') {
    unit.type = 'truck';
    unit.role = undefined;
    unit.hp = unit.maxHp = config.maxHp * (Number(game.state.modifiers.truckHp) || 1);
    ensureTruckLogistics(game, unit);
  }
  return unit;
}

export function deployUnitFromBase(game, roleOrType) {
  const role = normalizeUnitType(roleOrType);
  const config = getUnitConfig(role);
  if (Number(config.maxActive) > 0) {
    const count = (game.state.entities.units || []).filter(unit => active(unit) && getUnitRole(unit) === role).length;
    if (count >= config.maxActive) return { ok: false, reason: 'max-active', role, maxActive: config.maxActive };
  }
  if (!spendResources(game, config.cost)) return { ok: false, reason: 'cannot-afford', role, cost: config.cost };
  try {
    const unit = createPlayerUnit(game, role);
    if (!Number.isFinite(unit.x) || !Number.isFinite(unit.y) || Number(unit.hp) <= 0) throw new Error('invalid-unit');
    game.state.entities.units.push(unit);
    return { ok: true, unit, role, cost: config.cost };
  } catch (error) {
    refundResources(game, config.cost);
    return { ok: false, reason: 'deployment-failed', role, error };
  }
}
