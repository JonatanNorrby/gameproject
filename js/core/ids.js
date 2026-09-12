import { createIdFactory } from '../utils/helpers.js';

export const ID_PREFIX = Object.freeze({
  unit: 'u',
  enemy: 'e',
  structure: 's',
  tower: 't',
  wall: 'w',
  depot: 'd',
  playerMine: 'pm',
  resourceCache: 'cache-',
});

export function createEntityIdFactory(kind, options) {
  const prefix = ID_PREFIX[kind];
  if (!prefix) throw new Error(`Unknown entity ID kind: ${kind}`);
  return createIdFactory(prefix, options);
}
