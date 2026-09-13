# Fog, Rendering, and Asset Ownership

## Scope

Prompt 12 migrates the clean-runtime ownership of Fog of War, frame rendering/culling, and tracked image assets. The production page is still legacy-owned: `index.html` is not changed and does not import the clean runtime.

## Final legacy behavior traced

The loaded v32 implementation introduced Fog of War, but v47 is the final effective owner. v47 replaces v32's fog functions and installs one overlay owner. v53 does not replace Fog of War; it only replaces advanced-unit identity/rendering and explicitly keeps draw-time behavior read-only.

Final v47 fog values are the canonical values already stored in `js/core/config.js`:

- cell size: 96
- exploration marking cadence: 120 ms
- Base vision: 390
- Scout / Spotter / Sniper vision: 460 / 440 / 520
- player aircraft vision: 350
- ordinary ground-unit vision: max(250, weapon range + 65, detection/spotting range)
- tower vision: max(265, effective tower range + 55)
- Landing Pad / Refinery / Mine vision: 330 / 275 / 210
- other built structures: 225
- Wall and disabled Bunker: 0

The final overlay uses unexplored alpha `.985`, explored-but-not-currently-visible alpha `.62`, and two-step circular reveal holes at 92% outer removal plus a fully removed inner circle at 84% of source radius.

## `js/fog/fog.js`

This module is the sole clean owner of:

- persistent explored-grid state;
- live vision-source collection;
- the 120 ms exploration-mark cadence;
- current point visibility;
- explored-point lookup;
- Fog of War constants used by rendering.

Vision sources are rebuilt every fog update so targeting/render visibility follows unit and structure movement immediately. Only the persistent explored-grid marking is throttled, matching v47.

Dead, transported, or garrisoned units do not provide vision. Unbuilt/dead structures do not provide vision. `debug.allVision` is supported as a clean-runtime bypass and marks the exploration grid fully explored.

The clean `game.services.fog.isVisible` default delegates to this module, so migrated targeting code can consume Fog of War without importing renderer state.

## `js/rendering/renderer.js`

This module is the single clean frame coordinator. The canonical render order is:

1. backdrop
2. Base
3. structures
4. units
5. enemies
6. projectiles
7. particles
8. off-screen indicators
9. Fog of War
10. screen overlay hook

That order reflects final v47 ownership: the old world scene and indicators are rendered before the v47 fog overlay, while final debug/game-over screen overlays are above fog.

Enemies outside current vision are rejected before the enemy renderer/hook is called. Enemy off-screen warning indicators likewise include only currently visible enemies.

The module provides conservative procedural fallbacks plus `game.services.rendering.*` hooks for presentation-specific drawing. These hooks do not change simulation ownership and are not a legacy wrapper chain.

Fog uses an off-screen surface when a browser canvas, `OffscreenCanvas`, or injected `createSurface` service is available. A cell-based fallback exists for headless contexts.

## `js/rendering/culling.js`

Culling is zoom-aware and derives the current world rectangle from `state.view.camera` plus the active viewport. Current v47 margins are preserved for the main entity classes:

- units: 250 screen-pixel margin
- enemies: 150
- structures / Walls: 720
- depots/backdrop helpers may use narrower margins where appropriate

The helpers are pure and do not mutate camera or entity state.

## Assets

The repository currently tracks exactly two reusable sprite PNG files:

- `rifle_soldier.png`
- `mech_strider.png`

`js/assets/assets.js` is now the clean owner of those paths and load state. The registry is safe in non-browser/Node contexts: when no `Image` constructor exists, loading reports `unsupported` instead of crashing.

The old v47 optional Main Base sprite path (`A2D31210-1B7B-4D4F-9C2D-0740047D4008.png`) is not tracked in the repository, so it is intentionally not promoted into the canonical clean asset manifest. The legacy runtime already falls back procedurally when that file is absent.

Likewise, old Skitter/Brute image objects are not canonical tracked assets; v14a already leaves them without network sources and uses procedural fallbacks.

## Rendering must stay read-only

Prompt 12 preserves v53's rule that drawing must never normalize, revive, move, damage, or otherwise mutate gameplay entities. Fog exploration state is updated only by `updateFog()`, not as a side effect of drawing.

## Activation status

This migration is dormant in production. No historical `vXX.js` file was modified or removed, no new version patch file was created, and `index.html` is intentionally unchanged. A later explicit activation prompt must switch production boot/runtime ownership only after remaining input/UI/boot dependencies are migrated and integration-tested.
