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
