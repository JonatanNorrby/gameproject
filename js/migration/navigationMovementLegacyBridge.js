import { createGameConfig } from '../core/config.js';
import { isNavigationPointBlocked, findPath } from '../navigation/pathfinding.js';
import { setUnitDestination } from '../movement/movement.js';
import { updateMovementRuntime } from '../movement/runtime.js';
import { issueManualMove } from '../units/commands.js';

const MIGRATION_ID='navigation-movement-step2';

function finite(value,fallback=0){const number=Number(value);return Number.isFinite(number)?number:fallback;}
function defineLiveProperty(target,key,get,set){Object.defineProperty(target,key,{configurable:false,enumerable:true,get,set});}
function requireHost(host){
  if(!host||typeof host.getState!=='function')throw new TypeError('Navigation bridge requires getState()');
  if(typeof host.installOwners!=='function')throw new TypeError('Navigation bridge requires installOwners()');
  return host;
}

export function createLegacyNavigationGame(hostInput){
  const host=requireHost(hostInput),config=createGameConfig(),entities={},modifiers={},commands={},base={};
  const current=()=>host.getState();

  for(const key of ['units','structures','terrain','depots','rivers']){
    defineLiveProperty(entities,key,
      ()=>Array.isArray(current()?.[key])?current()[key]:[],
      value=>{const state=current();if(state)state[key]=Array.isArray(value)?value:[];});
  }
  defineLiveProperty(modifiers,'unitMove',
    ()=>{const value=Number(current()?.mods?.unitMove);return Number.isFinite(value)?value:1;},
    value=>{const state=current();if(!state)return;state.mods||={};state.mods.unitMove=finite(value,1);});
  defineLiveProperty(commands,'medicFollowAttachMode',
    ()=>Boolean(current()?.v47MedicAttachMode),
    value=>{const state=current();if(state)state.v47MedicAttachMode=Boolean(value);});
  defineLiveProperty(commands,'apcSupportAttachMode',
    ()=>Boolean(current()?.v47ApcAttachMode),
    value=>{const state=current();if(state)state.v47ApcAttachMode=Boolean(value);});
  defineLiveProperty(base,'x',()=>finite(host.baseX),()=>{});
  defineLiveProperty(base,'y',()=>finite(host.baseY),()=>{});
  defineLiveProperty(base,'radius',()=>Math.max(0,finite(host.baseRadius)),()=>{});

  return {config,state:{entities,modifiers,commands,base},services:{}};
}

export function installLegacyNavigationMovementBridge(hostInput){
  const host=requireHost(hostInput),game=createLegacyNavigationGame(host);

  const owners={
    navPointBlocked:(x,y,r)=>isNavigationPointBlocked(game,x,y,r),
    findPath:(sx,sy,gx,gy,r)=>findPath(game,{x:sx,y:sy},{x:gx,y:gy},r),
    setUnitDestination:(unit,x,y,options={})=>setUnitDestination(game,unit,x,y,options),
    updateUnitMovement:dt=>updateMovementRuntime(game,dt),
    manualMove:(unit,x,y)=>({handled:true,...issueManualMove(game,unit,x,y)}),
  };

  const restore=host.installOwners(owners);
  const audit={
    id:MIGRATION_ID,
    active:true,
    owner:'js/navigation/* + js/movement/* + js/units/commands.js + js/units/platoons.js',
    legacyFallbackAvailable:typeof restore==='function',
    asyncManualMoveBridge:false,
  };
  if(typeof globalThis!=='undefined'){
    globalThis.__apdNavigationMigration=audit;
    globalThis.__apdAudit={...(globalThis.__apdAudit||{}),navigationOwner:audit.owner,navigationMigration:MIGRATION_ID};
  }
  if(typeof host.markReady==='function')host.markReady(audit);
  return {game,owners,restore,audit};
}
