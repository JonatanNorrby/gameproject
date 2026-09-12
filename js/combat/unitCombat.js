import {
  getUnitConfig,
  UNIT_CONFIG,
} from '../units/unitConfig.js';
import {
  getUnitRole,
  isGroundEnemy,
} from '../core/entities.js';
import { squaredDistance } from '../utils/math.js';
import { isAlive } from './damage.js';
import { tickCooldown, isCooldownReady, resetCooldown } from './cooldowns.js';
import { TARGETING_MODES, canAttackTarget } from './targeting.js';
import { findBestEnemyTarget, findNearestEnemyTargets, canPlayerUnitAffectEnemy } from './unitTargeting.js';
import { applyPlayerEnemyDamage, markEnemy, tickEnemyMarks } from './playerDamage.js';
import { updateMedicSupport } from './healing.js';
import { updateEngineerRepair, updateRepairVehicleSupport } from './repair.js';
import { updatePlayerMines } from './unitMines.js';

const SOLDIER_OFFSETS = Object.freeze([[-12, -9], [12, -9], [-12, 10], [12, 10], [0, -18], [0, 18]]);

export const PLAYER_UNIT_COMBAT_KIND = Object.freeze({
  PROJECTILE: 'projectile',
  DIRECT_SPLASH: 'direct-splash',
  FLAME: 'flame',
  HEAL: 'heal',
  REPAIR: 'repair',
  SPOTTER: 'spotter',
  MINE_LAYER: 'mine-layer',
  NONE: 'none',
});

export const PLAYER_UNIT_COMBAT_PROFILES = Object.freeze({
  rifleman: { kind: PLAYER_UNIT_COMBAT_KIND.PROJECTILE, projectileType: 'soldier', members: 'members', jitter: 0.018, rifleman: true },
  heavygunner: { kind: PLAYER_UNIT_COMBAT_KIND.PROJECTILE, projectileType: 'heavy', members: 'members', jitter: 0.02, randomizedInterval: true },
  rocketeer: { kind: PLAYER_UNIT_COMBAT_KIND.DIRECT_SPLASH, secondaryMultiplier: 0.65, members: 'members', randomizedInterval: true, effect: 'rocket' },
  medic: { kind: PLAYER_UNIT_COMBAT_KIND.HEAL },
  engineer: { kind: PLAYER_UNIT_COMBAT_KIND.REPAIR, repairer: 'engineer' },
  scout: { kind: PLAYER_UNIT_COMBAT_KIND.PROJECTILE, projectileType: 'soldier', members: 'members', jitter: 0.02, randomizedInterval: true, scoutMark: true },
  sniper: { kind: PLAYER_UNIT_COMBAT_KIND.PROJECTILE, projectileType: 'sniper', members: 'members', jitter: 0.005, randomizedInterval: true },
  flametrooper: { kind: PLAYER_UNIT_COMBAT_KIND.FLAME },
  spotter: { kind: PLAYER_UNIT_COMBAT_KIND.SPOTTER },
  minelayer: { kind: PLAYER_UNIT_COMBAT_KIND.MINE_LAYER },
  mech: { kind: PLAYER_UNIT_COMBAT_KIND.PROJECTILE, projectileType: 'mech', members: 'barrels', jitter: 0.025, muzzleSpread: 7 },
  combatdrone: { kind: PLAYER_UNIT_COMBAT_KIND.PROJECTILE, projectileType: 'droneunit', members: 1, jitter: 0.02 },
  combatship: { kind: PLAYER_UNIT_COMBAT_KIND.DIRECT_SPLASH, secondaryMultiplier: 0.55, members: 1, effect: 'shipblast' },
  tank: { kind: PLAYER_UNIT_COMBAT_KIND.DIRECT_SPLASH, secondaryMultiplier: 0.32, members: 1, effect: 'tankshot', splashEligibility: 'targetable' },
  mobileartillery: { kind: PLAYER_UNIT_COMBAT_KIND.DIRECT_SPLASH, secondaryMultiplier: 0.62, members: 1, effect: 'artillery', groundOnlySplash: true, inclusiveRange: true },
  repairvehicle: { kind: PLAYER_UNIT_COMBAT_KIND.REPAIR, repairer: 'vehicle' },
  apc: { kind: PLAYER_UNIT_COMBAT_KIND.PROJECTILE, projectileType: 'apc', members: 1, jitter: 0.025 },
  mgcar: { kind: PLAYER_UNIT_COMBAT_KIND.PROJECTILE, projectileType: 'mgcar', members: 1, jitter: 0.045 },
  truck: { kind: PLAYER_UNIT_COMBAT_KIND.NONE },
});

function stateModifiers(game) {
  return game?.state?.modifiers || game?.state?.mods || {};
}

function randomValue(game) {
  const random = game?.services?.random;
  return typeof random === 'function' ? random() : Math.random();
}

function nowMs(game) {
  const now = game?.services?.now;
  return typeof now === 'function' ? Number(now()) || 0 : (typeof performance !== 'undefined' ? performance.now() : Date.now());
}

function emitEffect(game, effect) {
  const service = game?.services?.playerCombat?.emitEffect;
  if (typeof service === 'function') return service(game, effect);
  const effects = game?.state?.entities?.effects;
  if (Array.isArray(effects)) effects.push(effect);
  return effect;
}

function emitProjectile(game, unit, target, shot) {
  const jitter = Number(shot.jitter) || 0;
  const angle = Math.atan2(target.y - shot.y, target.x - shot.x) + (randomValue(game) - 0.5) * jitter;
  const speed = Number(shot.speed) || 0;
  const projectile = {
    x: shot.x,
    y: shot.y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    dmg: Number(shot.damage) || 0,
    life: 2.2,
    type: shot.type,
    sourceId: unit.id ?? null,
  };
  const service = game?.services?.playerCombat?.fireProjectile;
  if (typeof service === 'function') service(game, projectile, { unit, target });
  else if (Array.isArray(game?.state?.entities?.projectiles)) game.state.entities.projectiles.push(projectile);
  return projectile;
}

function activeCombatUnit(unit) {
  return isAlive(unit) && !unit.transportedIn && !unit.garrisonedIn;
}

function memberCount(definition, profile, game) {
  let count = profile.members === 'members' ? Number(definition.members) || 1
    : profile.members === 'barrels' ? Number(definition.barrels) || 1
      : Number(profile.members) || 1;
  if (profile.rifleman) count += Number(stateModifiers(game).extraSoldiers) || 0;
  return Math.max(1, Math.floor(count));
}

function cooldownArray(game, unit, count, { rifleman = false } = {}) {
  if (!Array.isArray(unit.combatCooldowns)) {
    if (rifleman && Array.isArray(unit.v47RifleCooldowns)) unit.combatCooldowns = unit.v47RifleCooldowns;
    else if (!rifleman && Array.isArray(unit.cooldowns)) unit.combatCooldowns = unit.cooldowns;
    else unit.combatCooldowns = [];
  }
  const initialWindow = rifleman ? 0.14 : 0.20;
  while (unit.combatCooldowns.length < count) unit.combatCooldowns.push(randomValue(game) * initialWindow);
  if (unit.combatCooldowns.length > count) unit.combatCooldowns.length = count;
  return unit.combatCooldowns;
}

function randomizedInterval(game, interval) {
  return interval * (0.94 + randomValue(game) * 0.12);
}

function targetOptions(definition, profile) {
  return {
    range: definition.combat.range,
    minRange: definition.combat.minRange || 0,
    targeting: definition.combat.targeting,
    inclusiveMax: profile.inclusiveRange === true,
  };
}

function projectileDamage(game, definition, profile) {
  let damage = Number(definition.combat.damage) || 0;
  if (profile.rifleman) damage *= Number(stateModifiers(game).soldierDamage) || 1;
  return damage;
}

function projectileInterval(game, definition, profile) {
  let interval = Number(definition.combat.fireInterval) || 0;
  if (profile.rifleman) interval *= Number(stateModifiers(game).soldierRate) || 1;
  if (profile.randomizedInterval || profile.rifleman) interval = randomizedInterval(game, interval);
  return interval;
}

function fireProjectileRole(game, unit, definition, profile, dt) {
  const count = memberCount(definition, profile, game);
  const cooldowns = cooldownArray(game, unit, count, { rifleman: profile.rifleman });
  const sharedTarget = profile.rifleman ? findBestEnemyTarget(game, unit, targetOptions(definition, profile)) : null;
  let fired = 0;

  for (let i = 0; i < count; i++) {
    cooldowns[i] = tickCooldown(cooldowns[i], dt);
    if (!isCooldownReady(cooldowns[i])) continue;
    const target = sharedTarget || findBestEnemyTarget(game, unit, targetOptions(definition, profile));
    if (!target) continue;
    if (profile.scoutMark) markEnemy(target, definition.mark.damageMultiplier, definition.mark.duration);
    const offset = profile.rifleman || profile.members === 'members' ? SOLDIER_OFFSETS[i % SOLDIER_OFFSETS.length] : [0, 0];
    const spread = Number(profile.muzzleSpread) || 0;
    const x = unit.x + (spread ? (i ? spread : -spread) : offset[0]);
    const y = unit.y + (spread ? 0 : offset[1]);
    emitProjectile(game, unit, target, {
      x,
      y,
      type: profile.projectileType,
      damage: projectileDamage(game, definition, profile),
      speed: definition.combat.bulletSpeed,
      jitter: profile.jitter,
    });
    if (profile.rifleman) {
      unit.heading = Math.atan2(target.y - unit.y, target.x - unit.x);
      unit.v47FiringUntil = nowMs(game) + 170;
    }
    cooldowns[i] = resetCooldown(projectileInterval(game, definition, profile));
    fired++;
  }
  return fired;
}

function directSplashTargets(game, unit, target, definition, profile) {
  const radius = Number(definition.combat.splashRadius) || 0;
  const radius2 = radius * radius;
  const out = [];
  for (const enemy of [...(game?.state?.entities?.enemies || [])]) {
    if (!isAlive(enemy)) continue;
    if (profile.groundOnlySplash && !isGroundEnemy(enemy)) continue;
    if (profile.splashEligibility === 'targetable' && !canPlayerUnitAffectEnemy(game, unit, enemy, { targeting: TARGETING_MODES.ANY, requireVisible: false })) continue;
    if (squaredDistance(enemy.x, enemy.y, target.x, target.y) <= radius2) out.push(enemy);
  }
  return out;
}

function fireDirectSplashRole(game, unit, definition, profile, dt) {
  const count = memberCount(definition, profile, game);
  const cooldowns = cooldownArray(game, unit, count);
  let fired = 0;
  for (let i = 0; i < count; i++) {
    cooldowns[i] = tickCooldown(cooldowns[i], dt);
    if (!isCooldownReady(cooldowns[i])) continue;
    const target = findBestEnemyTarget(game, unit, targetOptions(definition, profile));
    if (!target) continue;
    for (const enemy of directSplashTargets(game, unit, target, definition, profile)) {
      applyPlayerEnemyDamage(game, enemy, definition.combat.damage * (enemy === target ? 1 : profile.secondaryMultiplier), { source: unit, attackKind: getUnitRole(unit) });
    }
    const off = profile.members === 'members' ? SOLDIER_OFFSETS[i % SOLDIER_OFFSETS.length] : [0, 0];
    const effect = profile.effect === 'rocket'
      ? { kind: 'rocket', x1: unit.x + off[0], y1: unit.y + off[1], x2: target.x, y2: target.y, r: definition.combat.splashRadius, durationMs: 190, legacyChannel: 'v17Effects' }
      : profile.effect === 'shipblast'
        ? { kind: 'shipblast', x1: unit.x, y1: unit.y, x2: target.x, y2: target.y, r: definition.combat.splashRadius, durationMs: 180, legacyChannel: 'v25Effects' }
        : profile.effect === 'tankshot'
          ? { kind: 'tankshot', x1: unit.x, y1: unit.y, x2: target.x, y2: target.y, r: definition.combat.splashRadius, durationMs: 155, legacyChannel: 'v26Effects' }
          : { kind: 'artillery', x1: unit.x, y1: unit.y, x2: target.x, y2: target.y, r: definition.combat.splashRadius, durationMs: 240, legacyChannel: 'v26Effects' };
    emitEffect(game, effect);
    const interval = profile.randomizedInterval ? randomizedInterval(game, definition.combat.fireInterval) : definition.combat.fireInterval;
    cooldowns[i] = resetCooldown(interval);
    fired++;
  }
  return fired;
}

function updateFlametrooper(game, unit, definition, dt) {
  const cooldowns = cooldownArray(game, unit, 1);
  cooldowns[0] = tickCooldown(cooldowns[0], dt);
  if (!isCooldownReady(cooldowns[0])) return 0;
  const targets = findNearestEnemyTargets(game, unit, {
    range: definition.combat.range,
    targeting: definition.combat.targeting,
    count: definition.combat.targets,
    inclusiveMax: true,
  });
  if (!targets.length) return 0;
  for (const enemy of targets) {
    applyPlayerEnemyDamage(game, enemy, definition.combat.directDamage, { source: unit, attackKind: 'flametrooper' });
    if (isAlive(enemy)) {
      enemy.burn = Math.max(Number(enemy.burn) || 0, definition.combat.burnDuration);
      enemy.burnTick = Math.min(Number.isFinite(Number(enemy.burnTick)) ? Number(enemy.burnTick) : 0, 0.01);
    }
    emitEffect(game, { kind: 'trooperflame', x1: unit.x, y1: unit.y, x2: enemy.x, y2: enemy.y, durationMs: 110, legacyChannel: 'v25Effects' });
  }
  cooldowns[0] = resetCooldown(definition.combat.fireInterval);
  return targets.length;
}

function updateSpotter(game, unit, definition) {
  const range = Number(definition.spotting.range) || 0;
  const range2 = range * range;
  let marked = 0;
  for (const enemy of game?.state?.entities?.enemies || []) {
    if (!canAttackTarget(game, unit, enemy, {
      targeting: TARGETING_MODES.ANY,
      isRevealed: (target, attacker) => {
        if (!target.cloaked) return true;
        const reveal = Number(game?.config?.enemies?.[target.type]?.stealth?.revealRange) || 145;
        return squaredDistance(target.x, target.y, attacker.x, attacker.y) <= reveal * reveal;
      },
    })) continue;
    if (squaredDistance(unit.x, unit.y, enemy.x, enemy.y) > range2) continue;
    if (markEnemy(enemy, definition.spotting.markDamageMultiplier, definition.spotting.refresh)) marked++;
  }
  return marked;
}

function updateUnitByProfile(game, unit, dt) {
  const role = getUnitRole(unit);
  const profile = PLAYER_UNIT_COMBAT_PROFILES[role];
  if (!profile || !activeCombatUnit(unit)) return 0;
  const definition = getUnitConfig(role);
  switch (profile.kind) {
    case PLAYER_UNIT_COMBAT_KIND.PROJECTILE:
      return fireProjectileRole(game, unit, definition, profile, dt);
    case PLAYER_UNIT_COMBAT_KIND.DIRECT_SPLASH:
      return fireDirectSplashRole(game, unit, definition, profile, dt);
    case PLAYER_UNIT_COMBAT_KIND.FLAME:
      return updateFlametrooper(game, unit, definition, dt);
    case PLAYER_UNIT_COMBAT_KIND.HEAL:
      return updateMedicSupport(game, unit, dt, definition, effect => emitEffect(game, effect)) ? 1 : 0;
    case PLAYER_UNIT_COMBAT_KIND.REPAIR:
      return (profile.repairer === 'engineer'
        ? updateEngineerRepair(game, unit, dt, definition, effect => emitEffect(game, effect))
        : updateRepairVehicleSupport(game, unit, dt, definition, effect => emitEffect(game, effect))) ? 1 : 0;
    case PLAYER_UNIT_COMBAT_KIND.SPOTTER:
      return updateSpotter(game, unit, definition);
    case PLAYER_UNIT_COMBAT_KIND.MINE_LAYER:
    case PLAYER_UNIT_COMBAT_KIND.NONE:
    default:
      return 0;
  }
}

const V25_PRIMARY_ROLES = new Set([
  'heavygunner', 'rocketeer', 'engineer', 'scout', 'sniper', 'flametrooper',
  'spotter', 'minelayer', 'mech', 'combatdrone', 'combatship',
]);
const V26_SPECIAL_ROLES = new Set(['tank', 'mobileartillery', 'repairvehicle']);

function updateRoleGroup(game, dt, predicate) {
  let actions = 0;
  for (const unit of game.state.entities.units || []) {
    if (predicate(getUnitRole(unit))) actions += updateUnitByProfile(game, unit, dt);
  }
  return actions;
}

export function updatePlayerUnitCombat(game, dt) {
  if (!game?.state?.entities) throw new Error('updatePlayerUnitCombat requires game.state.entities');
  const step = Number(dt);
  if (!Number.isFinite(step) || step < 0) throw new Error(`Invalid combat dt: ${dt}`);

  // Preserve the final effective wrapper ordering without reproducing its state
  // filtering/type-masquerade implementation: v25 roles, mines, v26 vehicles,
  // APC, Machinegun Car, then v47 Medic and Rifleman ownership.
  tickEnemyMarks(game, step);
  let actions = updateRoleGroup(game, step, role => V25_PRIMARY_ROLES.has(role));
  actions += updatePlayerMines(game, getUnitConfig('minelayer').mines, effect => emitEffect(game, effect));
  actions += updateRoleGroup(game, step, role => V26_SPECIAL_ROLES.has(role));
  actions += updateRoleGroup(game, step, role => role === 'apc');
  actions += updateRoleGroup(game, step, role => role === 'mgcar');
  actions += updateRoleGroup(game, step, role => role === 'medic');
  actions += updateRoleGroup(game, step, role => role === 'rifleman');
  return actions;
}

export function assertPlayerCombatCoverage() {
  const missing = Object.keys(UNIT_CONFIG).filter(role => !PLAYER_UNIT_COMBAT_PROFILES[role]);
  if (missing.length) throw new Error(`Missing player combat profile(s): ${missing.join(', ')}`);
  return true;
}
