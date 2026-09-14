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

## Step 1 — Economy / logistics runtime — IMPLEMENTED ON MIGRATION STACK

Production ownership moved to `js/economy/*` for:

- Crystal/Ore Mine extraction;
- Refinery Ore → Metal processing;
- Landing Pad / export ship cooldown, loading and export;
- Truck automatic service and route-stop service.

Still legacy after this step:

- build placement and construction UI;
- storage upgrade UI;
- route recording UI;
- rendering;
- enemy targeting/damage presentation;
- global frame/reset/input ownership.

The transitional bridge is `js/migration/economyLegacyBridge.js`. It exposes the existing legacy arrays/objects to the clean subsystem through live state views; it does not create a second economy state. Legacy fields such as `mine.stored`, `truck.cargo`, `pad.crystalStored`, `pad.shipHp` and `pad.shipState` remain aliases to clean runtime storage/state so old rendering and enemy code continue to work.

The production frame keeps its existing timing: Mine/Refinery/Pad simulation runs before unit movement, Truck servicing runs after unit movement.

## Step 2 — Navigation + movement commands — IMPLEMENTED ON MIGRATION STACK

Production ownership moved to:

- `js/navigation/pathfinding.js` for blockers, nearest-open destination repair and A*;
- `js/movement/movement.js` for destination assignment and waypoint following;
- `js/movement/runtime.js` for the production movement pass;
- `js/units/commands.js` for normal manual movement command semantics;
- `js/units/platoons.js` for Platoon formation move orders.

The Step 2 production bridge is `js/migration/navigationMovementLegacyBridge.js`, installed through the deterministic classic host `js/migration/navigationMovementLegacyHost.js`. The bridge uses live legacy arrays and state modifiers rather than creating a second movement state.

The old Prompt-5 `window.load` → injected classic script → dynamic module import handoff has been retired. Movement ownership is now installed deterministically after the legacy compatibility stack and START is gated until the clean owner has installed or explicitly fallen back.

Current behavior preserved in the clean production movement owner:

- v48 binary-heap A* and v51 nearest-open blocked-click repair;
- direct terrain-ignoring aircraft movement;
- failed reroutes retain the previous valid path;
- river slowdown for ground units;
- slowest-member Platoon movement speed;
- manual Truck orders cancel route ownership while logistics moves preserve it;
- Truck escort attachment offsets;
- APC transported-passenger position synchronization;
- APC support movement boost and follow positioning;
- Medic follow positioning;
- Restart state replacement through live state views.

Still legacy after Step 2:

- unit creation / purchase ownership and most unit lifecycle state;
- combat and support effect execution;
- route-recording UI and selection/input modes other than normal map movement;
- APC load/unload UI;
- rendering and camera;
- global reset/frame/bootstrap ownership.

## Step 3 — Movable units + player-unit combat — IMPLEMENTED ON MIGRATION STACK

Production ownership moved to:

- `js/units/deployment.js` for canonical movable-unit identity, creation and Main Base deployment;
- `js/units/transport.js` for APC load/unload state;
- `js/combat/unitCombat.js` for all player-unit attack/support decisions;
- `js/combat/healing.js`, `repair.js`, `playerDamage.js` and `unitMines.js` for clean support/damage behavior;
- unit-only cleanup from `js/combat/lifecycle.js` for player-unit destruction relationships and APC passenger ejection.

The Step 3 production bridge is `js/migration/unitCombatLegacyBridge.js`, installed through `js/migration/unitCombatLegacyHost.js`. It is a live view over the current legacy state and follows complete state replacement after Restart.

Step 3 deliberately does **not** add another movement owner. Navigation, paths, manual commands, support-follow movement and per-frame unit movement remain owned by Step 2.

The active legacy `updateUnitCombat` wrapper chain is replaced by one clean player-unit combat pass. This removes the live need for legacy unit-type masquerading and temporary `state.units` filtering while preserving final combat ordering and values for Riflemen, Heavy Gunners, Rocketeers, Medics, Engineers, Scouts, Snipers, Flamethrower Troopers, Spotters, Mine Layers, Mechs, Combat Drones, Combat Ships, Tanks, Mobile Artillery, Repair Vehicles, APCs and Machinegun Cars.

Compatibility boundaries in Step 3:

- clean persistent player shots are emitted into existing `state.bullets`; projectile travel/collision still has one legacy owner;
- clean combat effects are translated into the existing legacy effect arrays so rendering remains unchanged;
- current fog visibility and Saboteur reveal rules are consumed through compatibility callbacks rather than duplicated;
- unit purchases are captured before old v47/v53 purchase handlers so exactly one clean deployment path runs;
- APC load/unload buttons use clean transport state, while the rest of selected-unit UI remains legacy;
- clean unit death cleanup runs before the remaining legacy cleanup, which still owns enemy/structure lifecycle and rewards.

Safety fixes included with Step 3:

- a fully blocked Main Base deployment area now fails and refunds instead of using v47's unchecked fallback spawn point;
- voluntary APC unload now keeps the passenger loaded when no safe nearby point exists instead of forcing an unchecked fallback position;
- zero/negative HP is preserved as legitimate dead state during compatibility normalization and is never revived.

Still legacy after Step 3:

- enemy spawning, director, AI, status processing and enemy death/reward lifecycle;
- tower combat and tower projectile firing;
- projectile travel/collision/impact simulation;
- structure lifecycle;
- route-recording and most selection/action UI;
- rendering/camera/fog ownership;
- global reset/frame/bootstrap ownership.

## Step 4 — Enemies + director — IMPLEMENTED ON MIGRATION STACK

Production ownership moved to:

- `js/enemies/enemyDirector.js` for horde timing, threat scaling, queue/batch spawning and final v47 horde tuning;
- `js/enemies/enemySpawning.js` for canonical enemy construction and spawn placement;
- `js/enemies/enemyAi.js`, `enemyMovement.js`, `enemyTargeting.js` and `specialEnemies.js` for ordinary and special enemy behavior;
- `js/combat/statusEffects.js` / `js/enemies/enemyStatus.js` for enemy marks, burn, slow, corrosion timing and Saboteur cloak state;
- `js/enemies/enemyLifecycle.js` for enemy-only removal and Gold bounty ownership;
- `js/enemies/resourceCaches.js` for cache-guard AI.

The Step 4 production bridge is `js/migration/enemyLegacyBridge.js`, installed through `js/migration/enemyLegacyHost.js`. It keeps the original production frame ordering instead of collapsing director and actor work into one call: clean director processing runs at the existing `updateDirector()` call site and clean AI/lifecycle runs at the existing `updateEnemies()` call site.

The live global `hitEnemy` entry now delegates to clean player-damage semantics. Legacy towers and legacy projectile collision can therefore keep calling the same entry point without retaining a second enemy death/reward owner. Actual enemy removal and bounty payment happen once in the clean enemy lifecycle pass.

Compatibility boundaries in Step 4:

- tower target selection/firing is still legacy-owned;
- player/enemy projectile travel, collision and impact timing remain legacy-owned until Step 5;
- clean Spitter shots are emitted into the existing `state.enemyBullets` collection;
- enemy combat/effect presentation is translated into existing legacy effect arrays, so rendering remains unchanged;
- v47 resource-cache **capture/generation/reward** remains legacy-owned because it is closure-bound to the outer v47 frame wrapper; running the clean capture pass as well would double-advance the objective;
- resource-cache **guard AI** is clean-owned and legacy guard fields are normalized to the clean guard shape;
- the bridge follows complete state replacement after Restart and keeps `state.v47Director` as an alias-compatible view of the clean director state.

Safety fix included with Step 4:

- Burrower emergence now uses the full navigation blocker (Base, depots, buildings, Walls and terrain) and repairs a blocked intended exit to a nearby open point without exceeding the configured burrow distance. It can no longer emerge inside a solid world object simply because natural terrain was clear.

Still legacy after Step 4:

- tower combat and tower target-selection ownership;
- projectile travel/collision/impact simulation;
- structure destruction lifecycle;
- resource-cache capture/generation/reward;
- route-recording and most selection/action UI;
- rendering/camera/fog ownership;
- global reset/frame/bootstrap ownership.

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
