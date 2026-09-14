import { createGameConfig } from '../core/config.js';
import { getEnemyConfig, ENEMY_CONFIG } from '../enemies/enemyConfig.js';
import { chooseHordeEnemyType, updateEnemyDirector } from '../enemies/enemyDirector.js';
import { spawnEnemy as spawnEnemyClean } from '../enemies/enemySpawning.js';
import { updateEnemyActors } from '../enemies/enemies.js';
import { applyPlayerEnemyDamage } from '../combat/playerDamage.js';

const MIGRATION_ID='enemy-runtime-step4';
const ENTITY_KEYS=['units','enemies','structures','terrain','depots','rivers'];
const MODIFIER_KEYS=['flameDamage','burnDuration'];
let legacyEnemyId=0;

function numberOr(value,fallback=0){
  if(value===null||value===''||typeof value==='boolean')return fallback;
  const number=Number(value);
  return Number.isFinite(number)?number:fallback;
}
function nonNegative(value,fallback=0){return Math.max(0,numberOr(value,fallback));}
function defineLiveProperty(target,key,get,set){Object.defineProperty(target,key,{configurable:false,enumerable:true,get,set});}
function requireHost(host){
  if(!host||typeof host.getState!=='function')throw new TypeError('Enemy runtime bridge requires getState()');
  if(typeof host.installOwners!=='function')throw new TypeError('Enemy runtime bridge requires installOwners()');
  return host;
}
function defineAlias(target,alias,key){
  const descriptor=Object.getOwnPropertyDescriptor(target,alias);
  if(descriptor?.get&&descriptor?.set)return;
  try{delete target[alias];}catch{}
  Object.defineProperty(target,alias,{configurable:true,enumerable:true,get(){return target[key];},set(value){target[key]=value;}});
}

function normalizeDirectorObject(value,legacy,config){
  const horde=config.director?.horde||{};
  const source=value&&typeof value==='object'?value:{};
  const old=legacy&&typeof legacy==='object'?legacy:{};
  const director={
    hordeNumber:numberOr(source.hordeNumber,numberOr(old.hordeNumber,numberOr(old.hordeNo,0))),
    queuedEnemies:numberOr(source.queuedEnemies,numberOr(old.queuedEnemies,numberOr(old.queue,0))),
    batchTimer:numberOr(source.batchTimer,numberOr(old.batchTimer,0)),
    nextHordeIn:source.nextHordeIn===Infinity||old.nextHordeIn===Infinity
      ? Infinity
      : numberOr(source.nextHordeIn,numberOr(old.nextHordeIn,numberOr(horde.firstDelay,26))),
    angle:numberOr(source.angle,numberOr(old.angle,0)),
    spawnRadius:numberOr(source.spawnRadius,numberOr(old.spawnRadius,numberOr(horde.startRadius,1500))),
    threatAtLaunch:numberOr(source.threatAtLaunch,numberOr(old.threatAtLaunch,numberOr(old.v47ThreatAtLaunch,0))),
    unitsAtLaunch:numberOr(source.unitsAtLaunch,numberOr(old.unitsAtLaunch,numberOr(old.v47UnitsAtLaunch,0))),
    buildingsAtLaunch:numberOr(source.buildingsAtLaunch,numberOr(old.buildingsAtLaunch,numberOr(old.v47BuildingsAtLaunch,0))),
    lastThreat:source.lastThreat||old.lastThreat||null,
  };
  defineAlias(director,'hordeNo','hordeNumber');
  defineAlias(director,'queue','queuedEnemies');
  defineAlias(director,'v47ThreatAtLaunch','threatAtLaunch');
  defineAlias(director,'v47UnitsAtLaunch','unitsAtLaunch');
  defineAlias(director,'v47BuildingsAtLaunch','buildingsAtLaunch');
  return director;
}

function directorForState(state,config){
  if(!state)return normalizeDirectorObject(null,null,config);
  const existing=state.director;
  const legacy=state.v47Director;
  if(existing&&existing===legacy&&Object.getOwnPropertyDescriptor(existing,'hordeNo')?.get)return existing;
  const director=normalizeDirectorObject(existing,legacy,config);
  state.director=director;
  state.v47Director=director;
  state.v47LastThreat=director.lastThreat;
  state.spawnTimer=999999;
  return director;
}

function storeDirector(state,value,config){
  if(!state)return;
  const director=normalizeDirectorObject(value,state.v47Director,config);
  state.director=director;
  state.v47Director=director;
  state.v47LastThreat=director.lastThreat;
  state.spawnTimer=999999;
}

function normalizeLegacyEnemy(enemy){
  if(!enemy||typeof enemy!=='object')return enemy;
  const config=ENEMY_CONFIG[enemy.type];
  if(!config)return enemy;
  if(enemy.id==null||enemy.id==='')enemy.id=`legacy-e-${++legacyEnemyId}`;
  if(!Number.isFinite(Number(enemy.maxHp))||Number(enemy.maxHp)<=0)enemy.maxHp=Math.max(1,numberOr(enemy.hp,numberOr(config.baseHp,1)));
  if(!Number.isFinite(Number(enemy.hp)))enemy.hp=enemy.maxHp;
  if(!Number.isFinite(Number(enemy.r))||Number(enemy.r)<=0)enemy.r=Math.max(1,numberOr(config.radius,8));
  if(!Number.isFinite(Number(enemy.speed))||Number(enemy.speed)<0)enemy.speed=0;
  if(!Number.isFinite(Number(enemy.damage))||Number(enemy.damage)<0)enemy.damage=Math.max(0,numberOr(config.baseDamage,0));
  if(!Number.isFinite(Number(enemy.burn)))enemy.burn=0;
  if(!Number.isFinite(Number(enemy.burnTick)))enemy.burnTick=0;
  if(!Number.isFinite(Number(enemy.slowFactor))||Number(enemy.slowFactor)<=0)enemy.slowFactor=1;
  if(!Number.isFinite(Number(enemy.slowTime)))enemy.slowTime=0;
  if(!Number.isFinite(Number(enemy.rangeCooldown)))enemy.rangeCooldown=0;
  if(!Number.isFinite(Number(enemy.specialCooldown)))enemy.specialCooldown=0;
  if(!Number.isFinite(Number(enemy.burrowCooldown)))enemy.burrowCooldown=0;
  if(!Number.isFinite(Number(enemy.burrowTimer)))enemy.burrowTimer=0;
  if(!Number.isFinite(Number(enemy.chargeCooldown)))enemy.chargeCooldown=0;
  if(!Number.isFinite(Number(enemy.chargeWindup)))enemy.chargeWindup=0;
  if(!('burrowed' in enemy))enemy.burrowed=false;
  if(!('burrowExit' in enemy))enemy.burrowExit=null;
  if(!('climbing' in enemy))enemy.climbing=false;
  if(!('charging' in enemy))enemy.charging=false;
  if(!('chargeWallId' in enemy))enemy.chargeWallId=null;
  if(!('cloaked' in enemy))enemy.cloaked=enemy.type==='saboteur';
  if(!('horde' in enemy))enemy.horde=Boolean(enemy.v47Horde);
  if(enemy.v47GuardBoxId&&!enemy.cacheGuard){
    enemy.cacheGuard={
      cacheId:enemy.v47GuardBoxId,
      homeX:numberOr(enemy.v47GuardHomeX,enemy.x),
      homeY:numberOr(enemy.v47GuardHomeY,enemy.y),
    };
  }
  if(enemy.cacheGuard?.cacheId){
    enemy.v47GuardBoxId=enemy.cacheGuard.cacheId;
    enemy.v47GuardHomeX=numberOr(enemy.cacheGuard.homeX,enemy.x);
    enemy.v47GuardHomeY=numberOr(enemy.cacheGuard.homeY,enemy.y);
  }
  return enemy;
}

function normalizeLegacyCache(cache){
  if(!cache||typeof cache!=='object')return cache;
  if(!Array.isArray(cache.guardIds))cache.guardIds=[];
  if(!Number.isFinite(Number(cache.capture)))cache.capture=0;
  cache.captured=Boolean(cache.captured);
  cache.guardsSpawned=Boolean(cache.guardsSpawned);
  return cache;
}

export function createLegacyEnemyGame(hostInput){
  const host=requireHost(hostInput),config=createGameConfig(),resources={},modifiers={},debug={},entities={},base={},time={},session={},stateView={};
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
  defineLiveProperty(entities,'enemyProjectiles',
    ()=>Array.isArray(current()?.enemyBullets)?current().enemyBullets:[],
    value=>{const state=current();if(state)state.enemyBullets=Array.isArray(value)?value:[];});
  defineLiveProperty(entities,'effects',
    ()=>[],
    ()=>{});
  defineLiveProperty(entities,'resourceCaches',
    ()=>Array.isArray(current()?.v47ResourceCaches)?current().v47ResourceCaches:[],
    value=>{const state=current();if(state)state.v47ResourceCaches=Array.isArray(value)?value:[];});

  defineLiveProperty(base,'x',()=>numberOr(host.baseX),()=>{});
  defineLiveProperty(base,'y',()=>numberOr(host.baseY),()=>{});
  defineLiveProperty(base,'radius',()=>nonNegative(host.baseRadius),()=>{});
  defineLiveProperty(base,'hp',()=>nonNegative(current()?.baseHp),value=>{const state=current();if(state)state.baseHp=nonNegative(value);});
  defineLiveProperty(base,'maxHp',()=>Math.max(1,nonNegative(current()?.maxBaseHp,1)),value=>{const state=current();if(state)state.maxBaseHp=Math.max(1,nonNegative(value,1));});

  defineLiveProperty(time,'elapsed',()=>nonNegative(current()?.elapsed),value=>{const state=current();if(state)state.elapsed=nonNegative(value);});
  defineLiveProperty(session,'gameOver',()=>Boolean(current()?.gameOver),value=>{const state=current();if(state)state.gameOver=Boolean(value);});

  defineLiveProperty(stateView,'director',()=>directorForState(current(),config),value=>storeDirector(current(),value,config));
  defineLiveProperty(stateView,'enemyRuntime',()=>current()?.__apdEnemyRuntime||null,value=>{const state=current();if(state)state.__apdEnemyRuntime=value;});
  Object.assign(stateView,{resources,modifiers,debug,entities,base,time,session});

  return {
    config,
    state:stateView,
    services:{
      now:()=>typeof host.now==='function'?host.now():0,
      random:()=>typeof host.random==='function'?host.random():Math.random(),
      enemyCombat:{
        fireProjectile:(_game,projectile)=>typeof host.emitEnemyProjectile==='function'?host.emitEnemyProjectile(projectile):entities.enemyProjectiles.push(projectile),
      },
      enemyAI:{
        emitEffect:(_game,effect)=>typeof host.emitEffect==='function'?host.emitEffect(effect):effect,
      },
      enemyLifecycle:{
        onEnemyDestroyed:(_game,enemy,reward)=>{if(typeof host.onEnemyDestroyed==='function')host.onEnemyDestroyed(enemy,reward);},
      },
      lifecycle:{
        onBaseDestroyed:()=>{if(typeof host.onBaseDestroyed==='function')host.onBaseDestroyed();},
      },
      resourceCaches:{},
    },
  };
}

export function normalizeLegacyEnemyState(game){
  const state=game?.state;
  if(!state)return game;
  directorForState(state===game.state?null:null,game.config);
  // Accessing the live director property performs the actual legacy-state sync.
  void game.state.director;
  for(const cache of game.state.entities.resourceCaches||[])normalizeLegacyCache(cache);
  for(const enemy of game.state.entities.enemies||[])normalizeLegacyEnemy(enemy);
  return game;
}

export function installLegacyEnemyBridge(hostInput){
  const host=requireHost(hostInput),game=createLegacyEnemyGame(host);
  normalizeLegacyEnemyState(game);

  const owners={
    updateDirector(dt){
      normalizeLegacyEnemyState(game);
      const result=updateEnemyDirector(game,dt);
      const state=host.getState();
      if(state){state.v47LastThreat=result?.director?.lastThreat||null;state.spawnTimer=999999;}
      return result;
    },
    updateEnemies(dt){
      normalizeLegacyEnemyState(game);
      return updateEnemyActors(game,dt,{manageCacheCapture:false});
    },
    spawnEnemy(type=null,options={}){
      normalizeLegacyEnemyState(game);
      const enemyType=type&&ENEMY_CONFIG[type]?type:chooseHordeEnemyType(game);
      return spawnEnemyClean(game,enemyType,options);
    },
    hitEnemy(enemy,amount,context={}){
      normalizeLegacyEnemy(enemy);
      return applyPlayerEnemyDamage(game,enemy,amount,{...context,attackKind:context.attackKind||'legacy-projectile'});
    },
  };

  const restore=host.installOwners(owners);
  const audit={
    id:MIGRATION_ID,
    active:true,
    owner:'js/enemies/* + enemy-only js/combat/statusEffects.js/lifecycle',
    legacyFallbackAvailable:typeof restore==='function',
    directorOwner:'js/enemies/enemyDirector.js',
    actorOwner:'js/enemies/enemyAi.js + js/enemies/specialEnemies.js',
    enemyLifecycleOwner:'js/enemies/enemyLifecycle.js',
    playerDamageEntryOwner:'js/combat/playerDamage.js',
    projectileSimulationOwner:'legacy',
    towerCombatOwner:'legacy',
    structureLifecycleOwner:'legacy',
    resourceCacheCaptureOwner:'legacy-v47',
    cacheGuardAiOwner:'js/enemies/resourceCaches.js',
  };
  if(typeof globalThis!=='undefined'){
    globalThis.__apdEnemyMigration=audit;
    globalThis.__apdAudit={...(globalThis.__apdAudit||{}),enemyOwner:audit.owner,enemyMigration:MIGRATION_ID};
  }
  if(typeof host.markReady==='function')host.markReady(audit);
  return {game,owners,restore,audit};
}
