export const RESOURCE_TYPES = Object.freeze({
  GOLD: 'gold',
  METAL: 'metal',
  CRYSTAL: 'crystal',
  ORE: 'ore',
});

const WALLET_TYPES = new Set([RESOURCE_TYPES.GOLD, RESOURCE_TYPES.METAL]);
const PHYSICAL_TYPES = new Set([RESOURCE_TYPES.CRYSTAL, RESOURCE_TYPES.ORE]);
const EPSILON = 1e-9;

function assertResourceType(type) {
  if (!Object.values(RESOURCE_TYPES).includes(type)) throw new Error(`Unknown resource type: ${type}`);
  return type;
}

function assertWalletType(type) {
  assertResourceType(type);
  if (!WALLET_TYPES.has(type)) throw new Error(`${type} is a physical logistics resource, not a global wallet resource`);
  return type;
}

function finiteNonNegative(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : fallback;
}

export function getResource(game, type) {
  assertWalletType(type);
  return finiteNonNegative(game?.state?.resources?.[type]);
}

export function addResource(game, type, amount) {
  assertWalletType(type);
  const value = Number(amount);
  if (!Number.isFinite(value) || value < 0) throw new TypeError('Resource addition must be a finite non-negative number');
  if (type === RESOURCE_TYPES.GOLD && game?.state?.debug?.unlimitedCash) return getResource(game, type);
  if (!game?.state?.resources) throw new TypeError('Game resource state is required');
  game.state.resources[type] = getResource(game, type) + value;
  return game.state.resources[type];
}

function normalizedCost(cost = {}) {
  const out = {};
  for (const [type, raw] of Object.entries(cost || {})) {
    assertWalletType(type);
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount < 0) throw new TypeError(`Invalid ${type} cost`);
    if (amount > 0) out[type] = amount;
  }
  return out;
}

export function canAfford(game, cost) {
  for (const [type, amount] of Object.entries(normalizedCost(cost))) {
    if (type === RESOURCE_TYPES.GOLD && game?.state?.debug?.unlimitedCash) continue;
    if (getResource(game, type) + EPSILON < amount) return false;
  }
  return true;
}

export function spendResources(game, cost) {
  const normalized = normalizedCost(cost);
  if (!canAfford(game, normalized)) return false;
  for (const [type, amount] of Object.entries(normalized)) {
    if (type === RESOURCE_TYPES.GOLD && game?.state?.debug?.unlimitedCash) continue;
    game.state.resources[type] = Math.max(0, getResource(game, type) - amount);
  }
  return true;
}

export function refundResources(game, cost) {
  const normalized = normalizedCost(cost);
  for (const [type, amount] of Object.entries(normalized)) addResource(game, type, amount);
  return true;
}

export function createResourceStore(type = null, amount = 0, { lockedType = type !== null } = {}) {
  if (type !== null && !PHYSICAL_TYPES.has(assertResourceType(type))) throw new Error(`${type} cannot be stored in a logistics container`);
  return {
    type,
    amount: finiteNonNegative(amount),
    lockedType: Boolean(lockedType),
  };
}

export function getStoredResource(store, type = null) {
  if (!store) return 0;
  if (type !== null) {
    assertResourceType(type);
    if (store.type !== type) return 0;
  }
  return finiteNonNegative(store.amount);
}

export function setStoredResource(store, type, amount, { capacity = Infinity } = {}) {
  if (!store) throw new TypeError('Resource store is required');
  if (!PHYSICAL_TYPES.has(assertResourceType(type))) throw new Error(`${type} cannot be stored physically`);
  if (store.type && store.type !== type) throw new Error(`Store already contains ${store.type}`);
  const cap = Number.isFinite(Number(capacity)) ? Math.max(0, Number(capacity)) : Infinity;
  store.type = store.type || type;
  store.amount = Math.min(cap, finiteNonNegative(amount));
  if (store.amount <= EPSILON && !store.lockedType) {
    store.amount = 0;
    store.type = null;
  }
  return store.amount;
}

export function addStoredResource(store, type, amount, { capacity = Infinity } = {}) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value < 0) throw new TypeError('Stored-resource addition must be non-negative');
  return setStoredResource(store, type, getStoredResource(store, type) + value, { capacity });
}

export function removeStoredResource(store, type, amount = Infinity) {
  if (!store || store.type !== type) return 0;
  const request = Number.isFinite(Number(amount)) ? Math.max(0, Number(amount)) : Infinity;
  const removed = Math.min(getStoredResource(store, type), request);
  store.amount = Math.max(0, getStoredResource(store, type) - removed);
  if (store.amount <= EPSILON) {
    store.amount = 0;
    if (!store.lockedType) store.type = null;
  }
  return removed;
}

export function transferResource({ from, to, type, amount = Infinity, toCapacity = Infinity }) {
  if (!from || !to) return 0;
  if (!PHYSICAL_TYPES.has(assertResourceType(type))) throw new Error(`${type} is not a transferable physical resource`);
  if (from.type !== type || (to.type && to.type !== type)) return 0;
  const request = Number.isFinite(Number(amount)) ? Math.max(0, Number(amount)) : Infinity;
  const cap = Number.isFinite(Number(toCapacity)) ? Math.max(0, Number(toCapacity)) : Infinity;
  const available = getStoredResource(from, type);
  const room = Math.max(0, cap - getStoredResource(to, type));
  const moved = Math.min(request, available, room);
  if (moved <= EPSILON) return 0;
  removeStoredResource(from, type, moved);
  addStoredResource(to, type, moved, { capacity: cap });
  return moved;
}

export function discardStoredResource(store, type, amount = Infinity) {
  return removeStoredResource(store, type, amount);
}
