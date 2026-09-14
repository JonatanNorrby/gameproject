// Module bootstrap is separate from the classic host so import failures can fall
// back cleanly without leaving START GAME blocked.
const host=globalThis.__apdLegacyEconomyHost;
if(!host){
  console.error('Economy migration host is unavailable; legacy economy ownership retained.');
}else{
  import('./economyLegacyBridge.js?v=1')
    .then(module=>module.installLegacyEconomyBridge(host))
    .catch(error=>host.markFailed?.(error));
}
