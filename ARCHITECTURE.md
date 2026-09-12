# Clean Runtime Architecture

## Status

The clean ES-module runtime under `js/` is still not the main production runtime. The production page continues to load the legacy `config.js` + versioned script stack and does not import `js/main.js`.

Prompt 3 completed the safe foundational data layer. Prompt 4 extracted basic unit destination/pathfinding. Prompt 5 extracted the narrow manual move/Platoon/support command seam. Prompt 6 added the shared combat foundation. Prompt 7 now gives the clean runtime **one authoritative player-unit combat/support update** in `js/combat/unitCombat.js`.

Prompt 7 does not activate a new production combat bridge. The currently loaded legacy game still executes its old unit-combat wrapper chain until a later activation step. The clean runtime itself no longer needs that chain: target acquisition, player attack decisions, Medic healing, Engineer/Repair Vehicle repair, Spotter marking, direct splash attacks and player-mine detonation are represented directly by role strategies.

The temporary Prompt 5 movement bridge under `js/migration/` is unchanged. Prompt 7 adds no `handleTap`, `hitEnemy`, `damageTarget`, tower-combat, enemy-AI, wave, fog, economy, UI or rendering wrapper.

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
| Shared combat foundation | `js/combat/damage.js`, `targeting.js`, `range.js`, `cooldowns.js` | MIGRATED |
| Player damage modifiers / marks | `js/combat/playerDamage.js` | MIGRATED FOR PLAYER-UNIT DAMAGE |
| Player target acquisition | `js/combat/unitTargeting.js` | MIGRATED FOR PLAYER UNITS |
| Medic healing | `js/combat/healing.js` | MIGRATED |
| Engineer / Repair Vehicle repair | `js/combat/repair.js` | MIGRATED |
| Player mine trigger/detonation | `js/combat/unitMines.js` | MIGRATED; placement remains legacy/UI-owned |
| Player-unit combat/update flow | `js/combat/unitCombat.js`, `js/combat/combat.js` | MIGRATED FOR PROMPT 7 SCOPE |
| Projectile travel/collision/impact | legacy `state.bullets` / `updateProjectiles` | NOT MIGRATED |
| Enemy death rewards/removal lifecycle | legacy combat lifecycle | NOT MIGRATED |
| Enemy director/AI runtime | `js/enemies/enemies.js` | SKELETON CREATED |
| Tower combat runtime | `js/towers/towers.js` + legacy runtime | NOT MIGRATED |
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

`js/core/parity.js` records these as a verification fixture, not as a second runtime config source.

## Canonical IDs and aliases

Player unit IDs:
`rifleman`, `heavygunner`, `rocketeer`, `medic`, `engineer`, `scout`, `sniper`, `flametrooper`, `spotter`, `minelayer`, `mech`, `combatdrone`, `combatship`, `tank`, `mobileartillery`, `repairvehicle`, `apc`, `mgcar`, `truck`.

The only retained unit alias is `soldier -> rifleman` because `soldier` is still a real legacy build/runtime identifier. The former purchased `platoon` entity is not an alias or unit: v29 removed it and Platoons are control groups.

Enemy IDs:
`ravager`, `swarm`, `runner`, `brute`, `spitter`, `flyer`, `siegebeast`, `burrower`, `climber`, `acidlobber`, `crusher`, `harvesterhunter`, `saboteur`.

`spitter` is the canonical runtime ID even though its old config object was named `RANGED_ALIEN`. `swarm` remains defined for compatibility/balance references but is marked non-spawnable because current v24 spawning does not select it.

Tower IDs:
`laser`, `flame`, `railgun`, `tesla`, `antiair`, `cryo`, `mortar`, `minigun`, `missile`, `dronebay`.

Building IDs:
`base`, `mine`, `oremine`, `refinery`, `landingpad`, `wall`. Historical `bunker`, `safespot`, and `blockade` definitions remain explicitly disabled: Bunker is removed by v47, Safe Spot by v21, and Blockade was replaced by Wall in v15.

## Traits/classification

Static relationships live on canonical registry traits. `js/core/entities.js` derives flying/ground, infantry/mechanical/vehicle, repairable/healable, support/combat, transport/logistics, Platoon eligibility, enemy movement class, tower/building identity and canonical radii.

Prompt 7 uses `isHealableUnit()` for Medic targets and `isRepairableUnit()` for mechanical repair instead of another hard-coded role list. Dynamic world restrictions still remain system-owned.

## Prompt 4 movement primitive

`js/movement/movement.js` owns individual destination assignment and the basic path follower. Ground units delegate path creation to `js/navigation/pathfinding.js`; player aircraft retain direct one-waypoint movement.

## Prompt 5 manual move command routing

`js/units/commands.js` is the authoritative clean command seam for manual unit moves. `issueManualMove(game, unit, x, y)` decides whether a player command is individual or Platoon-wide, clears current Medic/APC automatic support when appropriate, preserves established manual Truck route cancellation and delegates destinations to Prompt 4.

`issueMove(..., { source: 'support-ai' })` makes command intent explicit so internal support movement does not detach itself or expand into a Platoon order.

`js/units/platoons.js` ports movement-only helpers from v29. Formation behavior remains unchanged: first member at the clicked point, later members on 54px rings using angle `index * 2.399963229728653`, radius-based world clamping and center fallback for an invalid offset. Legacy slowest-member speed behavior remains active.

`js/units/support.js` owns Prompt-5 detach operations only. Medic detach clears its v47 follow ID/timer; APC detach clears its v47 support unit/Platoon IDs and timer. Transport/passenger state is not changed.

## Temporary production bridge

`js/migration/manualMoveLegacyBridge.js` remains the only migration `handleTap` bridge. It is loaded after the full legacy stack by the small loader in `v18_hotfix.js`, intercepts only the normal empty-terrain manual-move case and delegates every other click to the prior legacy handler.

Remove the bridge files and loader when clean input becomes the real click owner. Do not expand this bridge into combat, UI, building placement, logistics or other systems.

## Prompt 6 shared combat foundation

`js/combat/damage.js` defines the base HP contract. `isAlive(entity)` means finite numeric `hp > 0`; zero and negative HP are dead. `applyDamage(game, target, amount, context)` validates target/damage, subtracts damage once, intentionally permits overkill below zero to match the live runtime, and returns whether the hit was lethal. Repeated damage against an already-dead target is rejected and cannot revive it or re-fire the destruction notification.

`applyDamage()` accepts an optional `context.onDestroyed` callback but does not implement lifecycle consequences. Enemy rewards/removal, structure cleanup, selected-unit cleanup, Base game-over, transport destruction, Landing Pad export-ship cargo loss/cooldown and other destruction behavior remain with their current owners until those systems migrate.

`js/combat/targeting.js` owns generic eligibility only, not priority/search. It rejects dead, transported/garrisoned, burrowed and unrevealed cloaked targets as appropriate and uses canonical air/ground classification. Fog visibility is callback-driven rather than imported into combat.

`js/combat/range.js` preserves both live distance styles. Default `center` mode is center-to-center for ordinary targets; Walls use point-to-segment distance. `footprint` mode subtracts attacker/target radii and uses half Wall thickness. `isInAttackRange()` supports min range and strict/inclusive maximum boundaries.

`js/combat/cooldowns.js` preserves the basic timer convention: decrement by `dt`, allow the value to pass below zero, ready when `<= 0`, and reset to the exact caller-provided duration.

### Dead-unit normalization review

v53 repairs HP only when HP is non-numeric and explicitly preserves zero/negative HP; its normalization runs at construction/reset boundaries, not inside `drawUnit()`. No legacy renderer change was necessary.

## Prompt 7 player-unit combat

### One update owner

`updatePlayerUnitCombat(game, dt)` in `js/combat/unitCombat.js` is the clean future owner for player-unit combat/support updates. It uses small behavior strategies rather than chaining old wrapper generations or temporarily removing units from `state.units`.

The clean order intentionally preserves the effective final wrapper order without reproducing its implementation:

1. v25-era player roles in current state order: Heavy Gunner, Rocketeer, Engineer, Scout, Sniper, Flamethrower Trooper, Spotter, Mine Layer, Combat Mech, Combat Drone, Combat Ship.
2. Player mine trigger/detonation.
3. v26 special vehicles: Tank, Mobile Artillery, Repair Vehicle.
4. APC.
5. Machinegun Car.
6. Medic (v47 final owner).
7. Rifleman (v47 final owner).

This ordering matters for same-frame mark effects. Spotter marking therefore still affects later Tank/APC/Machinegun Car/Rifleman attacks exactly as the active wrapper ordering allows.

### Target acquisition

`js/combat/unitTargeting.js` owns ordinary nearest-enemy acquisition and nearest-N acquisition for player units. It uses Prompt 6 `canAttackTarget()` + range checks and canonical movement classification.

Normal `findTarget` parity remains strict `< max range`. Mobile Artillery uses the current inclusive `<= max` / `>= min` `findTargetWhere` semantics. Flamethrower Trooper nearest-N selection is inclusive at its range boundary.

Fog is not migrated. If a future activation needs current fog-gated firing, the clean target helper consumes `game.services.playerCombat.isEnemyVisible` or `game.services.fog.isVisible` rather than importing fog state directly.

### Damage and marks

`js/combat/playerDamage.js` applies player-unit direct damage through Prompt 6 `applyDamage()`. It preserves the active `hitEnemy` damage modifiers that matter to these attacks: Scout/Spotter mark multiplier, Climber climbing vulnerability, and the current 20% Burrower damage behavior for splash paths that can still touch a burrowed enemy.

Scout marks its chosen target when firing for 2.2 seconds at 1.15x damage. Spotter marks every currently eligible enemy within 375 for 0.32 seconds at 1.20x damage. Mark expiry is ticked once per player-combat update before role execution.

The legacy tower path still reads the same `markTime` / `markMult` fields through `hitEnemy`, so Prompt 7 does not disconnect Spotter/Scout support from legacy towers.

### Projectile dependency

Prompt 7 migrates projectile **firing ownership**, not projectile simulation. Rifleman, Heavy Gunner, Scout, Sniper, Combat Mech, Combat Drone, APC and Machinegun Car now emit the current projectile data (muzzle point, jitter, speed, damage, 2.2s life and projectile type) through `game.services.playerCombat.fireProjectile` when supplied, otherwise into clean `state.entities.projectiles`.

Projectile travel, collision and impact remain legacy-owned for now. This avoids building a second projectile engine. A later activation adapter must route these emitted projectile records into the existing projectile simulation or replace that simulation once, centrally.

Rocketeer, Combat Ship, Tank and Mobile Artillery are **not** converted into fake projectiles because their current final implementations resolve splash damage immediately and use effects only for presentation.

### Flamethrower Trooper

The current Flamethrower Trooper remains a nearest-three direct attack: 130 range, 1.5 immediate damage per target, 0.18 fire interval and 2.4 burn duration. It can target both ground and flying enemies because its canonical targeting mode is `any`.

Prompt 7 sets the existing `burn` / `burnTick` status fields exactly as the current unit attack does. Burn ticking itself remains in the legacy enemy update until status processing gets its own owner; it is not duplicated here.

### Mine Layer

Mine placement remains manual/UI/economy-owned: Prompt 7 does not move the button, Gold spending, placement limit or placement checks. `js/combat/unitMines.js` migrates the existing automatic trigger/detonation pass because that pass was embedded inside old `updateUnitCombat`.

Current mine values remain: ground-only trigger, Burrowers excluded while underground, 25 trigger radius plus enemy radius, 95 primary damage, 58 splash radius and 72% secondary splash damage.

### Medic healing

`js/combat/healing.js` owns healing only. Medic uses the current 165 range and 11 HP/second, chooses the lowest HP-ratio active healable infantry target, breaks equal-ratio ties by nearest distance, caps at `maxHp`, and never heals dead, transported, garrisoned or mechanical units.

Medic follow/attach/detach/manual movement stays outside combat. Prompt 7 never writes a destination or path for Medic support movement.

### Engineer repair

`js/combat/repair.js` uses canonical `isRepairableUnit()` for unit eligibility and preserves built structures as valid repair targets. Engineer remains 120 range / 18 HP per second and keeps lowest-HP-ratio priority.

Prompt 7 intentionally fixes the old wrapper interaction that defeated v53's intended Engineer classification: v26 temporarily removed Tank, Mobile Artillery and Repair Vehicle from `state.units` before v25 Engineer targeting ran. The clean update does not filter state, so Engineer now consistently repairs all nine intended mechanical roles: Truck, Combat Mech, Tank, Mobile Artillery, Repair Vehicle, APC, Machinegun Car, Combat Drone and Combat Ship. Dead units are never revived.

### Repair Vehicle

Repair Vehicle shares the same canonical repairability source but keeps its current 150 range / 34 HP per second and its legacy scan/priority behavior. It can repair the same mechanical role set plus built structures and cannot repair itself or dead units.

### Rifleman migration continuity

Rifleman preserves v47's separate per-member cooldown state when migrating an existing object: `v47RifleCooldowns` is accepted as a one-time state fallback before the clean `combatCooldowns` field becomes authoritative. Other roles accept their current `cooldowns` array similarly. No version wrapper is created.

Rifleman retains current `extraSoldiers`, `soldierDamage`, `soldierRate`, ±0.009 aim jitter, 2.2s projectile life and 170ms firing-state timestamp behavior.

## Enemy base values vs horde values

Enemy registries preserve base growth values and current v47 horde multipliers separately. Normal horde enemies are created from the base formula, then v47 applies per-type HP/contact-damage multipliers. Global movement is multiplied by 0.30. Do not pre-bake these multipliers into base values during later AI/spawn migration or they will be applied twice.

Special direct attacks that v47 mutates globally are already stored at their current effective values: Acid Lobber shot 6.3 and Crusher charge 104.4.

## Tower upgrades

`js/towers/towerConfig.js` owns upgrade presentation data and exact current numeric modifiers from active v21/v22 stat logic. `getTowerLevelStats()` is pure derived-data logic only; tower firing remains legacy-owned.

## State ownership

`js/core/state.js` remains the only clean state creator/reset owner. The Prompt 5 movement adapter still exposes current unit/world arrays only for move commands. Prompt 7 introduces no replacement global state object and does not require temporary removal or type-masquerading of units.

## Pure helpers

`js/utils/math.js`: clamp, lerp, distance/squared distance, angle-between, angle normalization, numeric comparison.

`js/utils/geometry.js`: circle/radius checks, nearest point to segment, point-to-segment distance, segment intersection/distance, world-bound tests/clamping.

`js/utils/helpers.js`: deep freeze, finite-number checks, explicit registry lookup failure, deterministic-injectable ID factory.

## Validation and parity

`validateGameConfig()` performs on-demand structural/numeric validation and is not executed every frame.

`compareConfigParity()` compares required key values and tower upgrade stats against the Prompt-3 snapshot traced from the current legacy load order.

Prompt 3 validation result: **0 errors** across 19 units, 13 enemies, 10 towers, and 9 building records.

Prompt 3 parity result: **0 mismatches** for compared current effective values.

Prompt 5 isolated command regression result: **16/16 passed**.

Prompt 6 isolated combat-foundation regression result: **16/16 passed**.

Prompt 7 isolated player-unit combat/support regression result: **35/35 passed**. Coverage includes all 19 canonical unit roles, projectile emission, direct splash/falloff, artillery min/max range, Flamethrower burn application, Spotter/Scout marks, mine detonation, Medic target priority/capping/no-revival/no-movement mutation, Engineer eligibility for all nine repairable mechanical roles, Repair Vehicle behavior, Truck non-combat behavior and ground/air regressions.

## Legacy runtime / migration rules

`index.html` still does not import `js/main.js`, and Prompt 7 creates no new `vXX.js` file. No legacy file is deleted. No production player-combat bridge is installed in this prompt, so the currently loaded page still executes its old unit-combat wrapper chain until the later activation phase.

The clean runtime's `js/combat/combat.js` now delegates to `updatePlayerUnitCombat()` and therefore has one player-unit combat owner when the clean runtime is eventually activated.

The Prompt 5 movement bridge remains the documented temporary exception to the no-wrapper migration rule. Do not stack a combat wrapper on top of the legacy chain merely to activate Prompt 7 early.

## Next-phase caution

Tower combat is still entirely legacy. A later tower migration must preserve Scout/Spotter marks because the current legacy `hitEnemy` wrapper applies those multipliers to tower damage too. Reuse the shared damage/mark semantics rather than inventing a tower-only copy.

Persistent projectile travel/impact is still a shared dependency for player projectile units and several towers. Migrate it once when appropriate; do not create separate unit and tower projectile engines.

Flamethrower burn ticking still lives in the legacy enemy update. When enemy/status processing migrates, move that tick ownership once and avoid double-ticking burns applied by both units and Flame Towers.

Enemy death/reward/removal remains outside Prompt 7. `applyPlayerEnemyDamage()` can call `game.services.playerCombat.onEnemyDestroyed` when a later lifecycle owner is ready, but Prompt 7 does not migrate kill rewards, particles, cache behavior or wave logic.

Export ships remain a special Landing Pad lifecycle with `shipHp`, not a generic `.hp` combat entity. Base damage/game-over remains a separate lifecycle.

The current v47 director dynamically tunes spawned horde enemies while cache guards use untuned base enemy HP/damage with the same global 0.30 speed multiplier. Future enemy migration must preserve that distinction and must not apply horde multipliers twice.
