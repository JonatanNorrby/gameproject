export function tickCooldown(cooldown, dt) {
  const current = Number.isFinite(Number(cooldown)) ? Number(cooldown) : 0;
  const delta = Number(dt);
  if (!Number.isFinite(delta) || delta < 0) return current;
  // Legacy attack loops let cooldowns run below zero and test `> 0` to wait.
  return current - delta;
}

export function isCooldownReady(cooldown) {
  const value = Number(cooldown);
  return !Number.isFinite(value) || value <= 0;
}

export function resetCooldown(duration) {
  const value = Number(duration);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}
