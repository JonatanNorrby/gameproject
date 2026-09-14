// Browser-module bootstrap for Step 6. Dynamic import keeps failure recoverable:
// the classic host retains the previous legacy owners until installation succeeds.
(async function bootstrapBuildingPlacementMigration(){
  const host=window.__apdBuildingPlacementLegacyHost;
  if(!host)return;
  try{
    const module=await import('./buildingPlacementLegacyBridge.js?v=1');
    module.installLegacyBuildingPlacementBridge(host);
  }catch(error){
    if(typeof host.markFailed==='function')host.markFailed(error);
    else console.error('Building placement migration bootstrap failed.',error);
  }
})();
