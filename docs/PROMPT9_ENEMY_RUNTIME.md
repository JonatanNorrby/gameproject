# Prompt 9 — Clean Enemy Runtime

## Scope and activation status

Prompt 9 completes the clean enemy subsystem under `js/enemies/` but does **not** activate it in production. `index.html` continues to load the historical runtime until a later integration/cutover phase. No economy, building-placement, fog, camera, UI, renderer, input-listener, global game-loop or reset migration is part of this work.

## Ownership

- `js/enemies/enemies.js` — authoritative clean enemy subsystem update and initialization entry point.
- `js/enemies/enemyDirector.js` — horde timing, wave progression, threat scaling, composition selection and spawn scheduling.
- `js/enemies/enemySpawning.js` — canonical enemy construction plus edge/horde placement.
- `js/enemies/enemyAi.js` — one handler registry for all 13 canonical enemy records.
- `js/enemies/specialEnemies.js` — special behavior strategies for Siege Beast, Burrower, Climber, Acid Lobber, Crusher, Harvester Hunter and Saboteur.
- `js/enemies/enemyTargeting.js` — ordinary/strategic target acquisition plus cache capture/guard eligibility.
- `js/enemies/enemyMovement.js` — normal enemy steering, terrain-only direct motion and cache-guard motion.
- `js/enemies/enemyCombat.js` — shared Prompt-6 damage/range integration, melee, Spitter projectile emission, Acid damage and Base impact.
- `js/enemies/enemyStatus.js` — burn, Cryo slow, Acid corrosion timer and Saboteur cloak/reveal updates.
- `js/enemies/enemyLifecycle.js` — one-time enemy removal/bounty handoff.
- `js/enemies/resourceCaches.js` — cache generation, guard spawning/defense/leash, contest rules, capture progress and cache reward handoff.
- `js/navigation/terrain.js` / `pathfinding.js` — shared collision predicates. Cache guards use the full v48-style blocker; enemy behaviors that intentionally use terrain-only movement call the narrow terrain predicate.

## Authoritative update order

`updateEnemies(game, dt)` performs the clean enemy work in this order:

1. ensure enemy runtime/director/cache initialization;
2. update horde director and emit any scheduled spawn batch;
3. tick structure corrosion;
4. tick statuses for each non-cache enemy;
5. run exactly one AI handler for that enemy;
6. resolve Base impact for non-lured/non-attacking enemies;
7. update cache guards through their defend/leash policy;
8. remove dead enemies once and grant the existing bounty handoff once;
9. update cache activation/contest/capture after dead guards are gone.

The clean owner never calls legacy `updateEnemies()` and installs no production wrapper.

## Director parity

Current effective v47 horde behavior is preserved:

- first horde: 26 seconds;
- base gap: 48 seconds;
- minimum gap: 36 seconds;
- gap drop: 1.2 seconds per elapsed minute;
- starting size: 34;
- size growth: +6 per elapsed minute;
- base size cap: 100;
- final threat-scaled cap: 220;
- batch size: 5;
- batch interval: 0.50 seconds;
- radius: 1500, growing 0.85 px/sec to 2350;
- spawn arc: 0.62 radians;
- radial jitter: 300;
- horde Flyer cap: 6%;
- horde Spitter chance: 3%;
- horde special chance: 5% → 18% over 600 seconds;
- current threat multiplier: `units + buildings*0.9 + construction*0.55 + min(6, walls*0.12)` with the existing size/frequency caps.

Horde HP/contact-damage multipliers remain separate from canonical base values. Cache guards deliberately use untuned base HP/contact damage while sharing the global 0.30 speed multiplier.

## Composition and spawn parity

The canonical enemy registry contains 13 records. Twelve are currently spawnable: Ravager, Runner, Brute, Spitter, Flyer, Siege Beast, Burrower, Climber, Acid Lobber, Crusher, Harvester Hunter and Saboteur. `swarm` remains compatibility-defined but is disabled because the active v24 spawner does not select it.

Special introduction times and weights come from `enemyConfig.js`; no stats are copied into the director.

Horde placement preserves an important v47 quirk: a spawn candidate is checked against world bounds and shaped terrain, but the horde placement helper does not run the complete structure/depot blocker. This is intentionally different from cache guards and is documented rather than silently redesigned.

## Cache ownership and confirmed fixes

`resourceCaches.js` preserves the current values:

- 6 caches;
- 30 radius;
- 96 capture radius;
- 4.5 second capture;
- 620 activation radius;
- 520 guard aggro radius;
- 680 guard leash radius;
- 145 contest radius;
- 760 minimum Base distance;
- 2850 maximum Base distance;
- 760 normal cache separation.

Current cache reward fade and guard composition are preserved. Before four minutes the guard trio is Ravager/Ravager/Runner; from four minutes it is Ravager/Runner/Brute.

The three confirmed cache fixes are canonical clean behavior:

1. `canUnitCaptureCache()` rejects flying units and canonical stealth units. A Sneaky Spotter can still activate/scout a cache and retains its stealth behavior, but cannot advance capture alone.
2. Ground-melee guards use shared ground targeting and cannot melee Combat Drone, Combat Ship or other flying player units.
3. `stepCacheGuard()` uses the shared full navigation blocker, including Main Base, solid structures, resource depots, Walls, blocking terrain and world bounds.

A dead guard does not contest. A living guard contests only while inside the current 145px contest radius. With an eligible capturer but a live contesting guard, capture progress pauses. With no eligible capturer, existing progress decays at the current 0.35 seconds per second. Completion occurs once; remaining guards for that cache are removed without bounty, matching the legacy capture cleanup.

## External service seams

Prompt 9 does not migrate the external systems used by enemy gameplay. The clean game context now accepts injected service namespaces so later integration can wire these without importing legacy globals.

Optional enemy-facing seams are:

- `game.services.enemyCombat.fireProjectile(game, projectile, context)` — route Spitter projectiles into the eventual shared projectile engine.
- `game.services.enemyCombat.damageTarget(target, amount, context)` — intercept special external structure consequences such as Landing Pad export-ship HP/cargo handling before generic HP damage.
- `game.services.enemyCombat.onTargetDestroyed` / `onBaseDestroyed` — destruction/game-over lifecycle handoff.
- `game.services.enemyLifecycle.createEnemyId(type, game)` — optional application-owned IDs.
- `game.services.enemyLifecycle.onEnemySpawned(game, enemy, options)` — spawn lifecycle hook.
- `game.services.enemyLifecycle.onEnemyDestroyed(game, enemy, reward)` — visual/reward cleanup hook after the clean one-time bounty calculation.
- `game.services.enemyAI.emitEffect(game, effect)` — optional presentation effect bridge.
- `game.services.enemyAI.movementMultiplierAt(enemy, game)` / `isInRiver(enemy, game)` — optional external movement-environment bridge.
- `game.services.resourceCaches.grantReward(game, cache, reward)` — optional reward adapter when integrating with a non-clean resource store.
- `game.services.resourceCaches.onGuardsSpawned` / `onCaptured` — presentation/UI hooks.

When a service is absent, the clean subsystem uses its clean state collections/resources where safe. It does not import `window.*`, legacy `CONFIG`, legacy `state`, HUD functions or renderer functions.

## Remaining dependencies

The following are intentionally **not** migrated by Prompt 9:

- persistent enemy projectile travel/collision/impact;
- Landing Pad/export-ship damage consequences;
- global structure/unit destruction cleanup outside enemy bounty removal;
- Base game-over UI/flow;
- economy/HUD presentation of cache rewards;
- fog visibility/rendering;
- renderer/effects presentation;
- global game loop/reset ownership.

Those systems must consume the service seams during later focused migrations. Prompt 9 must not be activated alongside the legacy enemy loop.

## Verification

`tests/enemy-runtime.test.mjs` is the committed regression suite for this subsystem. It covers canonical construction and horde/untuned stats, all 13 AI handlers, ordinary melee, ground-vs-air eligibility, Spitter ranged targeting, Flyer movement, every special enemy mechanic, one-time death/bounty cleanup, first-horde timing, batch size, minute progression, special introduction timing, cache initialization, untuned guards, guard targeting/leash/full blockers, dead-guard contest removal, the Spotter exploit, valid capture, contested pause and exactly-once completion/reward.

The finalized isolated Node run passed **35/35 tests**. Production runtime activation was not attempted.
