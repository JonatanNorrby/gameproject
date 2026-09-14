# Production Runtime Migration Plan

## Goal

Replace the accumulated `v14`–`v53` production monkey-patch chain with the clean `js/` runtime **incrementally**, without a big-bang rewrite and without changing game balance or intended behavior during migration.

Each step must leave the game playable. A subsystem is considered migrated only when:

1. production calls the clean implementation;
2. legacy state/UI compatibility is explicit and isolated in `js/migration/`;
3. regression tests cover the production adapter and clean subsystem;
4. there is one authoritative simulation owner for the migrated behavior;
5. the next migration step can be reverted independently.

No new gameplay feature should create another `vNN.js` ownership layer for a subsystem that has already been migrated.

## Step 1 — Economy / logistics runtime — IN PROGRESS

Production ownership being moved to `js/economy/*`:

- Crystal/Ore Mine extraction;
- Refinery Ore → Metal processing;
- Landing Pad / export ship cooldown, loading and export;
- Truck automatic service and route-stop service.

Still legacy in this step:

- build placement and construction UI;
- storage upgrade UI;
- route recording UI;
- rendering;
- enemy targeting/damage presentation;
- global frame/reset/input ownership.

The transitional bridge is `js/migration/economyLegacyBridge.js`. It exposes the existing legacy arrays/objects to the clean subsystem through live state views; it does not create a second economy state. Legacy fields such as `mine.stored`, `truck.cargo`, `pad.crystalStored`, `pad.shipHp` and `pad.shipState` remain aliases to clean runtime storage/state so old rendering and enemy code continue to work.

The production frame keeps its existing timing: Mine/Refinery/Pad simulation runs before unit movement, Truck servicing runs after unit movement.

## Step 2 — Navigation + movement commands

Move all player/logistics/support movement to:

- `js/navigation/*`;
- `js/movement/*`;
- `js/units/commands.js`;
- `js/units/platoons.js`.

Remove the asynchronous Prompt-5 manual-move bridge and legacy `setUnitDestination`/path ownership. Preserve current route, Platoon, support-follow and aircraft behavior.

## Step 3 — Movable units + player-unit combat

Move unit identity, creation, movement update and combat/support behavior to:

- `js/units/*`;
- `js/combat/playerUnitCombat.js` and shared combat foundations.

Remove unit-type masquerading and temporary `state.units` filtering used by legacy compatibility layers.

## Step 4 — Enemies + director

Move spawning, horde director, targeting, special AI, status effects and lifecycle to:

- `js/enemies/*`.

Remove the accumulated `spawnEnemy`, `updateEnemies`, special-enemy and spatial-grid overrides.

## Step 5 — Towers + projectiles/combat

Move tower stats, target selection, tower combat, projectile resolution and damage ownership to:

- `js/towers/*`;
- `js/combat/*`.

Eliminate tower wrappers inherited from v21/v22 and remove temporary global-array filtering.

## Step 6 — Buildings, placement and Walls

Move economic-building creation, construction, storage upgrades, Wall geometry and placement validation to:

- `js/buildings/*`;
- clean placement/navigation geometry helpers.

At the end of this step, economy/buildings should no longer require a legacy compatibility adapter.

## Step 7 — Fog, rendering, assets and camera

Move the final visual/runtime owners to:

- `js/fog/*`;
- `js/rendering/*`;
- `js/assets/*`;
- clean camera/viewport code.

Rendering must become read-only with simulation-owned effect expiry.

## Step 8 — Input, UI, bootstrap and reset

Move input dispatch, menu actions, reset/state initialization and the animation/update pipeline to the clean runtime.

Then:

- load one production entry module from `index.html`;
- remove the legacy `v14`–`v53` script chain from production;
- archive obsolete historical patch files outside the active web runtime;
- delete transitional `js/migration/*` bridges once no longer needed.

## Regression rule

`npm test` is the baseline check for every migration step. CI runs the full committed Node test suite on every push and pull request. Browser-level production-stack smoke tests should be added as the bootstrap/input layer is migrated so the final cutover is covered end-to-end.
