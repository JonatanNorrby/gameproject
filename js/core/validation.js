import { BUILDING_CONFIG } from '../buildings/buildingConfig.js';
import { CLEAN_CONFIG, GAME_CONFIG } from './config.js';
import { ENEMY_CONFIG } from '../enemies/enemyConfig.js';
import { TOWER_CONFIG } from '../towers/towerConfig.js';
import { UNIT_CONFIG } from '../units/unitConfig.js';
import { isFiniteNumber } from '../utils/helpers.js';

function positive(value) { return isFiniteNumber(value) && value > 0; }
function nonNegative(value) { return isFiniteNumber(value) && value >= 0; }

function validateUniqueIds(registry, kind, errors) {
  const seen = new Set();
  for (const [key, value] of Object.entries(registry)) {
    if (value.id !== key) errors.push(`${kind} registry key/id mismatch: ${key} != ${value.id}`);
    if (seen.has(value.id)) errors.push(`Duplicate ${kind} canonical id: ${value.id}`);
    seen.add(value.id);
  }
}

function scanNaN(value, path, errors) {
  if (typeof value === 'number' && Number.isNaN(value)) {
    errors.push(`NaN at ${path}`);
    return;
  }
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) value.forEach((item, i) => scanNaN(item, `${path}[${i}]`, errors));
  else Object.entries(value).forEach(([key, item]) => scanNaN(item, `${path}.${key}`, errors));
}

function validateCosts(cost, path, errors) {
  if (cost == null) return;
  for (const [currency, value] of Object.entries(cost)) {
    if (!nonNegative(value)) errors.push(`${path}.${currency} must be a finite non-negative number`);
  }
}

function validateUnits(errors) {
  validateUniqueIds(UNIT_CONFIG, 'unit', errors);
  for (const unit of Object.values(UNIT_CONFIG)) {
    if (!positive(unit.maxHp)) errors.push(`${unit.id}.maxHp must be > 0`);
    if (!positive(unit.moveSpeed)) errors.push(`${unit.id}.moveSpeed must be > 0`);
    if (!positive(unit.radius)) errors.push(`${unit.id}.radius must be > 0`);
    validateCosts(unit.cost, `unit.${unit.id}.cost`, errors);
    const ground = unit.traits.includes('ground'), air = unit.traits.includes('air');
    if (ground === air) errors.push(`${unit.id} must have exactly one of ground/air traits`);
    if (unit.traits.includes('combat')) {
      if (!unit.combat || !positive(unit.combat.range) || !positive(unit.combat.fireInterval)) {
        errors.push(`${unit.id} combat unit requires positive range/fireInterval`);
      }
      const damage = unit.combat?.damage ?? unit.combat?.directDamage;
      if (!positive(damage)) errors.push(`${unit.id} combat unit requires positive damage/directDamage`);
      if (!['any', 'air', 'ground'].includes(unit.combat?.targeting)) errors.push(`${unit.id} has invalid combat targeting`);
    }
    if (unit.traits.includes('healer') && (!positive(unit.healing?.range) || !positive(unit.healing?.perSecond))) {
      errors.push(`${unit.id} healer requires positive healing config`);
    }
    if (unit.traits.includes('repairer') && (!positive(unit.repair?.range) || !positive(unit.repair?.perSecond))) {
      errors.push(`${unit.id} repairer requires positive repair config`);
    }
    if (unit.traits.includes('transport') && !positive(unit.transport?.capacity)) {
      errors.push(`${unit.id} transport requires positive capacity`);
    }
  }
}

function validateEnemies(errors) {
  validateUniqueIds(ENEMY_CONFIG, 'enemy', errors);
  for (const enemy of Object.values(ENEMY_CONFIG)) {
    for (const [field, value] of [['baseHp', enemy.baseHp], ['baseSpeed', enemy.baseSpeed], ['radius', enemy.radius]]) {
      if (!positive(value)) errors.push(`${enemy.id}.${field} must be > 0`);
    }
    for (const [field, value] of [['hpPerLevel', enemy.hpPerLevel], ['speedPerLevel', enemy.speedPerLevel], ['baseDamage', enemy.baseDamage], ['bountyGold', enemy.bountyGold]]) {
      if (!nonNegative(value)) errors.push(`${enemy.id}.${field} must be >= 0`);
    }
    if (!['ground', 'air'].includes(enemy.movement)) errors.push(`${enemy.id}.movement must be ground or air`);
    if (!positive(enemy.horde?.hp) || !positive(enemy.horde?.damage)) errors.push(`${enemy.id} requires positive horde multipliers`);
  }
}

function validateTowers(errors) {
  validateUniqueIds(TOWER_CONFIG, 'tower', errors);
  for (const tower of Object.values(TOWER_CONFIG)) {
    validateCosts(tower.cost, `tower.${tower.id}.cost`, errors);
    for (const [field, value] of [['maxHp', tower.maxHp], ['placementRadius', tower.placementRadius], ['collisionRadius', tower.collisionRadius], ['range', tower.range], ['fireInterval', tower.fireInterval]]) {
      if (!positive(value)) errors.push(`${tower.id}.${field} must be > 0`);
    }
    if (!['any', 'air', 'ground'].includes(tower.targeting)) errors.push(`${tower.id}.targeting is invalid`);
    if (!(positive(tower.damage) || positive(tower.burn?.tickDamage))) errors.push(`${tower.id} requires damage or burn tick damage`);
    for (const level of [2, 3]) {
      const upgrade = tower.upgrades?.[level];
      if (!upgrade) { errors.push(`${tower.id} is missing level ${level} upgrade`); continue; }
      validateCosts(upgrade.cost, `tower.${tower.id}.upgrades.${level}.cost`, errors);
      if (!upgrade.name || !upgrade.description) errors.push(`${tower.id} level ${level} requires name/description`);
      for (const [key, value] of Object.entries(upgrade.modifiers || {})) {
        if (!isFiniteNumber(value)) errors.push(`${tower.id} level ${level} modifier ${key} must be finite`);
      }
    }
  }
}

function validateBuildings(errors) {
  validateUniqueIds(BUILDING_CONFIG, 'building', errors);
  for (const building of Object.values(BUILDING_CONFIG)) {
    validateCosts(building.cost, `building.${building.id}.cost`, errors);
    if (building.id !== 'wall' && !positive(building.maxHp)) errors.push(`${building.id}.maxHp must be > 0`);
    if (!positive(building.placementRadius) || !positive(building.collisionRadius)) errors.push(`${building.id} requires positive footprint radii`);
    if (building.storage) {
      const levels = building.storage.levels;
      if (!Array.isArray(levels) || !levels.length || levels.some(v => !positive(v))) errors.push(`${building.id}.storage.levels must be positive`);
      const costs = building.storage.upgradeCosts;
      if (!Array.isArray(costs) || costs.length !== levels.length) errors.push(`${building.id}.storage upgrade costs must match storage levels`);
      else costs.forEach((cost, i) => validateCosts(cost, `building.${building.id}.storage.upgradeCosts.${i}`, errors));
    }
    if (building.id === 'wall') {
      if (!positive(building.wall?.thickness) || !positive(building.wall?.hpPer100) || !positive(building.cost?.metalPer100)) errors.push('wall requires valid thickness/HP/cost scaling');
    }
  }
}

export function validateGameConfig({ throwOnError = false } = {}) {
  const errors = [];
  scanNaN(CLEAN_CONFIG, 'config', errors);
  validateUnits(errors);
  validateEnemies(errors);
  validateTowers(errors);
  validateBuildings(errors);
  if (!positive(GAME_CONFIG.world.width) || !positive(GAME_CONFIG.world.height)) errors.push('world dimensions must be positive');
  if (!positive(GAME_CONFIG.camera.minZoom) || GAME_CONFIG.camera.maxZoom < GAME_CONFIG.camera.minZoom) errors.push('camera zoom bounds are invalid');
  if (!positive(GAME_CONFIG.director.enemySpeedMultiplier)) errors.push('enemySpeedMultiplier must be positive');

  const result = Object.freeze({
    ok: errors.length === 0,
    errors: Object.freeze(errors),
    counts: Object.freeze({
      units: Object.keys(UNIT_CONFIG).length,
      enemies: Object.keys(ENEMY_CONFIG).length,
      towers: Object.keys(TOWER_CONFIG).length,
      buildings: Object.keys(BUILDING_CONFIG).length,
    }),
  });
  if (throwOnError && !result.ok) throw new Error(`Clean config validation failed:\n${errors.join('\n')}`);
  return result;
}
