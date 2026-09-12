# Clean Runtime Architecture

## Status

The clean ES-module runtime under `js/` is still not the main production runtime. The production page continues to load the legacy `config.js` + versioned script stack and does not import `js/main.js`.

Prompt 3 completed the safe foundational data layer. Prompt 4 extracted the basic unit destination/pathfinding primitive into `js/movement/` + `js/navigation/`. Prompt 5 now extracts only the command routing above that primitive: normal manual moves, Platoon move routing, Medic manual detach + move, and APC support manual detach + move.

A temporary bridge under `js/migration/` activates this narrow Prompt 5 command path after the legacy runtime has finished loading. Full input, rendering, combat, enemy AI, economy, Truck logistics, UI and the main loop remain legacy-owned.

## Canonical ownership

| Area | Future authoritative owner | Status |
| --- | --- | --- |
| Boot/context | `js/main.js`, `js/core/game.js` | SKELETON CREATED |
| Game-wide config | `js/core/config.js` | MIGRATED |
| Economy/resource config | `js/economy/economyConfig.js` | MIGRATED |
| Unit definitions | `js/units/unitConfig.js` | MIGRATED |
| Enemy definitions | `js/enemies/enemyConfig.js` | MIGRATED |
| Tower definitions/upgrades | `js/towers/towerConfig.js` | MIGRATED |
| Building definitions | `js/buildings/buildingConfig.js` | MIGRATED |
| Entity classification/radii | `js/core/entities.js` | MIGRATED |
| Entity ID helpers | `js/core/ids.js` | MIGRATED |
| Math/geometry/helpers | `js/utils/*` | MIGRATED |
| Config validation | `js/core/validation.js` | MIGRATED |
| Legacy parity check | `js/core/parity.js` | MIGRATED (verification only) |
| State/reset | `js/core/state.js` | PARTIALLY MIGRATED |
| Input/selection/camera runtime | `js/input/input.js` | SKELETON CREATED |
| Basic unit destination/movement primitive | `js/movement/movement.js` | MIGRATED |
| Navigation/A* runtime | `js/navigation/navigation.js`, `js/navigation/pathfinding.js` | PARTIALLY MIGRATED |
| Manual move command routing | `js/units/commands.js` | MIGRATED FOR PROMPT 5 SCOPE |
| Platoon movement routing | `js/units/platoons.js` | MIGRATED FOR MOVE ORDERS ONLY |
| Medic/APC manual detach helpers | `js/units/support.js` | MIGRATED FOR MANUAL MOVE ONLY |
| Remaining unit lifecycle/support/platoon runtime | `js/units/units.js` | PARTIALLY MIGRATED |
| Combat runtime | `js/combat/combat.js` | SKELETON CREATED |
| Enemy director/AI runtime | `js/enemies/enemies.js` | SKELETON CREATED |
| Tower combat runtime | `js/towers/towers.js` | SKELETON CREATED |
| Building placement/runtime | `js/buildings/buildings.js` | SKELETON CREATED |
| Economy/logistics runtime | `js/economy/economy.js` | SKELETON CREATED |
| Fog/vision runtime | `js/fog/fog.js` | SKELETON CREATED |
| World rendering | `js/rendering/renderer.js` | SKELETON CREATED |
| HUD/menus/UI runtime | `js/ui/ui.js` | SKELETON CREATED |

## Config rule

The clean data uses the **final effective values after the current legacy load order**, not the first declaration found in `config.js`. Important traced overrides include:

- v30: starting economy becomes 125 Gold / 0 Metal; Crystal Mine 45 Metal; Ore Mine 20 Gold; Refinery 35 Gold; storage tiers become current.
- v32: exported Crystal value becomes 4 Gold and current kill bounties replace old `GOLD_REWARD` values.
- v33: default camera zoom becomes 0.65.
- v47/v51: minimum zoom becomes 0.18; fog grid becomes 96; enemy speed multiplier becomes 0.30; the horde director replaces the old interval director.
- v47: Acid Lobber shot damage is tuned from 9 to 6.3 and Crusher charge damage from 145 to 104.4 once during install.
- v47/v53: Mech/Drone/Ship radii are 29/16/27, superseding earlier 28/15/26 helpers.

`js/core/parity.js` records these as a **verification fixture**, not as a second runtime config source.

## Canonical IDs and aliases

Player unit IDs:
`rifleman`, `heavygunner`, `rocketeer`, `medic`, `engineer`, `scout`, `sniper`, `flametrooper`, `spotter`, `minelayer`, `mech`, `combatdrone`, `combatship`, `tank`, `mobileartillery`, `repairvehicle`, `apc`, `mgcar`, `truck`.

The only retained unit alias is `soldier -> rifleman` because `soldier` is still a real legacy build/runtime identifier. The former purchased `platoon` entity is **not** an alias or unit: v29 removed it and Platoons are control groups.

Enemy IDs:
`ravager`, `swarm`, `runner`, `brute`, `spitter`, `flyer`, `siegebeast`, `burrower`, `climber`, `acidlobber`, `crusher`, `harvesterhunter`, `saboteur`.

`spitter` is the canonical runtime ID even though its old config object was named `RANGED_ALIEN`. `swarm` remains defined for compatibility/balance references but is marked non-spawnable because current v24 spawning does not select it.

Tower IDs:
`laser`, `flame`, `railgun`, `tesla`, `antiair`, `cryo`, `mortar`, `minigun`, `missile`, `dronebay`.

Building IDs:
`base`, `mine`, `oremine`, `refinery`, `landingpad`, `wall`. Historical `bunker`, `safespot`, and `blockade` definitions remain explicitly disabled: Bunker is removed by v47, Safe Spot by v21, and Blockade was replaced by Wall in v15.

## Traits/classification

Static relationships live on canonical registry traits. `js/core/entities.js` derives helpers such as:

- flying / ground
- infantry / mechanical / vehicle
- repairable / healable
- support / combat
- transport / logistics
- Platoon eligibility
- ground/flying enemies
- tower/building identity
- unit/enemy/tower/building/entity radius

This replaces future parallel hard-coded sets. Dynamic restrictions still belong to their eventual runtime system; for example, `canJoinPlatoon()` also checks transported/garrisoned/attached state without reading global state.

## Prompt 4 movement primitive

`js/movement/movement.js` owns individual destination assignment and the basic path follower. Ground units delegate path creation to `js/navigation/pathfinding.js`; player aircraft retain direct one-waypoint movement. Prompt 5 does not calculate paths and does not alter this primitive.

## Prompt 5 manual move command routing

`js/units/commands.js` is the authoritative clean command seam for this prompt. `issueManualMove(game, unit, x, y)` decides whether a player command is individual or Platoon-wide, clears the current Medic/APC automatic support relationship when appropriate, preserves the established manual Truck route-cancel side effect, and then delegates destinations to Prompt 4.

`issueMove(..., { source: 'support-ai' })` exists only to make command intent explicit: internal support movement does **not** detach its own relationship and does not expand into a Platoon move.

`js/units/platoons.js` ports only the movement helpers required from v29. Formation behavior is intentionally unchanged: the first member uses the clicked point, later members use the existing 54px ring spacing and `2.399963229728653` golden-angle placement, destinations are world-clamped by each unit radius, and a failed offset destination falls back to the clicked center. The legacy movement-speed wrappers remain active in production, so the current slowest-member Platoon speed behavior is unchanged.

`js/units/support.js` owns the Prompt 5 detach operations only. Medic detach clears `v47FollowId`, `v47FollowTimer`, and the attach-mode command flag. APC detach clears `v47SupportUnitId`, `v47SupportPlatoonId`, `v47SupportTimer`, and the attach-mode command flag. APC passenger/transport state is not touched.

## Temporary production bridge

`js/migration/manualMoveLegacyBridge.js` is the only new `handleTap` wrapper added by Prompt 5, and it is explicitly temporary. It is loaded after the full legacy stack by the small loader in `v18_hotfix.js`.

The bridge intercepts only when all of these are true: a movable unit is already selected, the player clicked empty terrain, no tower/unit was clicked, and no attach/route/wall/Platoon/Medic/APC special mode is active. Every other click delegates unchanged to the prior final `handleTap` chain.

The bridge calls `js/migration/manualMoveBridge.js`, which adapts the legacy arrays/state into the clean game shape and invokes `issueManualMove()`. Remove the bridge files and the loader as soon as the clean input runtime becomes the real click owner. Do not expand this bridge into combat, UI, building placement, logistics or other systems.

## Enemy base values vs horde values

Enemy registries preserve base growth values and the current v47 horde multipliers separately. Current normal horde enemies are created from the base formula, then v47 applies per-type HP/contact-damage multipliers. Global enemy movement is then multiplied by 0.30. Do not pre-bake these multipliers into base values during later AI/spawn migration or they will be applied twice.

Special direct attacks that v47 mutates globally are already stored at their current effective values: Acid Lobber shot 6.3 and Crusher charge 104.4.

## Tower upgrades

`js/towers/towerConfig.js` owns both upgrade presentation data (cost/name/description) and the exact current numeric modifiers from the active v21/v22 stat logic. `getTowerLevelStats()` is pure derived-data logic only; tower firing remains legacy-owned.

## State ownership

`js/core/state.js` remains the only clean state creator/reset owner. The temporary Prompt 5 adapter does not replace the legacy state object; it exposes the existing unit/world arrays through the clean shape only for the duration of a move command.

## Pure helpers

`js/utils/math.js`: clamp, lerp, distance/squared distance, angle-between, angle normalization, numeric comparison.

`js/utils/geometry.js`: circle/radius checks, nearest point to segment, point-to-segment distance, segment intersection/distance, world-bound tests/clamping. Geometry edge behavior intentionally preserves the legacy helper tolerances where it affects collision calculations.

`js/utils/helpers.js`: deep freeze, finite-number checks, explicit registry lookup failure, deterministic-injectable ID factory.

## Validation and parity

`validateGameConfig()` performs an on-demand structural/numeric validation. It is not executed every frame or by the live game.

`compareConfigParity()` compares required key values and tower upgrade stats against a Prompt-3 snapshot traced from the current legacy load order. The snapshot exists only for migration verification.

Prompt 3 validation result: **0 errors** across 19 units, 13 enemies, 10 towers, and 9 building records.

Prompt 3 parity result: **0 mismatches** for the compared current effective values.

Prompt 5 isolated command regression result: **16/16 passed** for manual individual reroutes, whole-Platoon routing, formation parity, blocked-slot fallback, Medic/APC detach semantics, support-AI non-detach, Truck manual route cancellation, attachment rejection and inactive-unit rejection.

## Legacy runtime / migration rules

`index.html` still does not import `js/main.js`, and no new `vXX.js` file is added. The legacy runtime remains authoritative for every system outside the narrow Prompt 4/5 movement seam.

The Prompt 5 bridge is the documented temporary exception to the previous no-wrapper rule. Future migration must remove it rather than stack another wrapper on top. All later work should continue by system ownership.

## Next-phase caution

Combat migration must not absorb movement command ownership or add another movement/pathfinding path. Enemy AI, support-follow updates, Platoon creation/management UI and Truck logistics remain legacy. If Prompt 6 touches any of them, it must call the existing movement seam rather than reassign destinations through another `handleTap`/`setUnitDestination` wrapper.

The current v47 director dynamically tunes spawned horde enemies while cache guards use untuned base enemy HP/damage with the same global 0.30 speed multiplier. Any future spawning/AI migration must preserve that distinction and must not apply horde multipliers twice.
