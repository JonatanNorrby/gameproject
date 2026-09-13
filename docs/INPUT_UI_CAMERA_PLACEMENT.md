# Clean Input, UI, Camera and Placement Runtime

## Scope and activation status

This migration creates the future clean owners for player input, camera transforms/gestures, selection and command interpretation, unit deployment, structure/tower/Wall placement, contextual unit actions, Truck-route editing, Platoon management, APC transport actions, tower/storage upgrades, HUD/menu/options state and the Main Menu interaction flow.

It is deliberately **not activated in production**. `index.html` still loads the historical script stack and does not import `js/main.js`. The legacy Prompt-5 manual-move bridge therefore remains active until final clean-runtime cutover; this migration does not add another production wrapper.

Global simulation scheduling, reset/map generation and the RAF loop remain for the final integration prompt.

## Effective legacy ownership traced before extraction

Final behavior was traced from the loaded chain rather than copied from one early implementation:

- v51 owns final pointer-to-world conversion, camera clamping, wheel zoom and zoom-at-cursor behavior.
- v48 fixes Escape/deselect interaction and final ground destination behavior.
- v47 owns immediate unit purchase/deployment from the Main Base and the final unit registry behavior.
- v34 owns the reliable title-screen Start/Resume flow.
- v30 owns service-aware Truck route recording and storage selection/upgrades.
- v29 owns Platoon create/merge/leave/disband interactions.
- v28 owns APC transport actions.
- v25/v47 own Medic/APC support attachment state used by the clean support helpers.
- v23 owns the command-drawer interaction model.
- v21 owns tower upgrade levels/cost invocation.
- v18 owns the final Wall painting/review interaction family.
- v16/v26 own resource-depot Mine placement and the three-Mines-per-depot behavior.
- v47 removes Bunker from the intended runtime, so no Bunker placement/garrison UI is restored.

## Camera ownership

`js/input/camera.js` is the clean camera owner.

Preserved values and behavior:

- default zoom comes from canonical config (`0.65`);
- minimum zoom `0.18`;
- maximum zoom `1.35`;
- zoom step `0.10`;
- zoom is anchored to the pointer/midpoint world position;
- visible-world bounds determine camera clamping;
- Arrow-key diagonal movement is normalized;
- Center returns to the Main Base without changing zoom;
- CSS-sized canvas coordinates are scaled into backing-canvas coordinates before world conversion.

`screenToWorld()` / `eventToWorld()` are now the single transform path for interactions.

## Raw input ownership

`js/input/input.js` owns browser-device events only. It does not implement gameplay rules.

It installs exactly one clean listener family when the clean runtime is eventually booted:

- pointer down/move/up/cancel;
- capture-phase wheel zoom;
- keyboard down/up;
- context-menu suppression on the game canvas;
- resize/orientation gesture cancellation.

Mobile behavior includes:

- one-finger drag to pan;
- two-finger pinch to zoom around the midpoint;
- tap to issue a semantic world interaction;
- Wall drag painting;
- cancellation when command/title overlays take ownership.

Wheel/input is blocked while the command drawer or title menu is open. The module is Node-safe and registers nothing without a canvas.

## Semantic interaction ownership

`js/input/interaction.js` owns command interpretation after input has already been converted to world coordinates.

World-tap priority is explicit and single-owner:

1. Wall painting;
2. Truck route recording;
3. Medic follow attachment;
4. APC support attachment;
5. Platoon create/merge attachment;
6. attach-to-Truck mode;
7. active building/tower placement;
8. unit selection;
9. built-tower selection;
10. Refinery/Landing-Pad storage selection;
11. selected-unit manual move through the Prompt-5 clean command seam;
12. empty-space deselection.

This replaces the architectural need for the legacy nested `handleTap` chain without installing a replacement wrapper in production.

## Unit purchase and deployment

`js/units/deployment.js` owns current purchase semantics.

Unit build buttons do **not** enter arbitrary map placement. A successful purchase immediately creates the unit at a valid point around the Main Base.

Ground units search rings around the Base while respecting blocking terrain, structures, depots and active units. Combat Drone/Combat Ship use the current air deployment ring. Combat Ship's canonical `maxActive: 1` restriction is enforced below the UI.

All 19 canonical roles use `UNIT_CONFIG` cost/HP/radius/runtime-type data. Failed creation refunds the complete cost.

## Placement ownership

`js/buildings/placement.js` owns placement validation and post-click entity creation for:

- all 10 towers;
- Crystal Mine;
- Ore Mine;
- Refinery;
- Landing Pad;
- Wall paths.

It reuses canonical config and the clean resource API rather than maintaining UI-local prices.

General placement validates world bounds, Main Base clearance, shaped terrain, current structures/Walls and resource depots. Mine placement is depot-specific and intentionally preserves the v26 exception that sibling Mine slots on the **same depot** do not block one another.

For Mines, matching-depot / three-Mine-limit validation occurs before worker availability, matching final legacy behavior.

## Workers and construction

There are still exactly **3 workers**.

`js/buildings/construction.js` is now the one clean construction-progress owner for economic buildings, towers and Wall groups. A multi-segment Wall path consumes one worker because every segment shares one `groupId` and one construction timer.

Current Engineer acceleration is preserved: each nearby Engineer contributes +40% construction progress, up to two Engineers.

`js/buildings/buildings.js` delegates all construction progress to this owner and remains responsible for economic-building runtime normalization.

## Wall interaction

The clean Wall flow preserves the current polyline model:

- minimum segment: 35px;
- maximum segment: 850px;
- maximum total path: 1500px;
- drag point spacing: 45px;
- thickness: 12px;
- cost: ceil(length × 11 Metal / 100px);
- HP: 320 per 100px;
- build time: 1.5s + 1.15s per 100px.

The player can click bends or drag to paint, review the path, confirm or return to editing. `renderer.js` now draws the editable Wall path before fog so cutover will not lose painting feedback; Prompt-12's overall world → indicators → fog → screen ordering remains unchanged.

## Truck route UI

Prompt-10 economy/logistics remains the route owner. This migration only owns player editing controls:

- RECORD ROUTE clears the prior route and removes the Truck from its Platoon;
- tapping Mine/Ore Mine/Refinery/Landing Pad records the exact `buildingId` service stop;
- tapping ordinary terrain records a waypoint;
- FINISH ROUTE requires at least two stops;
- completion auto-starts the route and deselects the Truck;
- CLEAR ROUTE clears movement/service route ownership.

Logistics-generated movement still uses `source: 'logistics'`; player movement still uses `source: 'player'` and cancels active Truck route ownership.

## Platoons and support actions

`js/units/platoons.js` now owns create/merge/disband/leave in addition to its existing movement routing. Canonical `platoonCapable` classification remains the eligibility source.

`js/units/support.js` now owns player attachment actions as well as detach actions:

- Medic can follow active healable infantry through `v47FollowId`;
- APC can support either one unit or one Platoon through the existing support identity fields;
- attachment removes the support unit from a Platoon where the legacy interaction does so.

Automatic follow movement remains with the unit-support runtime and is not duplicated here.

## APC transport

`js/units/transport.js` owns voluntary load/unload interactions.

Boarding uses the canonical `boardable` trait instead of a role list. This includes Medic, matching the current registry/legacy transport semantics. Loading removes the passenger from a Platoon, clears independent movement and sets `transportedIn`. Unloading uses clean nearest-open navigation and clears transport state.

Prompt-11 destruction behavior remains the owner of forced APC passenger ejection/damage when an APC dies.

## Mine Layer interaction

The command layer now owns manual Mine placement:

- 18 Gold per Mine;
- maximum 10 active Mines per Mine Layer;
- Mine is placed at the Mine Layer's current position.

Prompt-7 `unitMines.js` remains the automatic trigger/detonation owner. There is no second Mine combat implementation.

## Tower and storage upgrades

Tower selection and upgrade UI consumes Prompt-8 `getEffectiveTowerStats()` and the shared Metal resource API. Levels stay 1/3 → 2/3 → 3/3 and the current post-upgrade cooldown clamp (`min(current, 0.15)`) is preserved.

Refinery/Landing Pad storage upgrades call the already-migrated `upgradeBuildingStorage()` path, so UI capacity and logistics capacity remain the same values rather than separate calculations.

## HUD, menus and options

`js/ui/ui.js` is the clean DOM/HUD/controller owner.

It owns:

- title Start/Resume / Options / Guide navigation;
- pause;
- mobile command drawer;
- build tabs and buttons;
- contextual unit/tower/storage actions;
- Gold/Metal/Base HP/workers/enemy count/survival time/message display;
- camera zoom controls;
- reach display option;
- incoming-enemy and off-screen-unit-arrow options;
- existing debug toggles/actions exposed by the current HTML.

`js/ui/domSetup.js` creates controls that the final legacy runtime historically injected after page load, including missing later-unit build buttons and the guaranteed zoom controls. Canonical registries provide their names/costs, so stale HTML labels do not become another balance source.

`renderer.js` now respects both arrow options. Enemy arrows remain fog-gated and sector-combined; off-screen active player units use individual directional arrows with selected/Truck/air distinctions.

## Main menu semantics

Clean initial state starts paused with the title menu visible, matching the final v34 preview/start behavior.

START GAME / RESUME closes the title overlay and unpauses the existing initialized run. It does **not** silently reset the world. Full new-game/reset/map-generation orchestration is intentionally left to the final runtime-integration prompt.

## Production bridge status

The historical Prompt-5 manual movement bridge remains the only production migration bridge while `index.html` is on the legacy stack. Prompt 13 does not install clean input listeners into production and therefore cannot double-handle clicks, wheels or keys.

At final cutover, the legacy bridge and its loader must be removed because `js/input/input.js` / `js/input/interaction.js` become the real interaction owners.

## Verification

`tests/input-ui-camera-placement.test.mjs` covers:

- initial paused title state;
- camera zoom anchor/clamps/transforms;
- wheel ownership/menu blocking;
- immediate Base unit deployment and Gold spend;
- Combat Ship active limit;
- tower placement and worker ownership;
- placement overlap rejection;
- three Mine slots on one depot;
- Wall cost/group semantics;
- shared tower/Wall construction and Engineer acceleration;
- Truck service-stop route recording and auto-start;
- player move delegation;
- tower Metal upgrades;
- storage upgrades;
- Platoon create/merge/disband and interaction mode;
- APC canonical boarding/unload;
- Mine Layer cost/limit;
- Medic follow;
- APC Platoon support;
- attach-to-Truck mode;
- Wall review/confirm;
- Node-safe UI/input entry points.

The entire existing clean-runtime regression set is run on every staging-branch validation commit. Production activation is not part of this prompt.

## Remaining work for final integration

After this migration, the primary remaining architectural work is the authoritative clean boot/reset/update/render loop and world/map initialization. Final integration must:

- initialize the terrain/depots/rivers/caches/director and all subsystem runtime state exactly once;
- order movement/economy/combat/enemy/fog/render/UI passes correctly;
- wire remaining service callbacks (Landing Pad attraction, lifecycle/UI effects, renderer hooks);
- remove the Prompt-5 legacy manual-move bridge;
- switch `index.html` to the clean module entry point only after end-to-end browser/mobile smoke tests pass.
