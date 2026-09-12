# Clean Runtime Architecture

## Status

Prompt 2 creates a **dormant** ES-module runtime alongside the existing game. `index.html` still loads the legacy `config.js` + versioned script stack and does not import `js/main.js`. No legacy file is deleted or replaced.

The current live tail verified before this scaffold was added is `v35.js -> v47.js -> v48.js -> v51.js -> v53.js`, after the older scripts loaded earlier by `index.html`. Prompt 1 found overlapping ownership/wrapper chains for movement, combat, enemy AI, fog, rendering, reset, spawning, UI and other globals; the clean tree exists to end that pattern rather than reproduce it.

## Ownership

| Area | Future authoritative owner | Prompt 2 status |
| --- | --- | --- |
| Boot/context | `js/main.js`, `js/core/game.js` | SKELETON CREATED |
| Core config | `js/core/config.js` | PARTIALLY MIGRATED (core constants only) |
| State/reset | `js/core/state.js` | SKELETON CREATED |
| Entity roles/classification | `js/core/entities.js` | PARTIALLY MIGRATED |
| Input/selection/camera commands | `js/input/input.js` | SKELETON CREATED |
| Units/movement/platoons/support | `js/units/units.js` | SKELETON CREATED |
| Combat/targeting/damage/heal/repair/projectiles | `js/combat/combat.js` | SKELETON CREATED |
| Enemies/director/AI | `js/enemies/enemies.js` | SKELETON CREATED |
| Towers/upgrades | `js/towers/towers.js` | SKELETON CREATED |
| Buildings/placement lifecycle | `js/buildings/buildings.js` | SKELETON CREATED |
| Mining/logistics/storage/export | `js/economy/economy.js` | SKELETON CREATED |
| Collision/pathfinding | `js/navigation/navigation.js` | SKELETON CREATED |
| Fog/vision data | `js/fog/fog.js` | SKELETON CREATED |
| Single world renderer | `js/rendering/renderer.js` | SKELETON CREATED |
| HUD/menus/selected panels | `js/ui/ui.js` | SKELETON CREATED |
| Asset registry/loading | `js/assets/assets.js` | SKELETON CREATED |
| Pure math/geometry | `js/utils/*` | PARTIALLY MIGRATED |

## State ownership

`js/core/state.js` is the only clean-runtime state creator/reset owner. It uses nested categories for session/time, director, resources, base, entities, selection, commands, view/camera, fog, debug and current gameplay modifiers. Selection stores IDs rather than object references. No module reads or writes legacy `window.state`.

The clean state intentionally does not carry removed roguelite/card/XP behavior. Additional fields are admitted only when a migrated active system proves it needs them.

## Config ownership

`js/core/config.js` owns clean configuration composition. Prompt 2 ports only current core values that were straightforward to verify (starting economy/base, world/camera and pathfinding). Unit, enemy, tower, building and economy **balance tables remain legacy-authoritative** until their migration prompt so values are not copied from stale version layers.

Stable entity IDs and classification metadata live in `js/core/entities.js`; they are not balance tuning.

## Entity identity

The clean runtime treats `unit.role` as the authoritative gameplay identity. Classification helpers centralize flying, ground, infantry, mechanical, repairable and support checks. Only two explicit legacy-shape fallbacks exist for incremental data migration: old `type: "truck"` maps to `truck`, and role-less old `type: "soldier"` maps to `rifleman`.

## Data/update flow

The future coarse update ownership is declared in `js/core/game.js`:

1. apply queued input commands
2. navigation/destination work
3. unit movement/support/platoon work
4. enemy movement/AI
5. tower behavior
6. combat/projectile resolution
7. building lifecycle
8. economy/logistics
9. fog/vision data
10. render world once, then render UI

Prompt 2 does **not execute this pipeline**. Exact sub-order is locked only when each legacy system is migrated and regression-tested, preventing accidental behavior changes from an assumed order.

## Rendering flow

The future renderer has one owner: `js/rendering/renderer.js`. It must render world primitives exactly once and must not wrap the legacy `draw()` chain. Fog provides visibility data; the renderer owns painting that data. UI rendering remains separate from world rendering.

## Migration rules/status

No compatibility wrapper is installed around the legacy runtime. The only compatibility logic in clean source is pure entity-shape interpretation in `getUnitRole`, which has no globals or side effects and is removable after entity data migration.

Planned migration sequence after Prompt 2:

1. verify/port remaining pure config, helpers and entity factories
2. migrate assets + single renderer while keeping simulation legacy-owned for comparison
3. migrate navigation and unit destination/movement ownership
4. migrate units, support and platoons together with combat contracts
5. migrate enemies/director/cache guards
6. migrate buildings/economy/logistics/export ships
7. migrate fog/vision into the single renderer contract
8. migrate UI/input/camera listeners last so there is one event owner
9. activate `js/main.js` only after parity checks
10. remove legacy script loading only in the final cleanup phase

Do not add new `vXX.js` files during this migration. If a temporary adapter ever becomes unavoidable, isolate it under `js/migration/` and document its deletion condition before use.
