import { getEnemyRadius, getEntityRadius, getUnitRole } from '../core/entities.js';
import { applyDamage, isAlive } from './damage.js';
import { applyPlayerEnemyDamage } from './playerDamage.js';
import { damageLandingPadOrShip } from '../economy/landingPads.js';

export const PROJECTILE_TEAM = Object.freeze({ PLAYER: 'player', ENEMY: 'enemy' });

function projectileList(game) {
  const list = game?.state?.entities?.projectiles;
  if (!Array.isArray(list)) throw new TypeError('game.state.entities.projectiles is required');
  return list;
}

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function emitProjectile(game, spec = {}) {
  const projectile = {
    team: spec.team === PROJECTILE_TEAM.ENEMY ? PROJECTILE_TEAM.ENEMY : PROJECTILE_TEAM.PLAYER,
    // Do not sanitize invalid coordinates into a valid origin: final v47 drops
    // non-finite projectiles during simulation instead of teleporting them.
    x: Number(spec.x), y: Number(spec.y),
    vx: Number(spec.vx), vy: Number(spec.vy),
    dmg: Math.max(0, finite(spec.dmg ?? spec.damage)),
    life: Math.max(0, finite(spec.life, spec.team === PROJECTILE_TEAM.ENEMY ? 3 : 2.2)),
    type: spec.type || 'projectile',
    sourceId: spec.sourceId ?? null,
    target: spec.target ?? null,
  };
  projectileList(game).push(projectile);
  return projectile;
}

export function emitPlayerProjectile(game, spec = {}) {
  return emitProjectile(game, { ...spec, team: PROJECTILE_TEAM.PLAYER, life: spec.life ?? 2.2 });
}

export function emitEnemyProjectile(game, spec = {}) {
  return emitProjectile(game, { ...spec, team: PROJECTILE_TEAM.ENEMY, life: spec.life ?? 3 });
}

function enemyRadius(enemy) {
  if (Number.isFinite(Number(enemy?.r))) return Math.max(0, Number(enemy.r));
  try { return Math.max(0, Number(getEnemyRadius(enemy)) || 0); } catch { return 8; }
}

function targetRadius(target) {
  try { return Math.max(0, Number(getEntityRadius(target)) || 0); }
  catch { return Math.max(0, Number(target?.r ?? target?.radius ?? target?.collisionRadius) || 20); }
}

function playerProjectileImpact(game, projectile) {
  for (const enemy of game?.state?.entities?.enemies || []) {
    if (!isAlive(enemy) || !Number.isFinite(enemy.x) || !Number.isFinite(enemy.y)) continue;
    const radius = enemyRadius(enemy) + 5;
    const dx = projectile.x - enemy.x, dy = projectile.y - enemy.y;
    if (dx * dx + dy * dy >= radius * radius) continue;
    applyPlayerEnemyDamage(game, enemy, projectile.dmg, {
      sourceId: projectile.sourceId,
      attackKind: projectile.type,
    });
    return enemy;
  }
  return null;
}

function enemyTargetStillValid(game, target) {
  if (!target) return false;
  const entities = game?.state?.entities;
  return Boolean(entities?.units?.includes(target) || entities?.structures?.includes(target));
}

function enemyProjectileImpact(game, projectile) {
  const target = projectile.target;
  if (!enemyTargetStillValid(game, target)) return { consumed: true, hit: null };
  if (getUnitRole(target) === 'spotter') return { consumed: true, hit: null };
  if (!Number.isFinite(target.x) || !Number.isFinite(target.y)) return { consumed: false, hit: null };
  const radius = targetRadius(target) + 5;
  const dx = projectile.x - target.x, dy = projectile.y - target.y;
  if (dx * dx + dy * dy >= radius * radius) return { consumed: false, hit: null };

  if (target.type === 'landingpad') {
    damageLandingPadOrShip(game, target, projectile.dmg, { attackKind: projectile.type, sourceId: projectile.sourceId });
  } else {
    applyDamage(game, target, projectile.dmg, { sourceId: projectile.sourceId, attackKind: projectile.type });
  }
  return { consumed: true, hit: target };
}

// Production still stores player and enemy shots in separate legacy arrays so the
// existing renderer can draw them differently. Step 5 routes both arrays through
// this one simulator instead of retaining two legacy collision implementations.
// `forcedTeam` is only a storage-compatibility hint; the normal clean runtime keeps
// team identity on each projectile and calls updateProjectiles() below.
export function updateProjectileCollection(game, dt, projectiles, forcedTeam = null) {
  if (!Array.isArray(projectiles)) throw new TypeError('projectile collection must be an array');
  const step = Math.max(0, Number(dt) || 0);
  const team = forcedTeam === PROJECTILE_TEAM.ENEMY || forcedTeam === PROJECTILE_TEAM.PLAYER
    ? forcedTeam
    : null;
  let removed = 0, hits = 0;
  for (let index = projectiles.length - 1; index >= 0; index--) {
    const projectile = projectiles[index];
    if (team) projectile.team = team;
    projectile.x += finite(projectile.vx) * step;
    projectile.y += finite(projectile.vy) * step;
    projectile.life = finite(projectile.life) - step;
    if (projectile.life <= 0 || !Number.isFinite(projectile.x) || !Number.isFinite(projectile.y)) {
      projectiles.splice(index, 1); removed++; continue;
    }
    if (projectile.team === PROJECTILE_TEAM.ENEMY) {
      const result = enemyProjectileImpact(game, projectile);
      if (result.hit) hits++;
      if (result.consumed) { projectiles.splice(index, 1); removed++; }
    } else {
      const hit = playerProjectileImpact(game, projectile);
      if (hit) { hits++; projectiles.splice(index, 1); removed++; }
    }
  }
  return { hits, removed, active: projectiles.length };
}

export function updateProjectiles(game, dt) {
  return updateProjectileCollection(game, dt, projectileList(game));
}
