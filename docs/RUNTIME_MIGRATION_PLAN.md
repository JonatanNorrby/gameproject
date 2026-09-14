# Production Runtime Migration Plan

## Goal

Replace the accumulated `v14`–`v53` production monkey-patch chain with the clean `js/` runtime incrementally, without redesigning gameplay, changing balance, or requiring one risky big-bang rewrite.

## Status

**All eight migration steps are implemented on the stacked migration branches.**

Step 8 completes the JavaScript production cutover: `index.html` now loads one ES-module entry, `js/production.js`. The historical `config.js`, versioned JavaScript files and transitional `js/migration/*` bridges remain in the repository but are not executed by production.

Historical CSS remains linked for layout/style parity and can be cleaned separately after visual verification; this migration is about runtime ownership, not redesigning the UI.

## Completed steps

### Step 1 — Economy / logistics

Clean ownership moved to `js/economy/*` for Mine extraction, Refinery conversion, Landing Pad/export ships and Truck service/routes. The production timing split—Mine/Refinery/Pad before movement, Truck service after movement—was preserved and is now encoded directly in `js/core/runtime.js`.

### Step 2 — Navigation + movement

Clean ownership moved to `js/navigation/*`, `js/movement/*`, `js/units/commands.js` and `js/units/platoons.js`. This retained blocked-destination repair, heap A*, aircraft direct movement, river slowdown, Platoon speed/formation, support following and Truck route semantics.

### Step 3 — Movable units + player combat

Clean ownership moved to unit deployment/transport and `js/combat/unitCombat.js` plus healing, repair, player-damage and player-mine modules. Unsafe blocked spawn/APC-unload fallbacks were removed while preserving intended behavior.

### Step 4 — Enemies + director

Clean ownership moved to `js/enemies/*` for horde timing/spawning, AI, special enemy behavior, statuses, cache guard AI and enemy bounty/removal. Burrower emergence was hardened against full world collision.

### Step 5 — Towers + projectiles

Clean ownership moved to `js/combat/towerStats.js`, `towerTargeting.js`, `towerCombat.js` and `projectiles.js`. The old tower wrapper chain and temporary structure substitutions stopped being authoritative.

### Step 6 — Buildings, placement + Walls

Clean ownership moved to `js/buildings/*` and structure lifecycle. Canonical placement validation, three-Mines-per-depot, Wall path/group construction, worker use and storage upgrades became authoritative.

### Step 7 — Fog, rendering, assets + camera

Clean ownership moved to `js/fog/*`, `js/rendering/renderer.js`, `js/assets/assets.js` and `js/input/camera.js`. Rendering became read-only; fog exploration and VFX expiry moved to update-side owners. Detailed presentation was temporarily exposed through read-only compatibility callbacks.

### Step 8 — Input, UI, bootstrap, reset + final frame

Implemented on `migration/final-runtime-step8`:

- `js/production.js` is the single browser entry;
- `js/core/runtime.js` owns the authoritative frame/reset loop;
- `js/input/*` owns player input and interaction dispatch;
- `js/ui/*` owns menus, HUD and action controls;
- `js/world/world.js` owns production terrain/depot/river generation;
- `js/rendering/presentation.js` and `projectilePresentation.js` physically contain production presentation code instead of calling versioned renderer functions;
- the Main Base and firing-squad images are clean asset-registry entries;
- Restart preserves options/reach preference while rebuilding runtime state;
- deterministic river fallback checks Base/depot collision;
- unified hostile projectiles render through the same clean projectile collection used by simulation.

## Production loader rule

Production must have exactly one JavaScript entry:

```html
<script type="module" src="js/production.js?v=1"></script>
```

Do not add `config.js`, a `vNN.js` script, or a migration bridge back to `index.html`.

## Historical files

Versioned JavaScript and `js/migration/*` files are retained for history, parity investigation and safe rollback comparison. They are no longer runtime owners. They can be archived or removed in a later repository-cleanup change after the clean runtime has had browser/playtest verification; deletion is not required for the production cutover.

## Regression rule

`npm test` is mandatory for every runtime change. CI runs the committed Node suite on push and pull request. The production-loader smoke test explicitly fails if the legacy JavaScript stack or migration bridges are reactivated.

The final Step 8 branch also tests world generation, collision-safe river fallback, exact frame phase ordering, pause semantics, 33ms clamping, Restart/options preservation, Landing Pad attraction, update-side VFX expiry and unified projectile presentation.
