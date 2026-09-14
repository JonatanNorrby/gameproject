// Browser-module bootstrap for Step 7. Keep the classic host as the recoverable
// fallback and wait for Step 6 to settle so dynamic module download timing cannot
// reorder ownership across migration steps.
(async function bootstrapRenderingFogCameraMigration(){
  const host=window.__apdRenderingFogCameraLegacyHost;
  if(!host)return;
  try{
    while(window.__apdBuildingPlacementMigration?.owner==='loading')await new Promise(resolve=>setTimeout(resolve,0));
    const module=await import('./renderingFogCameraLegacyBridge.js?v=1');
    module.installLegacyRenderingFogCameraBridge(host);
  }catch(error){
    if(typeof host.markFailed==='function')host.markFailed(error);
    else console.error('Rendering/fog/camera migration bootstrap failed.',error);
  }
})();
