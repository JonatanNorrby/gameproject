import { MIGRATION_STATUS } from '../core/config.js';

export const VISUAL_EFFECT_SYSTEM_STATUS = MIGRATION_STATUS.MIGRATED;
export const VISUAL_EFFECT_CHANNELS = Object.freeze([
  'v17Effects',
  'v21Effects',
  'v22Effects',
  'v24Effects',
  'v25Effects',
  'v26Effects',
]);

function stateOf(value) {
  return value?.state?.legacy || value?.state || value || {};
}

export function pruneExpiredVisualEffects(value, now, channels = VISUAL_EFFECT_CHANNELS) {
  const state = stateOf(value);
  const time = Number(now);
  if (!Number.isFinite(time)) throw new TypeError('Visual-effect expiry requires a finite clock value');
  let removed = 0;
  for (const name of channels) {
    const current = state?.[name];
    if (!Array.isArray(current)) continue;
    const next = current.filter(effect => (Number(effect?.expires) || 0) > time);
    removed += current.length - next.length;
    if (next.length !== current.length) state[name] = next;
  }
  return removed;
}

// Final clean-runtime effects are emitted by combat systems into
// state.entities.effects with a duration rather than one of the historical
// v17/v21/... channels. Timestamp ownership lives here, on the update side, so
// rendering never mutates or prunes simulation/presentation state.
export function updateVisualEffects(game, now) {
  const effects = game?.state?.entities?.effects;
  const time = Number(now);
  if (!Number.isFinite(time)) throw new TypeError('Visual-effect update requires a finite clock value');
  if (!Array.isArray(effects)) return { active: 0, removed: 0, initialized: 0 };

  let removed = 0;
  let initialized = 0;
  for (let index = effects.length - 1; index >= 0; index--) {
    const effect = effects[index];
    if (!effect || typeof effect !== 'object') {
      effects.splice(index, 1); removed++;
      continue;
    }

    let expires = Number(effect.expires);
    if (!Number.isFinite(expires)) {
      const duration = Number(effect.durationMs);
      if (!Number.isFinite(duration) || duration <= 0) {
        effects.splice(index, 1); removed++;
        continue;
      }
      if (!Number.isFinite(Number(effect.createdAt))) effect.createdAt = time;
      expires = Number(effect.createdAt) + duration;
      effect.expires = expires;
      initialized++;
    }

    if (!Number.isFinite(expires) || expires <= time) {
      effects.splice(index, 1); removed++;
    }
  }
  return { active: effects.length, removed, initialized };
}
