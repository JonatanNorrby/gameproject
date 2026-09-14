const host=globalThis.__apdNavigationMovementHost;
if(!host){
  console.error('Navigation migration host is unavailable; legacy movement ownership retained.');
}else{
  import('./navigationMovementLegacyBridge.js?v=1')
    .then(module=>module.installLegacyNavigationMovementBridge(host))
    .catch(error=>host.markFailed?.(error));
}
