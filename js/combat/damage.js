export function hasFiniteHp(entity) {
  return Boolean(entity) && Number.isFinite(Number(entity.hp));
}

export function isAlive(entity) {
  return hasFiniteHp(entity) && Number(entity.hp) > 0;
}

export function isDamageable(entity) {
  return isAlive(entity);
}

export function applyDamage(game, target, amount, context = {}) {
  if (!hasFiniteHp(target)) {
    return { applied: false, destroyed: false, reason: 'invalid-target' };
  }

  const previousHp = Number(target.hp);
  if (previousHp <= 0) {
    return { applied: false, destroyed: true, reason: 'already-dead', previousHp, hp: previousHp };
  }

  const damage = Number(amount);
  if (!Number.isFinite(damage) || damage <= 0) {
    return { applied: false, destroyed: false, reason: 'invalid-damage', previousHp, hp: previousHp };
  }

  // The active legacy runtime allows overkill to carry HP below zero. Preserve
  // that threshold behavior rather than clamping to zero in the foundation.
  const hp = previousHp - damage;
  target.hp = hp;
  const destroyed = hp <= 0;
  const result = { applied: true, amount: damage, previousHp, hp, destroyed };

  // Lifecycle owners (enemy rewards/removal, Base game-over, transport cleanup,
  // export-ship cargo loss, etc.) remain outside this module. Callers may bridge
  // their current lifecycle explicitly while those systems are still legacy.
  if (destroyed && typeof context.onDestroyed === 'function') {
    context.onDestroyed(game, target, result, context);
  }

  return result;
}
