import { createGameConfig } from '../core/config.js';
import { getUnitConfig } from '../units/unitConfig.js';
import { getUnitRole } from '../core/entities.js';
import { deployUnitFromBase } from '../units/deployment.js';
import { loadApc as loadApcClean, unloadApc as unloadApcClean } from '../units/transport.js';
import { detachApcSupport } from '../units/support.js';
import { updatePlayerUnitCombat } from '../combat/unitCombat.js';
import { cleanupDeadPlayerUnits } from '../combat/lifecycle.js';

const MIGRATION_ID='unit-combat-step3';
const ENTITY_KEYS=['units','enemies','structures','terrain','depots','rivers'];
const MODIFIER_KEYS=['soldierRate','soldierDamage','extraSoldiers','unitMove','truckHp','truckCapacity'];

function numberOr(value,fallback=0){
  if(value===null||value===''||typeof value==='boolean')return fallback;
  const number=Number(value);
  return Number.isFinite(number)?number:fallback;
}
function nonNegative(value,fallback=0){return Math.max(0,numberOr(value,fallback));}
function defineLiveProperty(target,key,get,set){Object.defineProperty(target,key,{configurable:false,enumerable:true,get,set});}
function requireHost(host){
  if(!host||typeof host.getState!=='function')throw new TypeError('Unit combat bridge requires getState()');
  if(typeof host.installOwners!=='function')throw new TypeError('Unit combat bridge requires installOwners()');
  return host;
}

function normalizeLegacyUnit(unit){
  const role=getUnitRole(unit);
  if(!role)return unit;
  const definition=getUnitConfig(role);
  if(role==='truck'){
    unit.type='truck';
    if('role' in unit)delete unit.role;
  }else{
    unit.type=definition.runtimeType;
    unit.role=role;
  }
  if(!Number.isFinite(Number(unit.maxHp))||Number(unit.maxHp)<=0)unit.maxHp=Math.max(1,Number(definition.maxHp)||1);
  // Zero/negative HP is valid dead state and must never be normalized back alive.
  if(!Number.isFinite(Number(unit.hp)))unit.hp=unit.maxHp;
  if(!Array.isArray(unit.path))unit.path=[];
  if(!('moveTarget' in unit))unit.moveTarget=null;
  if(!Number.isFinite(Number(unit.heading)))unit.heading=0;
  if(!Array.isArray(unit.cooldowns))unit.cooldowns=[];
  if(!('platoonId' in unit))unit.platoonId=null;
  if(!('platoonSlot' in unit))unit.platoonSlot=0;
  if(!('garrisonedIn' in unit))unit.garrisonedIn=null;
  if(!('transportedIn' in unit))unit.transportedIn=null;
  if(!('attachedTo' in unit))unit.attachedTo=null;
  if(!('attachSlot' in unit))unit.attachSlot=0;
  if(role==='medic'&&!Number.isFinite(Number(unit.healFxCooldown)))unit.healFxCooldown=0;
  if((role==='engineer'||role==='repairvehicle')&&!Number.isFinite(Number(unit.repairFxCooldown)))unit.repairFxCooldown=0;
  if(role==='apc'&&!('passengerId' in unit))unit.passengerId=null;
  return unit;
}

export function createLegacyUnitCombatGame(hostInput){
  const host=requireHost(hostInput),config=createGameConfig(),resources={},modifiers={},debug={},entities={},base={},commands={},selection={};
  const current=()=>host.getState();

  defineLiveProperty(resources,'gold',
    ()=>nonNegative(current()?.credits),
    value=>{const state=current();if(state)state.credits=nonNegative(value);});
  defineLiveProperty(resources,'metal',
    ()=>nonNegative(current()?.metal),
    value=>{const state=current();if(state)state.metal=nonNegative(value);});

  for(const key of MODIFIER_KEYS){
    defineLiveProperty(modifiers,key,
      ()=>numberOr(current()?.mods?.[key],1),
      value=>{const state=current();if(!state)return;state.mods||={};state.mods[key]=numberOr(value,1);});
  }

  defineLiveProperty(debug,'unlimitedCash',
    ()=>Boolean(current()?.debug?.unlimitedCash),
    value=>{const state=current();if(!state)return;state.debug||={};state.debug.unlimitedCash=Boolean(value);});
  defineLiveProperty(debug,'unlimitedLives',
    ()=>Boolean(current()?.debug?.unlimitedLives),
    value=>{const state=current();if(!state)return;state.debug||={};state.debug.unlimitedLives=Boolean(value);});

  for(const key of ENTITY_KEYS){
    defineLiveProperty(entities,key,
      ()=>Array.isArray(current()?.[key])?current()[key]:[],
      value=>{const state=current();if(state)state[key]=Array.isArray(value)?value:[];});
  }
  defineLiveProperty(entities,'projectiles',
    ()=>Array.isArray(current()?.bullets)?current().bullets:[],
    value=>{const state=current();if(state)state.bullets=Array.isArray(value)?value:[];});
  defineLiveProperty(entities,'playerMines',
    ()=>Array.isArray(current()?.playerMines)?current().playerMines:[],
    value=>{const state=current();if(state)state.playerMines=Array.isArray(value)?value:[];});

  defineLiveProperty(base,'x',()=>numberOr(host.baseX),()=>{});
  defineLiveProperty(base,'y',()=>numberOr(host.baseY),()=>{});
  defineLiveProperty(base,'radius',()=>nonNegative(host.baseRadius),()=>{});
  defineLiveProperty(base,'hp',()=>nonNegative(current()?.baseHp),value=>{const state=current();if(state)state.baseHp=nonNegative(value);});
  defineLiveProperty(base,'maxHp',()=>Math.max(1,nonNegative(current()?.maxBaseHp,1)),value=>{const state=current();if(state)state.maxBaseHp=Math.max(1,nonNegative(value,1));});

  defineLiveProperty(commands,'medicFollowAttachMode',
    ()=>Boolean(current()?.v47MedicAttachMode),
    value=>{const state=current();if(state)state.v47MedicAttachMode=Boolean(value);});
  defineLiveProperty(commands,'apcSupportAttachMode',
    ()=>Boolean(current()?.v47ApcAttachMode),
    value=>{const state=current();if(state)state.v47ApcAttachMode=Boolean(value);});

  defineLiveProperty(selection,'unitId',
    ()=>current()?.selectedUnit?.id??null,
    value=>{
      const state=current();if(!state)return;
      state.selectedUnit=value==null?null:(state.units||[]).find(unit=>unit.id===value)||null;
    });

  return {
    config,
    state:{resources,modifiers,debug,entities,base,commands,selection},
    services:{
      now:()=>typeof host.now==='function'?host.now():0,
      random:()=>typeof host.random==='function'?host.random():Math.random(),
      playerCombat:{
        fireProjectile:(_game,projectile)=>typeof host.emitProjectile==='function'?host.emitProjectile(projectile):entities.projectiles.push(projectile),
        emitEffect:(_game,effect)=>typeof host.emitEffect==='function'?host.emitEffect(effect):effect,
        isEnemyVisible:(target,attacker)=>typeof host.isEnemyVisible==='function'?host.isEnemyVisible(target,attacker):true,
        isEnemyRevealed:(target,attacker)=>typeof host.isEnemyRevealed==='function'?host.isEnemyRevealed(target,attacker):!target?.cloaked,
      },
    },
  };
}

export function normalizeLegacyUnitCombatState(game){
  for(const unit of game?.state?.entities?.units||[])normalizeLegacyUnit(unit);
  return game;
}

export function installLegacyUnitCombatBridge(hostInput){
  const host=requireHost(hostInput),game=createLegacyUnitCombatGame(host);
  normalizeLegacyUnitCombatState(game);

  const owners={
    updateUnitCombat(dt){
      normalizeLegacyUnitCombatState(game);
      return updatePlayerUnitCombat(game,dt);
    },
    deployUnit(type){
      normalizeLegacyUnitCombatState(game);
      const result=deployUnitFromBase(game,type);
      if(result?.ok)normalizeLegacyUnit(result.unit);
      return result;
    },
    cleanupUnits(){
      normalizeLegacyUnitCombatState(game);
      return cleanupDeadPlayerUnits(game);
    },
    loadApc(apc,unit=null){
      normalizeLegacyUnitCombatState(game);
      detachApcSupport(game,apc);
      return loadApcClean(game,apc,unit);
    },
    unloadApc(apc){
      normalizeLegacyUnitCombatState(game);
      return unloadApcClean(game,apc);
    },
  };

  const restore=host.installOwners(owners);
  const audit={
    id:MIGRATION_ID,
    active:true,
    owner:'js/units/deployment.js + js/units/transport.js + js/combat/unitCombat.js + unit-only js/combat/lifecycle.js',
    legacyFallbackAvailable:typeof restore==='function',
    movementOwnerUnchanged:true,
    projectileSimulationOwner:'legacy',
    enemyLifecycleOwner:'legacy',
    structureLifecycleOwner:'legacy',
  };
  if(typeof globalThis!=='undefined'){
    globalThis.__apdUnitCombatMigration=audit;
    globalThis.__apdAudit={...(globalThis.__apdAudit||{}),unitCombatOwner:audit.owner,unitCombatMigration:MIGRATION_ID};
  }
  if(typeof host.markReady==='function')host.markReady(audit);
  return {game,owners,restore,audit};
}
