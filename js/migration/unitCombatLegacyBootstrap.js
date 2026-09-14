const host=globalThis.__apdUnitCombatLegacyHost;
if(!host){
  console.error('Unit combat migration host is unavailable; legacy unit ownership retained.');
}else{
  import('./unitCombatLegacyBridge.js?v=1')
    .then(module=>module.installLegacyUnitCombatBridge(host))
    .catch(error=>host.markFailed?.(error));
}
