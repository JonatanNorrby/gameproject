# Clean Buildings + Economy + Logistics Runtime

## Production status

The clean economy/logistics runtime is **active in production** on the final migration stack. Production no longer executes the legacy economy loop from the versioned JavaScript files.

Authoritative ownership lives in:

- `js/economy/resources.js` — Gold/Metal wallet and physical resource stores;
- `js/economy/depots.js` — finite Crystal/Ore depots and Mine links;
- `js/economy/mining.js` — Crystal/Ore Mine extraction;
- `js/economy/refinery.js` — Ore → Metal conversion;
- `js/economy/landingPads.js` — warehouse/export-ship cycle, ship HP and cargo loss;
- `js/economy/truckLogistics.js` — Truck cargo, automatic service and recorded-route service;
- `js/buildings/buildingRuntime.js` — economic-building storage/runtime state;
- `js/buildings/placement.js` — economic-building placement/cost/worker rules;
- `js/core/runtime.js` — final frame ordering.

## Frame ordering

The final production scheduler intentionally preserves the timing established during the incremental migration:

1. Crystal/Ore Mine extraction;
2. Refinery processing;
3. Landing Pad/export-ship processing;
4. unit movement;
5. Truck loading/unloading and route-stop service.

Do not collapse this into a differently ordered aggregate pass without proving parity; Truck service is intentionally evaluated after movement.

## Canonical behavior

- Crystal Mines cost 45 Metal.
- Ore Mines cost 20 Gold.
- Refineries cost 35 Gold.
- Landing Pads cost 500 Gold.
- A Crystal depot supports at most three Crystal Mines.
- Crystal depot stock increases with distance from the Main Base through the canonical depot-stock function.
- Ore Mines produce physical Ore; Refineries convert stored Ore to Metal at the canonical 4.5 Ore/Metal per second, 1:1.
- Logistics Trucks carry one cargo type at a time and use the canonical 45-unit capacity.
- Refinery and Landing Pad storage use the shared 1/3 → 3/3 storage runtime.
- Landing Pads have independent warehouse/export-ship state, so multiple Pads work independently.
- Export ships are destructible while landed; destroying a ship loses its loaded Crystal and grants no Gold.
- The current export ship loads up to 220 Crystal at 34 Crystal/second, sells Crystal for 4 Gold each, then begins its 120-second return cycle.
- A ship landing attracts nearby enemies within the configured 720-unit radius.
- Bunker remains disabled and is not part of the active economy/building runtime.

## State ownership

There is one clean state tree. Economic structures use canonical resource stores rather than a second compatibility economy. Truck cargo and building storage are read directly by clean simulation and clean presentation.

The old aliases and `js/migration/economyLegacyBridge.js` remain only as historical migration code. They are not loaded by `index.html` and must not be used for new production features.

## Tests

Economy/logistics regressions cover atomic Gold/Metal transactions, distance-scaled finite depots, three-Mine enforcement, extraction/depletion, Truck cargo compatibility, route service, storage tiers, Refinery conversion, full Crystal export and Ore→Metal loops, independent multiple Landing Pads, ship destruction/cargo loss and the 720-unit landing-attraction callback.
