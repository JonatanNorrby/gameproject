# Clean Buildings + Economy + Logistics Runtime

## Scope and activation status

This migration creates clean future runtime ownership for economic buildings, Gold/Metal transactions, physical Crystal/Ore, resource depots and mines, Truck cargo/routes/service, Refineries, Landing Pads and export ships.

It is deliberately **not activated in production**. `index.html`, the global RAF/update loop, reset integration, build/placement UI, input listeners, fog, rendering, assets, camera, menus and projectiles remain unchanged. The existing legacy page must continue to run only its legacy economy loop until a later integration/cutover prompt.

## Effective legacy ownership traced before extraction

The clean behavior is based on the final loaded runtime, not file-version comments:

- v16 introduced Gold/Metal, shaped-resource depots, Crystal/Ore mining, Trucks, Refineries and Landing Pads.
- v26 raised the effective Mine-per-depot limit to 3 and added Landing Pad warehouse limits plus a landed export ship with HP and cargo-loss-on-destruction.
- v30 is the final owner of starting economy, Crystal-Mine/Ore-Mine currencies, Refinery/Landing-Pad storage upgrades and service-aware auto-start Truck routes.
- v32 changes exported Crystal value to 4 Gold per Crystal.
- v47 removes Bunkers from the active runtime; the canonical clean Bunker definition stays disabled.
- v51 only corrects old rendered storage labels by reading v30's authoritative storage helpers; it does not introduce a second economy capacity.

## Resource ownership

`js/economy/resources.js` owns transactions.

Global wallet resources:

- `gold`
- `metal`

Physical logistics resources:

- `crystal`
- `ore`

The clean API exposes `getResource`, `addResource`, `canAfford`, `spendResources`, `refundResources`, and validated physical-store transfer helpers. Crystal and Ore are intentionally not merged into the global wallet: they remain finite cargo/storage resources moving through Mines, Trucks, Refineries and Landing Pads.

`spendResources()` is atomic. A failed multi-resource purchase changes nothing. Gold keeps the existing unlimited-cash debug semantics. Tower-upgrade UI is not migrated here; it can spend its already-migrated Metal upgrade cost through the same resource API.

## Building runtime ownership

`js/buildings/buildingRuntime.js` owns runtime initialization for:

- Main Base state needed by this subsystem;
- Crystal Mine;
- Ore Mine;
- Refinery;
- Landing Pad.

`createBuildingRuntime()` creates post-placement runtime entities with ID/type/position/HP/build state and type-specific storage state. Placement validation/cursor/input remain external.

`updateEconomicBuildingConstruction()` owns construction progress only for these economic structures. It preserves the existing base build-time decrement and the v25 Engineer acceleration: +40% construction progress per nearby Engineer, up to two Engineers, using the existing 120px Engineer range. Tower/Wall construction remains outside this migration.

Bunker is intentionally disabled because v47 removes it from the current intended runtime. Safe Spot and Blockade also remain disabled historical definitions.

## One storage-capacity source

`getStorageCapacity(building)` is authoritative for both acceptance logic and future UI presentation.

Refinery:

- 1/3: 260 Ore
- 2/3: 440 Ore
- 3/3: 700 Ore
- upgrade costs: 80 Gold, then 140 Gold

Landing Pad:

- 1/3: 520 Crystal
- 2/3: 800 Crystal
- 3/3: 1200 Crystal
- upgrade costs: 180 Gold, then 300 Gold

Legacy compatibility fields (`oreStored`, `crystalStored`, Mine `stored`) are accessors over the same resource store; they are not separate authoritative counters.

## Resource depots and mining

`js/economy/depots.js` owns clean depot state and mine relationships.

Exact starting-stock formulas are preserved:

- Crystal: `round(850 + distanceFromBase * 0.72)`
- Ore: `round(700 + distanceFromBase * 0.60)`

Each matching depot supports at most 3 living Mines. The runtime validates this below the UI. Mine slot offsets remain `[0,-12]`, `[-15,10]`, `[15,10]`.

`js/economy/mining.js` owns extraction:

- Crystal: 3.2/sec
- Ore: 2.8/sec
- Mine base storage: 100
- current `mineRate` / `mineStorage` modifiers are preserved
- extraction is clamped by elapsed production, remaining finite depot stock and Mine free capacity
- depleted depots cannot generate new resource

Current effective Mine costs remain Crystal Mine 45 Metal and Ore Mine 20 Gold.

## Truck cargo and service

`js/economy/truckLogistics.js` is the clean logistics owner.

Truck cargo has one `cargoStore` with:

- resource type (`crystal`, `ore`, or empty);
- amount;
- effective capacity.

Current base capacity is 45 and still honors the existing `truckCapacity` modifier. Mixed cargo is rejected.

Current service rules are preserved:

- Mine pickup range: 100
- Refinery unload range: 105
- Landing Pad unload range: 120
- Mine loading is immediate up to Truck capacity
- Crystal unloads only to Landing Pads
- Ore unloads only to Refineries
- incompatible service buildings do not consume/convert cargo
- manually controlled Trucks service nearby buildings only while actually stopped

## Truck routes

Routes remain arrays of normal map stops and/or exact `buildingId` service stops.

Clean route lifecycle:

1. route recording clears prior route movement/service state;
2. finishing requires at least two stops;
3. the route auto-starts immediately, matching v30;
4. the Truck is removed from its Platoon;
5. the first route stop is sent through the existing clean movement command using `source: 'logistics'`;
6. arrival sets `routeWaiting` and clears the movement target;
7. exact service stops wait until the current service is complete;
8. generic waypoints advance immediately;
9. the next index wraps modulo route length.

A Mine service stop waits until the Truck is full or both the attached depot and Mine buffer are depleted. A full Refinery/Landing Pad makes the Truck wait until processing/export creates room.

Player movement remains distinct: `source: 'player'` clears active/loop/pending clean route ownership before reusing Prompt-4 pathfinding. Logistics movement does not detach/cancel its own route.

No pathfinding is implemented inside logistics.

## Refinery

`js/economy/refinery.js` owns passive conversion.

Current runtime behavior is continuous, not batch or immediate-on-delivery:

- consume up to 4.5 Ore/sec;
- produce Metal 1:1;
- never consume more Ore than is stored.

All Metal changes use the resource transaction API.

## Landing Pad and export ship

`js/economy/landingPads.js` owns each Pad independently.

The current runtime only needs two ship states:

- `cooldown`
- `landed`

There are no invented arrival/loading/launch animation states.

Current ship values:

- initial cooldown: 0 seconds;
- subsequent cooldown: 120 seconds per Pad;
- capacity: 220 Crystal;
- HP: 260;
- load rate: 34 Crystal/sec;
- attraction radius: 720;
- export value: 4 Gold/Crystal, therefore 880 Gold for a full ship.

When cooldown reaches zero, that Pad receives a fresh landed ship with 260 HP and zero cargo. It emits `game.services.landingPads.onShipLanded(game, pad, { ship, attractRadius: 720 })`; enemy AI is not imported into economy.

While landed, the ship gradually transfers Crystal from only that Pad's warehouse. Reaching 220 launches immediately, grants 880 Gold through the resource API, clears ship cargo/HP, and restarts that Pad's 120-second cooldown.

Multiple Landing Pads have separate warehouse stores, levels, cooldowns, export ships, HP and cargo.

## Ship damage and cargo loss

`damageLandingPadOrShip(game, pad, amount, context)` makes target ownership explicit:

- if a live landed export ship exists, damage applies to the ship;
- if no live landed ship exists, damage applies to the Landing Pad;
- a lethal ship hit immediately discards loaded ship cargo, grants no Gold, leaves warehouse Crystal unchanged and starts the 120-second cooldown;
- later hits cannot keep damaging a stale dead ship.

The function uses the Prompt-6 shared HP foundation. Prompt-9 enemy combat can adapt its existing external `damageTarget` seam to this function. Prompt-9 already applies Acid corrosion before that seam, so economy must not apply the corrosion multiplier a second time.

## Clean update ownership/order

`js/economy/economy.js::updateEconomy(game, dt)` is the future authoritative clean economy/logistics pass:

1. resource Mine extraction;
2. Refinery processing;
3. Landing Pad/export-ship update;
4. Truck service/route progression.

The order preserves the meaningful legacy ordering while assuming the future clean pipeline invokes economy after unit movement. Production does not invoke this pass yet.

`js/buildings/buildings.js::updateBuildings()` owns Main Base/economic-building runtime normalization and economic-building construction. Placement, worker UI, towers and Walls remain outside this prompt.

## External service seams still required

This subsystem intentionally requires narrow external integration rather than legacy globals:

- `game.services.logistics.issueMove(...)` — optional movement adapter; otherwise clean `issueMove()` is used.
- `game.services.landingPads.onShipLanded(...)` — enemy-attraction signal.
- `game.services.landingPads.onShipLaunched(...)` / `onShipDestroyed(...)` — presentation/notification hooks.
- `game.services.buildings.createBuildingId(...)` — optional application ID source.
- `game.services.buildings.onConstructionComplete(...)` — presentation/worker notification hook.
- Prompt-9 `enemyCombat.damageTarget` should route Landing Pad targets through `damageLandingPadOrShip()` at integration time.

Global Base game-over, full structure destruction cleanup, workers/placement input, HUD notifications and rendering remain external.

## Verification

`tests/economy-logistics.test.mjs` is the committed clean-runtime regression suite. It covers:

- atomic Gold/Metal spending and existing tower-upgrade Metal cost compatibility;
- exact economic building currencies;
- distance-scaled Crystal stock;
- 3-Mines-per-depot enforcement;
- finite Crystal/Ore extraction;
- Truck capacity, cargo compatibility, route source/loop/wait/manual override;
- every Refinery/Landing Pad storage level and upgrade path;
- passive Ore-to-Metal conversion;
- full Crystal Depot → Mine → Truck → Landing Pad → Ship → Gold flow;
- full Ore source → Mine → Truck → Refinery → Metal flow;
- ship initial/subsequent cooldown, gradual loading and launch;
- ship destruction, cargo loss, no Gold and next cycle;
- independent multiple Landing Pads;
- 720px landing attraction signal;
- disabled Bunker status;
- Engineer-assisted economic construction.

The committed suite was executed on Node 22 in GitHub Actions against commit `e7e3e974ba3f273f9184b0e74be5a514962dd678` and passed **20/20** with zero failures, skips or cancellations. The only later staging commit before merge removes the temporary validation workflow and updates this verification paragraph; no subsystem source or test file changed after the passing run.

Production activation is intentionally not part of this verification.
