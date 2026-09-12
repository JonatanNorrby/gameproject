export function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

export function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

export function assertKnown(registry, id, kind) {
  const value = registry[id];
  if (!value) throw new Error(`Unknown ${kind}: ${id}`);
  return value;
}

export function createIdFactory(prefix, { now = Date.now, random = Math.random } = {}) {
  if (!prefix) throw new TypeError('ID prefix is required');
  return () => `${prefix}${now()}-${random().toString(36).slice(2)}`;
}
