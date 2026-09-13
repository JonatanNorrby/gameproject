# Shared Projectiles, Status Effects, and Destruction Lifecycle

## Scope and activation status

This migration creates clean future runtime ownership for persistent projectile travel/collision/impact, combat-status timing, and common destruction cleanup.

It is deliberately **not activated in production**. `index.html` still loads the historical runtime through `v53.js`; `js/main.js`, the clean RAF loop, input, UI, fog and rendering remain dormant. No legacy `vXX.js` file is replaced or deleted by this migration.

## Effective legacy behavior traced before extraction

The implementation follows the final loaded runtime rather than the earliest projectile implementation.

The final active persistent-projectile owner is v47. Its relevant behavior is:

- player projectiles move ballistically by `vx/vy`, normally live for 2.2 seconds and physically collide with the first living enemy inside enemy radius + 5;
- player projectile collision does not repeat targeting/fog eligibility checks at impact;
- invalid/non-finite projectile positions and expired projectiles are removed;
- enemy/Spitter projectiles keep a locked target object, normally live for 3 seconds and disappear if that target leaves the unit/structure collections;
- an in-flight enemy projectile is discarded if its locked target is a Sneaky Spotter;
- enemy projectile collision uses target radius + 5;
- final v47 projectile impact subtracts raw projectile damage directly from the locked target.

The final v25 `hitEnemy` wrapper applies Scout/Spotter mark, Climber climb vulnerability and Burrower damage reduction when a player hit occurs. Therefore those modifiers are evaluated **at projectile impact**, not when the projectile is fired.

The final v47 Spitter projectile path does **not** call the Acid-corrosion-aware structure damage helper. Spitter projectile impact therefore remains raw damage even if the structure is currently corroded. Direct Acid Lobber attacks continue to use the corrosion multiplier.

## Shared projectile owner

`js/combat/projectiles.js` owns the clean persistent projectile collection in `game.state.entities.projectiles`.

It exports:

- `emitProjectile()`
- `emitPlayerProjectile()`
- `emitEnemyProjectile()`
- `updateProjectiles()`

Prompt-7 player-unit emitters and Prompt-8 tower emitters are wired by default through `game.services.playerCombat.fireProjectile` and `game.services.towerCombat.fireProjectile` to `emitPlayerProjectile()`. External test/integration services may still override those hooks.

Prompt-9 Spitter emission uses `emitEnemyProjectile()` by default, while retaining its explicit optional service override.

Immediate/hitscan attacks remain immediate. Rocketeer, Tank, Combat Ship, Mobile Artillery, Railgun, Tesla, Cryo, Mortar and Missile are not converted into fake persistent projectiles merely for architectural uniformity.

### Player projectile impact

Player bullets collide physically and then call `applyPlayerEnemyDamage()`.

This intentionally means:

- current mark strength is read at impact;
- an expired mark no longer boosts a later-arriving shot;
- climbing vulnerability is read at impact;
- a burrowed enemy that is physically struck still receives the existing 20% damage behavior;
- one projectile damages one collided enemy and is then removed.

### Enemy projectile impact

Enemy projectiles keep the target they were fired at.

At impact:

- removed targets invalidate the projectile;
- Spotter invalidates an in-flight projectile;
- ordinary units/structures take raw projectile damage through the shared HP foundation;
- Landing Pads route through `damageLandingPadOrShip()`, so a live landed export ship correctly intercepts the hit and its destruction can lose loaded ship cargo.

This clean Landing-Pad integration preserves the newer economy ownership without adding a second export-ship lifecycle.

## One status-timing owner

`js/combat/statusEffects.js` is the only clean module that advances shared combat-status timers.

Weapon/ability systems are still responsible for **applying** their effect when they attack, because application rules are weapon-specific. The shared status runtime owns subsequent time progression.

### Marks

Scout/Spotter mark application remains available through `playerDamage.js::markEnemy()` for existing Prompt-7 call sites. `statusEffects.js` owns mark expiry and resets `markMult` to 1 when the timer expires.

The old Prompt-7 `tickEnemyMarks()` export is retained only as a compatibility no-op so there is no second mark timer owner.

### Burn

Burn ticking preserves the active behavior:

- burn duration is applied by the firing unit/tower;
- shared status processing decrements the duration/tick timer;
- when ready, burn deals the current Flame burn tick damage through `applyPlayerEnemyDamage()`;
- this means mark/Climber/Burrower modifiers still affect burn exactly as the legacy `hitEnemy()` path did;
- at most one burn tick is processed per simulation frame; no catch-up loop is introduced after a long frame.

### Cryo slow

The shared owner decrements `slowTime`. Movement consumes `effectiveEnemySpeed()`, which only uses `slowFactor` while the timer is positive. The factor is restored to 1 after expiry without adding a second enemy-movement implementation.

### Acid corrosion

`acidTime` on structures is decremented by the shared status owner.

Direct Acid-aware enemy attacks continue to read this state through `applyEnemyDamage()`. Persistent Spitter projectiles intentionally do not.

### Saboteur cloak

Saboteur cloak is not a generic timed status. `js/enemies/enemyStatus.js` now owns only its enemy-specific detection-driven cloak state and delegates common timing to the shared status system.

## Destruction/lifecycle owner

`js/combat/lifecycle.js` owns clean common destruction cleanup and Base game-over transition.

It intentionally builds on existing subsystem-specific ownership rather than duplicating it:

- dead enemy cleanup delegates to `js/enemies/enemyLifecycle.js`, preserving exactly-once bounty rewards;
- dead units are removed from their Platoon and stale references to the unit are cleared;
- dead structures are removed and clean selection references are cleared;
- Base damage uses the shared HP foundation, respects Unlimited Lives and transitions `state.session.gameOver` once;
- optional presentation/application callbacks remain service hooks rather than DOM/global imports.

### APC destruction

The final v28 behavior was traced precisely. When a destroyed APC has a passenger, the passenger is ejected and loses **30% of its current HP**:

`passenger.hp = max(1, passenger.hp * 0.70)`

This is not “set passenger to 30% HP.”

The clean lifecycle clears `transportedIn`, clears movement state, places the passenger near the destroyed APC using shared navigation blocking, then removes the APC.

### Export ships

Export ships are not ordinary structure entities and remain owned by the Landing Pad economy subsystem. Projectile hits against a Landing Pad call `damageLandingPadOrShip()`, which already owns landed-ship HP, cargo loss, no-Gold destruction and cooldown restart.

## Clean update integration

The clean future pipeline still remains dormant, but ownership is now explicit:

- enemy update advances shared status effects once before enemy AI;
- player/tower/enemy persistent shots all enter one projectile collection;
- `updateCombat()` advances that collection once and then invokes common destruction cleanup;
- enemy cleanup may invoke the same lifecycle owner after enemy AI so melee/direct-kill consequences are resolved before cache capture. Cleanup is idempotent: already-removed entities cannot be rewarded/destroyed twice.

Exact final system ordering must remain part of the later global-loop integration. In particular, the existing same-frame Scout/Spotter support behavior should be preserved when player/tower update ordering is finalized.

## What remains outside this migration

This prompt does **not** migrate:

- projectile drawing or combat FX;
- fog visibility or reveal rendering;
- HUD/game-over presentation;
- DOM input, camera or build placement;
- final global reset/RAF loop;
- the production script load path.

Those remain later integration/render/input work.

## Verification

`tests/projectiles-lifecycle.test.mjs` covers the cross-system risks introduced by this migration, including:

- physical player projectile collision;
- mark-at-impact semantics and mark expiry before impact;
- Burrower projectile damage behavior;
- locked Spitter target handling and Spotter invalidation;
- raw Spitter structure damage while Acid is active;
- Landing Pad/export-ship interception and cargo loss;
- projectile expiry/non-finite cleanup;
- burn, slow, mark and corrosion timing;
- exactly-once enemy reward cleanup;
- APC passenger ejection with 30% current-HP loss;
- Platoon cleanup after unit death;
- structure removal/selection cleanup;
- Base game-over and Unlimited Lives;
- clean combat projectile/lifecycle integration.

The final staging-branch validation runs **all clean-runtime test files**, not only this new suite, and syntax-checks the migrated modules. Before merge, the verified result was **162/162 passing, 0 failures** on Node 22.
