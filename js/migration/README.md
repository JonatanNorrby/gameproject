# Manual move migration bridge

Prompt 5 keeps the existing input system in place and extracts only the meaning of a normal manual unit move.

`manualMoveLegacyBridge.js` is a temporary classic-script compatibility bridge loaded after the current legacy runtime. It captures the final `handleTap` only to intercept the already-resolved **normal empty-terrain unit move** case. Unit selection, tower/building selection, build placement, wall placement, Truck route editing, Platoon attach mode, Medic attach mode, APC attach mode and other special interactions are delegated unchanged to the prior handler.

The bridge calls the ES-module adapter in `manualMoveBridge.js`, which presents legacy unit/world arrays through the clean game shape and invokes `issueManualMove()` from `js/units/commands.js`. The command layer then calls Prompt 4's `setUnitDestination()` movement primitive; it does not calculate paths itself.

The bridge exists because the production page still uses the legacy click stack. Remove both bridge files and the small loader in `v18_hotfix.js` when the clean input/runtime activation prompt makes `js/input/` the real click owner. Do not extend this bridge with combat, building placement, UI, Truck logistics or other unrelated behavior.
