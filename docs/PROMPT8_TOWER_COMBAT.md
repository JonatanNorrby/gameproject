# Prompt 8 — Tower Combat Extraction

Prompt 8 migrates the clean future ownership of tower targeting, cooldowns, upgraded effective stats and tower-specific attack execution. The production page still runs the existing legacy tower loop; no Prompt-8 production bridge is installed, so old and new tower combat cannot fire simultaneously.

## Current tower roster

The current roster contains exactly ten combat towers: Laser, Flame, Railgun, Tesla, Anti-Air, Cryo, Mortar, Minigun, Missile and Drone Bay. v21 is the final combat owner for Laser/Flame/Railgun/Tesla; v22 wraps it for the six later towers. v47 does not replace tower combat, but it replaces the shared target helpers with targetable/visibility-aware versions, so those final eligibility semantics are preserved by the clean target finder.

## Clean ownership

- `js/combat/towerStats.js`: `getEffectiveTowerStats()` is the clean authoritative 1/3–3/3 combat-stat view. It consumes canonical Prompt-3 tower configuration and upgrade modifiers and exposes range, damage, interval, targeting, special values and upgrade costs in one place.
- `js/combat/towerTargeting.js`: ordinary nearest and nearest-N tower target acquisition using Prompt-6 alive/eligibility/range rules. It preserves strict `< range` callers versus inclusive `<= range` callers and accepts the existing fog/reveal behavior through service callbacks rather than importing fog ownership.
- `js/combat/towerCombat.js`: one `updateTowerCombat(game, dt)` owner with a small explicit handler for each tower type. It never chains legacy tower updates or temporarily filters structures/enemies.
- `js/towers/towers.js`: clean tower-system entry point delegates once to `updateTowerCombat()`.

## Effective upgrade stats

Upgrade level remains clamped to 1–3. Costs and modifiers are unchanged. The clean effective-stat layer also resolves one old-data ambiguity: v21's live Laser progression is one normal projectile target at 1/3, one normal projectile target at 2/3, then a two-target prism line at 3/3. An older Laser `MAX_TARGETS`-shaped config field is not treated as level-1 upgrade pierce.

## Tower behavior parity

- Laser: 1/3 and 2/3 emit the existing `laser` projectile; 3/3 resolves the current two-target prism line. Laser cooldown still respects the retained `laserRate` modifier.
- Flame: selects nearest targets and applies burn duration only; burn damage/ticking remains enemy-status-owned. Current `burnDuration` modifier remains respected.
- Railgun: direct hitscan line, current width and 3/5/7 maximum target progression.
- Tesla: nearest initial target followed by 4/5/7 chained targets, strict chain range, current decaying chain multiplier.
- Anti-Air: air-only target acquisition, 1/2/3 projectile burst; 3/3 applies current 44-radius 45% flak damage to nearby Flyers.
- Cryo: 1/2/4 nearest targets, current direct damage plus `slowFactor`/`slowTime` fields. Slow ticking remains enemy-status-owned.
- Mortar: ground-only, inclusive 105 minimum range, immediate current splash; 3/3 adds three current cluster explosions.
- Minigun: current projectile stream, 1/1/2 barrel progression.
- Missile: dual-purpose nearest target(s), immediate splash, 1/1/2 salvo progression. Current implementation is not a persistent homing projectile.
- Drone Bay: 1/2/3 moving orbit firing points around the structure; it does not own persistent spawned Drone entities.

## Temporary dependencies intentionally left outside Prompt 8

Projectile travel/collision remains the existing shared later-migration dependency. Laser 1/3–2/3, Anti-Air, Minigun and Drone Bay emit the same projectile records through `game.services.towerCombat.fireProjectile` when supplied, otherwise into clean `state.entities.projectiles`. FX can similarly route through `game.services.towerCombat.emitEffect`.

Burn ticking and Cryo slow expiration/speed application remain in the current enemy/status update. Prompt 8 writes the same status fields only. Enemy death rewards/removal can later be supplied through `game.services.towerCombat.onEnemyDestroyed`.

No enemy movement, attacks, waves, spawning, cache guards, fog implementation, economy, Truck/Landing Pad logic, UI architecture, rendering ownership or placement logic is migrated here.

## Activation ordering caution

The production runtime still uses legacy `updateTowers()`. Do not add a Prompt-8 wrapper to activate the clean loop early. At final activation, call the clean tower owner exactly once. Player-unit combat should still run before tower combat if same-frame Scout/Spotter marks are expected to affect tower damage as they do in the current runtime.
