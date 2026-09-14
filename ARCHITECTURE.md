# Clean Runtime Architecture

## Production status

The ES-module runtime under `js/` is now the authoritative production runtime on the Step 8 migration branch.

`index.html` loads exactly one JavaScript entry:

```html
<script type="module" src="js/production.js?v=1"></script>
```

The historical `config.js`, `v14`–`v53` JavaScript files and `js/migration/*` compatibility bridges remain in the repository for history and comparison, but they are no longer loaded by production. Historical CSS files remain linked for layout/style parity; they do not own simulation behavior.

## Top-level ownership

| Area | Authoritative owner |
| --- | --- |
| Browser entry | `js/production.js` |
| Boot/context | `js/main.js`, `js/core/game.js` |
| Frame/reset lifecycle | `js/core/runtime.js`, `js/core/state.js` |
| Canonical config | `js/core/config.js` + subsystem config modules |
| World generation | `js/world/world.js` |
| Input/interaction | `js/input/*` |
| Camera/viewport | `js/input/camera.js` |
| Navigation/movement | `js/navigation/*`, `js/movement/*`, `js/units/commands.js`, `js/units/platoons.js` |
| Unit deployment/combat/support | `js/units/*`, `js/combat/unitCombat.js` |
| Enemy director/AI/lifecycle | `js/enemies/*` |
| Towers/projectiles | `js/towers/*`, `js/combat/towerCombat.js`, `js/combat/projectiles.js` |
| Buildings/Walls/construction | `js/buildings/*` |
| Economy/logistics | `js/economy/*` |
| Fog/vision | `js/fog/*` |
| Render orchestration/culling | `js/rendering/renderer.js` |
| Production presentation | `js/rendering/presentation.js`, `js/rendering/projectilePresentation.js` |
| Assets | `js/assets/assets.js` |
| HUD/menus/actions | `js/ui/*` |

## One authoritative frame

`js/core/runtime.js` preserves the effective production ordering established during the incremental migration instead of collapsing subsystems into convenience wrappers that would change timing.

The running-frame order is:

1. input/camera commands;
2. enemy director;
3. building construction;
4. Mine extraction;
5. Refinery processing;
6. Landing Pad/export-ship processing;
7. unit movement;
8. Truck logistics/service;
9. player-unit combat/support;
10. tower combat;
11. enemy actors/status/lifecycle;
12. projectile movement/collision;
13. player-unit + structure cleanup;
14. particles;
15. resource-cache capture;
16. captured-cache pruning;
17. fog refresh;
18. visual-effect lifetime.

Simulation `dt` remains capped at 33ms. Paused/game-over frames do not advance gameplay simulation; input, fog refresh and presentation-effect expiry can still run.

## State/reset rule

`js/core/state.js` owns the canonical state shape. `resetRuntime()` resets the existing state object in place, rebuilds world/economy/enemy/fog runtime state, and preserves user-facing options such as enemy/unit arrows and tower-reach preference. Restarting an active run stays in gameplay rather than returning to an inconsistent title/options state.

## Rendering rule

Rendering is read-only. `js/rendering/renderer.js` owns ordering, world transforms, zoom-aware culling, current fog visibility and the final fog overlay. Timed effect creation/expiry is update-owned by `js/rendering/visualEffects.js`.

Detailed production art previously embedded in version files has been extracted to clean presentation modules. The tracked Main Base PNG and firing-squad sheet are registered through `js/assets/assets.js`; procedural drawing remains the fallback when an image is unavailable.

## World rule

`js/world/world.js` generates terrain, finite resource depots and rivers. River placement—including deterministic fallback placement—must reject intersections with the Main Base and resource depots instead of accepting an unsafe fallback.

## Compatibility/history rule

The old patch files are retained only as historical reference. New gameplay work must not add another `vNN.js` layer or reactivate migration bridges. Changes should be made in the authoritative clean subsystem and covered by `npm test`.

The production-loader smoke test fails if `config.js`, a versioned JavaScript file, or `js/migration/*` is added back to `index.html`.
