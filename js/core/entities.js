import { BUILDING_CONFIG, getBuildingConfig } from '../buildings/buildingConfig.js';
import { ENEMY_CONFIG, getEnemyConfig, hasEnemyTrait } from '../enemies/enemyConfig.js';
import { TOWER_CONFIG, getTowerConfig } from '../towers/towerConfig.js';
import { UNIT_CONFIG, getUnitConfig, hasUnitTrait, normalizeUnitType } from '../units/unitConfig.js';

export function getUnitRole(unit) {
  if (!unit) return null;
  if (typeof unit === 'string') {
    const normalized = normalizeUnitType(unit);
    return UNIT_CONFIG[normalized] ? normalized : null;
  }
  if (typeof unit.role === 'string') {
    const normalized = normalizeUnitType(unit.role);
    if (UNIT_CONFIG[normalized]) return normalized;
  }
  if (unit.type === 'truck') return 'truck';
  if (unit.type === 'soldier' && !unit.role) return 'rifleman';
  return null;
}

export function getUnitDefinition(unit) {
  const role = getUnitRole(unit);
  return role ? getUnitConfig(role) : null;
}

export function isFlyingUnit(unit) { return hasUnitTrait(getUnitRole(unit), 'air'); }
export function isGroundUnit(unit) { return hasUnitTrait(getUnitRole(unit), 'ground'); }
export function isInfantryUnit(unit) { return hasUnitTrait(getUnitRole(unit), 'infantry'); }
export function isMechanicalUnit(unit) { return hasUnitTrait(getUnitRole(unit), 'mechanical'); }
export function isVehicleUnit(unit) { return hasUnitTrait(getUnitRole(unit), 'vehicle'); }
export function isRepairableUnit(unit) { return hasUnitTrait(getUnitRole(unit), 'repairable'); }
export function isHealableUnit(unit) { return hasUnitTrait(getUnitRole(unit), 'healable'); }
export function isSupportUnit(unit) { return hasUnitTrait(getUnitRole(unit), 'support'); }
export function isCombatUnit(unit) { return hasUnitTrait(getUnitRole(unit), 'combat'); }
export function isTransportUnit(unit) { return hasUnitTrait(getUnitRole(unit), 'transport'); }
export function isLogisticsUnit(unit) { return hasUnitTrait(getUnitRole(unit), 'logistics'); }

export function canJoinPlatoon(unit) {
  const role = getUnitRole(unit);
  if (!role || !hasUnitTrait(role, 'platoonCapable')) return false;
  if (typeof unit === 'string') return true;
  return (unit.hp === undefined || Number(unit.hp) > 0)
    && !unit.garrisonedIn
    && !unit.transportedIn
    && !unit.attachedTo;
}

export function getUnitRadius(unit) {
  const definition = getUnitDefinition(unit);
  if (!definition) throw new Error(`Unknown unit identity: ${unit?.role ?? unit?.type ?? unit}`);
  return definition.radius;
}

export function isFlyingEnemy(enemy) {
  const type = typeof enemy === 'string' ? enemy : enemy?.type;
  return Boolean(type && hasEnemyTrait(type, 'air'));
}

export function isGroundEnemy(enemy) {
  const type = typeof enemy === 'string' ? enemy : enemy?.type;
  return Boolean(type && hasEnemyTrait(type, 'ground'));
}

export function getEnemyRadius(enemy) {
  const type = typeof enemy === 'string' ? enemy : enemy?.type;
  return getEnemyConfig(type).radius;
}

export function isTower(entity) {
  const type = typeof entity === 'string' ? entity : entity?.type;
  return Boolean(type && TOWER_CONFIG[type]);
}

export function isBuilding(entity) {
  const type = typeof entity === 'string' ? entity : entity?.type;
  return Boolean(type && BUILDING_CONFIG[type]);
}

export function getTowerRadius(tower) {
  const type = typeof tower === 'string' ? tower : tower?.type;
  return getTowerConfig(type).collisionRadius;
}

export function getBuildingRadius(building) {
  const type = typeof building === 'string' ? building : building?.type;
  return getBuildingConfig(type).collisionRadius;
}

export function getEntityKind(entity) {
  if (getUnitRole(entity)) return 'unit';
  const type = typeof entity === 'string' ? entity : entity?.type;
  if (type && ENEMY_CONFIG[type]) return 'enemy';
  if (type && TOWER_CONFIG[type]) return 'tower';
  if (type && BUILDING_CONFIG[type]) return 'building';
  return null;
}

export function getEntityRadius(entity) {
  switch (getEntityKind(entity)) {
    case 'unit': return getUnitRadius(entity);
    case 'enemy': return getEnemyRadius(entity);
    case 'tower': return getTowerRadius(entity);
    case 'building': return getBuildingRadius(entity);
    default: throw new Error(`Unknown entity type: ${entity?.role ?? entity?.type ?? entity}`);
  }
}
