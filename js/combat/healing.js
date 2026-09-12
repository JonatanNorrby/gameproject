import { isHealableUnit } from '../core/entities.js';
import { squaredDistance } from '../utils/math.js';
import { isAlive } from './damage.js';

function activeHealableTarget(unit) {
  return isAlive(unit) && isHealableUnit(unit) && !unit.transportedIn && !unit.garrisonedIn;
}

export function applyHealing(_game, healer, target, amount) {
  if (!healer || !activeHealableTarget(target)) return { applied: false, reason: 'invalid-target' };
  const maxHp = Number(target.maxHp);
  const currentHp = Number(target.hp);
  const healing = Number(amount);
  if (!Number.isFinite(maxHp) || maxHp <= 0 || !Number.isFinite(currentHp) || currentHp >= maxHp) return { applied: false, reason: 'full-health' };
  if (!Number.isFinite(healing) || healing <= 0) return { applied: false, reason: 'invalid-healing' };
  const hp = Math.min(maxHp, currentHp + healing);
  target.hp = hp;
  return { applied: hp > currentHp, previousHp: currentHp, hp, amount: hp - currentHp };
}

export function findMedicHealTarget(game, medic, range) {
  const maximum = Number(range);
  if (!isAlive(medic) || !Number.isFinite(maximum) || maximum < 0) return null;
  const max2 = maximum * maximum;
  let best = null;
  let bestRatio = 1;
  let bestDistance = Infinity;
  for (const target of game?.state?.entities?.units || []) {
    if (target === medic || !activeHealableTarget(target)) continue;
    const maxHp = Number(target.maxHp);
    if (!Number.isFinite(maxHp) || maxHp <= 0 || Number(target.hp) >= maxHp) continue;
    const d2 = squaredDistance(medic.x, medic.y, target.x, target.y);
    if (d2 > max2) continue;
    const ratio = Number(target.hp) / maxHp;
    if (ratio < bestRatio || (Math.abs(ratio - bestRatio) < 1e-9 && d2 < bestDistance)) {
      best = target;
      bestRatio = ratio;
      bestDistance = d2;
    }
  }
  return best;
}

export function updateMedicSupport(game, medic, dt, definition, emitEffect = () => {}) {
  const healing = definition?.healing;
  if (!healing || !isAlive(medic) || medic.transportedIn || medic.garrisonedIn) return false;
  const target = findMedicHealTarget(game, medic, healing.range);
  if (!target) return false;
  const result = applyHealing(game, medic, target, healing.perSecond * dt);
  if (!result.applied) return false;
  medic.healFxCooldown = Math.max(0, (Number(medic.healFxCooldown) || 0) - dt);
  if (medic.healFxCooldown <= 0) {
    emitEffect({ kind: 'heal', x1: medic.x, y1: medic.y, x2: target.x, y2: target.y, durationMs: 150, legacyChannel: 'v17Effects' });
    medic.healFxCooldown = 0.28;
  }
  return true;
}
