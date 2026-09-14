import { installLegacyTowerProjectileBridge } from './towerProjectileLegacyBridge.js?v=1';

const host=globalThis.__apdTowerProjectileLegacyHost;
if(!host){
  console.error('Tower/projectile migration host is missing.');
}else{
  try{
    installLegacyTowerProjectileBridge(host);
  }catch(error){
    host.markFailed?.(error);
  }
}
