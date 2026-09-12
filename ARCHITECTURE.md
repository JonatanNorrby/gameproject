# Clean Runtime Architecture

## Status

The clean ES-module runtime under `js/` is still **dormant**. The production page continues to load the legacy `config.js` + versioned script stack and does not import `js/main.js`.

Prompt 3 completed the safe foundational data layer: current effective configuration, canonical entity registries, traits/classification, ID normalization, pure math/geometry helpers, validation, and a legacy-parity fixture. No movement, combat, input, pathfinding, rendering, fog runtime, economy runtime, UI, or main-loop behavior has been switched over.

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
| Unit movement/platoons/support runtime | `js/units/units.js` | SKELETON CREATED |
| Combat runtime | `js/combat/combat.js` | SKELETON CREATED |
| Enemy director/AI runtime | `js/enemies/enemies.js` | SKELETON CREATED |
| Tower combat runtime | `js/towers/towers.js` | SKELETON CREATED |
| Building placement/runtime | `js/buildings/buildings.js` | SKELETON CREATED |
| Economy/logistics runtime | `js/economy/economy.js` | SKELETON CREATED |
| Navigation/A* runtime | `js/navigation/navigation.js` | SKELETON CREATED |
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

## Enemy base values vs horde values

Enemy registries preserve base growth values and the current v47 horde multipliers separately. Current normal horde enemies are created from the base formula, then v47 applies per-type HP/contact-damage multipliers. Global enemy movement is then multiplied by 0.30. Do not pre-bake these multipliers into base values during later AI/spawn migration or they will be applied twice.

Special direct attacks that v47 mutates globally are already stored at their current effective values: Acid Lobber shot 6.3 and Crusher charge 104.4.

## Tower upgrades

`js/towers/towerConfig.js` owns both upgrade presentation data (cost/name/description) and the exact current numeric modifiers from the active v21/v22 stat logic. `getTowerLevelStats()` is pure derived-data logic only; tower firing remains legacy-owned.

## State ownership

`js/core/state.js` remains the only clean state creator/reset owner. Prompt 3 aligned its dormant defaults with current foundational config (125/0 opening economy, 0.65 camera zoom, current horde first-delay data) but did not migrate the main loop or director behavior.

## Pure helpers

`js/utils/math.js`: clamp, lerp, distance/squared distance, angle-between, angle normalization, numeric comparison.

`js/utils/geometry.js`: circle/radius checks, nearest point to segment, point-to-segment distance, segment intersection/distance, world-bound tests/clamping. Geometry edge behavior intentionally preserves the legacy helper tolerances where it affects collision calculations.

`js/utils/helpers.js`: deep freeze, finite-number checks, explicit registry lookup failure, deterministic-injectable ID factory.

## Validation and parity

`validateGameConfig()` performs an on-demand structural/numeric validation. It is not executed every frame or by the live game.

`compareConfigParity()` compares required key values and tower upgrade stats against a Prompt-3 snapshot traced from the current legacy load order. The snapshot exists only for migration verification.

Prompt 3 validation result: **0 errors** across 19 units, 13 enemies, 10 towers, and 9 building records.

Prompt 3 parity result: **0 mismatches** for the compared current effective values.

## Legacy runtime / migration rules

No clean module is imported by `index.html`. No clean module patches `window.CONFIG`, `BUILD`, `state`, event listeners, rendering, or legacy functions. No new `vXX.js` file should be added during the migration.

Future migration must continue by system ownership rather than wrappers. If an adapter ever becomes unavoidable, isolate it under `js/migration/`, document its deletion condition, and do not let it become a permanent version layer.

## Next-phase caution

The current v47 director dynamically tunes spawned horde enemies while cache guards use untuned base enemy HP/damage with the same global 0.30 speed multiplier. Any future spawning/AI migration must preserve that distinction and must not apply horde multipliers twice.
