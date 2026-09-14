// Browser-module bootstrap for Step 6. Dynamic import keeps failure recoverable:
// the classic host retains the previous legacy owners until installation succeeds.
//
// Step 3 previously wrapped the aggregate cleanup seam to inject unit-only cleanup.
// Wait for that migration to settle before Step 6 replaces the seam with the final
// unit + structure composition; this makes ownership deterministic even if dynamic
// module downloads complete out of document order.
(async function bootstrapBuildingPlacementMigration(){
  const host=window.__apdBuildingPlacementLegacyHost;
  if(!host)return;
  try{
    while(window.__apdUnitCombatMigration?.owner==='loading'){
      await new Promise(resolve=>setTimeout(resolve,0));
    }
    const module=await import('./buildingPlacementLegacyBridge.js?v=1');
    module.installLegacyBuildingPlacementBridge(host);
  }catch(error){
    if(typeof host.markFailed==='function')host.markFailed(error);
    else console.error('Building placement migration bootstrap failed.',error);
  }
})();
