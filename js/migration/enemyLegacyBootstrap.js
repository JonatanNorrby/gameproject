import { installLegacyEnemyBridge } from './enemyLegacyBridge.js?v=1';

const host=window.__apdEnemyLegacyHost;
if(!host)throw new Error('Enemy migration host was not installed before module bootstrap');

try{
  installLegacyEnemyBridge(host);
}catch(error){
  host.markFailed?.(error);
}
