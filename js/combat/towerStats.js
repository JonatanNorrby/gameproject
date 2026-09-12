import { getTowerConfig, getTowerLevelStats } from '../towers/towerConfig.js';

export const MAX_TOWER_LEVEL = 3;

export function getTowerLevel(tower, levelOverride = null) {
  const raw = levelOverride ?? (typeof tower === 'object' ? tower?.level : 1);
  return Math.max(1, Math.min(MAX_TOWER_LEVEL, Math.floor(Number(raw) || 1)));
}

export function getEffectiveTowerStats(towerOrType, levelOverride = null) {
  const type = typeof towerOrType === 'string' ? towerOrType : towerOrType?.type;
  const level = getTowerLevel(towerOrType, levelOverride);
  const base = getTowerConfig(type);
  const leveled = getTowerLevelStats(type, level);
  // v21's live Laser progression is projectile at 1/3 and 2/3, then a 2-target
  // prism line at 3/3. The older LASER.MAX_TARGETS field is not its upgrade pierce.
  const laserPierce = type === 'laser' ? (level === 3 ? 2 : 1) : leveled.pierce;
  const acquiredUpgrade = level > 1 ? base.upgrades?.[level] : null;
  const nextUpgrade = level < MAX_TOWER_LEVEL ? base.upgrades?.[level + 1] : null;

  return {
    type,
    level,
    maxLevel: MAX_TOWER_LEVEL,
    range: leveled.range,
    minRange: leveled.minRange ?? 0,
    damage: leveled.damage,
    fireInterval: leveled.fireInterval,
    targeting: leveled.targeting,
    bulletSpeed: base.bulletSpeed,
    pierce: laserPierce,
    pierceWidth: leveled.pierceWidth,
    targets: leveled.targets,
    burnTickDamage: base.burn?.tickDamage,
    burnTickInterval: base.burn?.tickInterval,
    burnDuration: leveled.burnDuration,
    chains: leveled.chains,
    chainRange: leveled.chainRange,
    chainDamageMultiplier: leveled.chainDamageMultiplier,
    slowFactor: leveled.slowFactor,
    slowDuration: leveled.slowDuration,
    splashRadius: leveled.splashRadius,
    shots: leveled.shots,
    barrels: leveled.barrels,
    salvo: leveled.salvo,
    drones: leveled.drones,
    clusters: leveled.clusters,
    orbitRadius: base.orbitRadius,
    upgradeCost: Number(acquiredUpgrade?.cost?.metal) || 0,
    nextUpgradeCost: Number(nextUpgrade?.cost?.metal) || 0,
    upgradeName: acquiredUpgrade?.name ?? null,
    nextUpgradeName: nextUpgrade?.name ?? null,
  };
}
