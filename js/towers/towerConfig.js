import { assertKnown, deepFreeze } from '../utils/helpers.js';

export const TOWER_TYPES = Object.freeze({
  LASER: 'laser',
  FLAME: 'flame',
  RAILGUN: 'railgun',
  TESLA: 'tesla',
  ANTI_AIR: 'antiair',
  CRYO: 'cryo',
  MORTAR: 'mortar',
  MINIGUN: 'minigun',
  MISSILE: 'missile',
  DRONE_BAY: 'dronebay',
});

function upgrade(cost, name, description, modifiers) {
  return { cost: { metal: cost }, name, description, modifiers };
}

function tower(id, displayName, values) {
  return { id, displayName, collisionRadius: 23, currency: 'metal', ...values };
}

export const TOWER_CONFIG = deepFreeze({
  laser: tower('laser', 'Laser Sniper', {
    placementRadius: 23, buildTime: 6.0, cost: { metal: 70 }, maxHp: 190,
    range: 400, fireInterval: 1.42, damage: 72, bulletSpeed: 1050, targeting: 'any',
    upgrades: {
      2: upgrade(45, 'Focus Optics', '+15% range, +40% damage, 10% faster fire.', { range: 1.15, damage: 1.40, fireInterval: 0.90, pierce: 1 }),
      3: upgrade(70, 'Prism Core', '+25% range, +75% damage, 18% faster fire, shots pierce 2 aliens.', { range: 1.25, damage: 1.75, fireInterval: 0.82, pierce: 2 }),
    },
    traits: ['tower', 'projectile'],
  }),
  flame: tower('flame', 'Flamethrower', {
    placementRadius: 23, buildTime: 5.0, cost: { metal: 55 }, maxHp: 170,
    range: 160, fireInterval: 0.11, targeting: 'any',
    burn: { tickDamage: 4.2, tickInterval: 0.28, duration: 3.1, targets: 1 },
    upgrades: {
      2: upgrade(35, 'Napalm Mix', '+16% range and ignites 2 aliens at once.', { range: 1.16, fireInterval: 1, targets: 2, burnDuration: 1.15 }),
      3: upgrade(55, 'Inferno Projector', '+28% range, 10% faster fire and ignites 4 aliens at once.', { range: 1.28, fireInterval: 0.90, targets: 4, burnDuration: 1.35 }),
    },
    traits: ['tower', 'burn'],
  }),
  railgun: tower('railgun', 'Railgun Tower', {
    placementRadius: 25, buildTime: 9.0, cost: { metal: 120 }, maxHp: 225,
    range: 620, fireInterval: 3.20, damage: 145, targeting: 'any',
    pierce: { width: 18, maxTargets: 3 },
    upgrades: {
      2: upgrade(75, 'Accelerator Rails', '+15% range, +45% damage and pierces up to 5 aliens.', { range: 1.15, damage: 1.45, fireInterval: 1, maxTargets: 5, pierceWidth: 1.12 }),
      3: upgrade(115, 'Hypervelocity Core', '+25% range, +85% damage, 18% faster fire and pierces up to 7 aliens.', { range: 1.25, damage: 1.85, fireInterval: 0.82, maxTargets: 7, pierceWidth: 1.25 }),
    },
    traits: ['tower', 'hitscan', 'piercing'],
  }),
  tesla: tower('tesla', 'Tesla Tower', {
    placementRadius: 24, buildTime: 7.0, cost: { metal: 95 }, maxHp: 210,
    range: 250, fireInterval: 0.85, damage: 21, targeting: 'any',
    chain: { count: 4, range: 120, damageMultiplier: 0.72 },
    upgrades: {
      2: upgrade(60, 'Arc Capacitors', '+14% range, +24% damage, stronger arcs and 5 chains.', { range: 1.14, damage: 1.24, fireInterval: 1, chains: 5, chainRange: 1.08, chainDamageMultiplier: 0.80 }),
      3: upgrade(90, 'Storm Core', '+24% range, +52% damage, 27% faster fire and 7 chains.', { range: 1.24, damage: 1.52, fireInterval: 0.73, chains: 7, chainRange: 1.16, chainDamageMultiplier: 0.86 }),
    },
    traits: ['tower', 'chain'],
  }),
  antiair: tower('antiair', 'Anti-Air Cannon', {
    placementRadius: 23, buildTime: 5.5, cost: { metal: 65 }, maxHp: 180,
    range: 370, fireInterval: 0.38, damage: 14, bulletSpeed: 1100, targeting: 'air',
    upgrades: {
      2: upgrade(40, 'Twin Autocannons', 'Fires 2 rounds per burst with +10% range. Excellent metal efficiency against Flyers.', { range: 1.10, damage: 1.08, fireInterval: 0.95, shots: 2, splash: 0 }),
      3: upgrade(65, 'Flak Matrix', 'Fires 3-round bursts and each hit damages nearby Flyers with flak splash.', { range: 1.18, damage: 1.22, fireInterval: 0.88, shots: 3, splash: 44 }),
    },
    traits: ['tower', 'projectile', 'antiAir'],
  }),
  cryo: tower('cryo', 'Cryo Tower', {
    placementRadius: 23, buildTime: 6.5, cost: { metal: 80 }, maxHp: 205,
    range: 235, fireInterval: 0.82, damage: 5, targeting: 'any',
    slow: { factor: 0.72, duration: 1.7, targets: 1 },
    upgrades: {
      2: upgrade(50, 'Deep Freeze Cells', 'Stronger slow, +18% range and chills 2 aliens at once.', { range: 1.18, damage: 1.25, fireInterval: 0.95, slowFactor: 0.58, slowDuration: 1.20, targets: 2 }),
      3: upgrade(75, 'Absolute Zero Pulse', 'Chills 4 aliens at once, nearly halving movement speed and dealing increased damage.', { range: 1.28, damage: 1.80, fireInterval: 0.86, slowFactor: 0.48, slowDuration: 1.40, targets: 4 }),
    },
    traits: ['tower', 'slow'],
  }),
  mortar: tower('mortar', 'Mortar Tower', {
    placementRadius: 24, buildTime: 8.0, cost: { metal: 105 }, maxHp: 195,
    range: 520, minRange: 105, fireInterval: 2.35, damage: 42, splashRadius: 72, targeting: 'ground',
    upgrades: {
      2: upgrade(65, 'High-Explosive Shells', '+30% damage and a much larger blast radius.', { range: 1.06, damage: 1.30, fireInterval: 0.94, splashRadius: 1.28, clusters: 0 }),
      3: upgrade(95, 'Cluster Payload', 'Main shell gains range and damage, then bursts into 3 secondary explosions.', { range: 1.15, damage: 1.65, fireInterval: 0.86, splashRadius: 1.35, clusters: 3 }),
    },
    traits: ['tower', 'artillery', 'splash'],
  }),
  minigun: tower('minigun', 'Minigun Tower', {
    placementRadius: 23, buildTime: 6.5, cost: { metal: 85 }, maxHp: 220,
    range: 245, fireInterval: 0.12, damage: 5.5, bulletSpeed: 900, targeting: 'any',
    upgrades: {
      2: upgrade(55, 'Powered Feed', '25% faster fire, +20% damage and improved range.', { range: 1.12, damage: 1.20, fireInterval: 0.75, barrels: 1 }),
      3: upgrade(80, 'Dual Rotary Mount', 'Two barrels fire together with higher damage and range.', { range: 1.22, damage: 1.45, fireInterval: 0.72, barrels: 2 }),
    },
    traits: ['tower', 'projectile'],
  }),
  missile: tower('missile', 'Missile Tower', {
    placementRadius: 25, buildTime: 9.0, cost: { metal: 125 }, maxHp: 215,
    range: 570, fireInterval: 2.25, damage: 82, splashRadius: 82, targeting: 'any',
    upgrades: {
      2: upgrade(75, 'Seeker Warhead', '+18% range, +35% damage and larger splash.', { range: 1.18, damage: 1.35, fireInterval: 0.94, splashRadius: 1.25, salvo: 1 }),
      3: upgrade(105, 'Tandem Rack', 'Launches 2 missiles per salvo with major splash and faster reload.', { range: 1.28, damage: 1.55, fireInterval: 0.82, splashRadius: 1.35, salvo: 2 }),
    },
    traits: ['tower', 'missile', 'splash'],
  }),
  dronebay: tower('dronebay', 'Drone Bay', {
    placementRadius: 27, buildTime: 10.0, cost: { metal: 110 }, maxHp: 245,
    range: 305, fireInterval: 0.56, damage: 8, bulletSpeed: 880, targeting: 'any', orbitRadius: 34,
    upgrades: {
      2: upgrade(70, 'Second Launch Rail', 'Deploys 2 defense drones with improved range and damage.', { range: 1.15, damage: 1.25, fireInterval: 0.94, drones: 2 }),
      3: upgrade(100, 'Autonomous Wing', 'Deploys 3 faster-firing defense drones covering a large area around the bay.', { range: 1.28, damage: 1.45, fireInterval: 0.82, drones: 3 }),
    },
    traits: ['tower', 'droneBay', 'projectile'],
  }),
});

export function normalizeTowerType(type) {
  return type;
}

export function getTowerConfig(type) {
  return assertKnown(TOWER_CONFIG, normalizeTowerType(type), 'tower type');
}

export function getTowerLevelStats(type, level = 1) {
  const c = getTowerConfig(type);
  const l = Math.max(1, Math.min(3, Number(level) || 1));
  if (l === 1) {
    return {
      range: c.range,
      minRange: c.minRange,
      damage: c.damage,
      fireInterval: c.fireInterval,
      targeting: c.targeting,
      pierce: c.pierce?.maxTargets,
      pierceWidth: c.pierce?.width,
      targets: c.burn?.targets ?? c.slow?.targets,
      burnDuration: c.burn?.duration,
      chains: c.chain?.count,
      chainRange: c.chain?.range,
      chainDamageMultiplier: c.chain?.damageMultiplier,
      slowFactor: c.slow?.factor,
      slowDuration: c.slow?.duration,
      splashRadius: c.splashRadius,
      shots: type === 'antiair' ? 1 : undefined,
      barrels: type === 'minigun' ? 1 : undefined,
      salvo: type === 'missile' ? 1 : undefined,
      drones: type === 'dronebay' ? 1 : undefined,
      clusters: type === 'mortar' ? 0 : undefined,
    };
  }
  const m = c.upgrades[l].modifiers;
  return {
    range: c.range * (m.range ?? 1),
    minRange: c.minRange,
    damage: c.damage === undefined ? undefined : c.damage * (m.damage ?? 1),
    fireInterval: c.fireInterval * (m.fireInterval ?? 1),
    targeting: c.targeting,
    pierce: m.pierce ?? m.maxTargets ?? c.pierce?.maxTargets,
    pierceWidth: c.pierce ? c.pierce.width * (m.pierceWidth ?? 1) : undefined,
    targets: m.targets ?? c.burn?.targets ?? c.slow?.targets,
    burnDuration: c.burn ? c.burn.duration * (m.burnDuration ?? 1) : undefined,
    chains: m.chains ?? c.chain?.count,
    chainRange: c.chain ? c.chain.range * (m.chainRange ?? 1) : undefined,
    chainDamageMultiplier: m.chainDamageMultiplier ?? c.chain?.damageMultiplier,
    slowFactor: m.slowFactor ?? c.slow?.factor,
    slowDuration: c.slow ? c.slow.duration * (m.slowDuration ?? 1) : undefined,
    splashRadius: c.splashRadius === undefined ? m.splash : c.splashRadius * (m.splashRadius ?? 1),
    shots: m.shots,
    barrels: m.barrels,
    salvo: m.salvo,
    drones: m.drones,
    clusters: m.clusters,
  };
}
