import { isRepairableUnit } from '../core/entities.js';
import { squaredDistance } from '../utils/math.js';
import { isAlive } from './damage.js';

function validStructure(target) {
  return Boolean(target?.built) && isAlive(target) && Number.isFinite(Number(target.maxHp)) && Number(target.maxHp) > 0;
}

function validRepairableUnit(target) {
  return isAlive(target) && isRepairableUnit(target) && !target.transportedIn && !target.garrisonedIn
    && Number.isFinite(Number(target.maxHp)) && Number(target.maxHp) > 0;
}

export function isValidRepairTarget(target) {
  return validStructure(target) || validRepairableUnit(target);
}

export function applyRepair(_game, repairer, target, amount) {
  if (!repairer || !isValidRepairTarget(target)) return { applied: false, reason: 'invalid-target' };
  const maxHp = Number(target.maxHp);
  const currentHp = Number(target.hp);
  const repair = Number(amount);
  if (currentHp >= maxHp) return { applied: false, reason: 'full-health' };
  if (!Number.isFinite(repair) || repair <= 0) return { applied: false, reason: 'invalid-repair' };
  const hp = Math.min(maxHp, currentHp + repair);
  target.hp = hp;
  return { applied: hp > currentHp, previousHp: currentHp, hp, amount: hp - currentHp };
}

function repairCandidates(game, repairer) {
  const structures = (game?.state?.entities?.structures || []).filter(validStructure);
  const units = (game?.state?.entities?.units || []).filter(target => target !== repairer && validRepairableUnit(target));
  return [...structures, ...units];
}

export function findEngineerRepairTarget(game, engineer, range) {
  const maximum = Number(range);
  if (!isAlive(engineer) || !Number.isFinite(maximum) || maximum < 0) return null;
  const max2 = maximum * maximum;
  let best = null;
  let bestRatio = 1;
  for (const target of repairCandidates(game, engineer)) {
    if (Number(target.hp) >= Number(target.maxHp)) continue;
    if (squaredDistance(engineer.x, engineer.y, target.x, target.y) > max2) continue;
    const ratio = Number(target.hp) / Number(target.maxHp);
    if (ratio < bestRatio) {
      best = target;
      bestRatio = ratio;
    }
  }
  return best;
}

export function findRepairVehicleTarget(game, repairVehicle, range) {
  const maximum = Number(range);
  if (!isAlive(repairVehicle) || !Number.isFinite(maximum) || maximum < 0) return null;
  let best = null;
  let bestRatio = 1;
  let bestDistance = maximum;
  for (const target of repairCandidates(game, repairVehicle)) {
    if (Number(target.hp) >= Number(target.maxHp)) continue;
    const distance = Math.hypot(target.x - repairVehicle.x, target.y - repairVehicle.y);
    const ratio = Number(target.hp) / Number(target.maxHp);
    if (distance <= bestDistance && (ratio < bestRatio - 0.001 || (!best && ratio < 1))) {
      best = target;
      bestRatio = ratio;
      bestDistance = distance;
    }
  }
  return best;
}

function updateRepair(game, repairer, dt, definition, findTarget, fxKind, fxCooldown, emitEffect) {
  const repair = definition?.repair;
  if (!repair || !isAlive(repairer) || repairer.transportedIn || repairer.garrisonedIn) return false;
  repairer.repairFxCooldown = Math.max(0, (Number(repairer.repairFxCooldown) || 0) - dt);
  const target = findTarget(game, repairer, repair.range);
  if (!target) return false;
  const result = applyRepair(game, repairer, target, repair.perSecond * dt);
  if (!result.applied) return false;
  if (repairer.repairFxCooldown <= 0) {
    emitEffect({ kind: fxKind, x1: repairer.x, y1: repairer.y, x2: target.x, y2: target.y, durationMs: 170, legacyChannel: fxKind === 'repair' ? 'v25Effects' : 'v26Effects' });
    repairer.repairFxCooldown = fxCooldown;
  }
  return true;
}

export function updateEngineerRepair(game, engineer, dt, definition, emitEffect = () => {}) {
  return updateRepair(game, engineer, dt, definition, findEngineerRepairTarget, 'repair', 0.30, emitEffect);
}

export function updateRepairVehicleSupport(game, vehicle, dt, definition, emitEffect = () => {}) {
  return updateRepair(game, vehicle, dt, definition, findRepairVehicleTarget, 'repairvehicle', 0.28, emitEffect);
}
