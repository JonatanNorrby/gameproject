import { createGameConfig } from '../core/config.js';
import { TOWER_CONFIG } from '../towers/towerConfig.js';
import { updateTowerCombat } from '../combat/towerCombat.js';
import { PROJECTILE_TEAM, updateProjectileCollection } from '../combat/projectiles.js';

const MIGRATION_ID='tower-projectile-step5';
const ENTITY_KEYS=['units','enemies','structures','terrain','depots','rivers'];
const MODIFIER_KEYS=['laserRate','laserDamage','flameDamage','burnDuration'];

function numberOr(value,fallback=0){
  if(value===null||value===''||typeof value==='boolean')return fallback;
  const number=Number(value);
  return Number.isFinite(number)?number:fallback;
}
function nonNegative(value,fallback=0){return Math.max(0,numberOr(value,fallback));}
function defineLiveProperty(target,key,get,set){Object.defineProperty(target,key,{configurable:false,enumerable:true,get,set});}
function requireHost(host){
  if(!host||typeof host.getState!=='function')throw new TypeError('Tower/projectile bridge requires getState()');
  if(typeof host.installOwners!=='function')throw new TypeError('Tower/projectile bridge requires installOwners()');
  if(typeof host.cleanupDestroyed!=='function')throw new TypeError('Tower/projectile bridge requires cleanupDestroyed()');
  return host;
}

function normalizeLegacyTower(tower){
  if(!tower||typeof tower!=='object'||!TOWER_CONFIG[tower.type])return tower;
  const config=TOWER_CONFIG[tower.type];
  if(!Number.isFinite(Number(tower.level)))tower.level=1;
  tower.level=Math.max(1,Math.min(3,Math.floor(Number(tower.level)||1)));
  if(!Number.isFinite(Number(tower.cool)))tower.cool=0;
  if(!Number.isFinite(Number(tower.maxHp))||Number(tower.maxHp)<=0)tower.maxHp=Math.max(1,numberOr(config.maxHp,1));
  // Preserve zero/negative HP as dead state. Migration normalization must never
  // revive a tower that legacy combat already destroyed.
  if(!Number.isFinite(Number(tower.hp)))tower.hp=tower.maxHp;
  if(!('built' in tower))tower.built=true;
  return tower;
}

function normalizeProjectileCollections(state){
  if(!state)return;
  if(!Array.isArray(state.bullets))state.bullets=[];
  if(!Array.isArray(state.enemyBullets))state.enemyBullets=[];
}

export function createLegacyTowerProjectileGame(hostInput){
  const host=requireHost(hostInput),config=createGameConfig(),resources={},modifiers={},debug={},entities={},base={},session={},stateView={};
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
  // The ordinary clean runtime uses one collection. Production retains two
  // storage arrays only because the current renderer draws friendly/hostile shots
  // through separate loops. The Step 5 owner simulates both with one clean engine.
  defineLiveProperty(entities,'projectiles',
    ()=>Array.isArray(current()?.bullets)?current().bullets:[],
    value=>{const state=current();if(state)state.bullets=Array.isArray(value)?value:[];});
  defineLiveProperty(entities,'effects',()=>[],()=>{});

  defineLiveProperty(base,'x',()=>numberOr(host.baseX),()=>{});
  defineLiveProperty(base,'y',()=>numberOr(host.baseY),()=>{});
  defineLiveProperty(base,'radius',()=>nonNegative(host.baseRadius),()=>{});
  defineLiveProperty(base,'hp',()=>nonNegative(current()?.baseHp),value=>{const state=current();if(state)state.baseHp=nonNegative(value);});
  defineLiveProperty(base,'maxHp',()=>Math.max(1,nonNegative(current()?.maxBaseHp,1)),value=>{const state=current();if(state)state.maxBaseHp=Math.max(1,nonNegative(value,1));});
  defineLiveProperty(session,'gameOver',()=>Boolean(current()?.gameOver),value=>{const state=current();if(state)state.gameOver=Boolean(value);});

  Object.assign(stateView,{resources,modifiers,debug,entities,base,session});

  const visible=(enemy,tower)=>typeof host.isEnemyVisible==='function'?host.isEnemyVisible(enemy,tower):true;
  const revealed=(enemy,tower)=>typeof host.isEnemyRevealed==='function'?host.isEnemyRevealed(enemy,tower):!enemy?.cloaked;

  return {
    config,
    state:stateView,
    services:{
      now:()=>typeof host.now==='function'?host.now():0,
      random:()=>typeof host.random==='function'?host.random():Math.random(),
      towerCombat:{
        fireProjectile:(_game,projectile)=>typeof host.emitPlayerProjectile==='function'?host.emitPlayerProjectile(projectile):entities.projectiles.push(projectile),
        emitEffect:(_game,effect)=>typeof host.emitEffect==='function'?host.emitEffect(effect):effect,
        isEnemyVisible:visible,
        isEnemyRevealed:revealed,
      },
      playerCombat:{
        isEnemyVisible:visible,
        isEnemyRevealed:revealed,
      },
      landingPads:{
        onShipDestroyed:(_game,pad,detail)=>{if(typeof host.onShipDestroyed==='function')host.onShipDestroyed(pad,detail);},
      },
    },
  };
}

export function normalizeLegacyTowerProjectileState(game,hostInput=null){
  const host=hostInput||null;
  const state=host?.getState?.();
  if(state)normalizeProjectileCollections(state);
  for(const tower of game?.state?.entities?.structures||[])normalizeLegacyTower(tower);
  return game;
}

export function installLegacyTowerProjectileBridge(hostInput){
  const host=requireHost(hostInput),game=createLegacyTowerProjectileGame(host);
  normalizeLegacyTowerProjectileState(game,host);

  const owners={
    updateTowers(dt){
      normalizeLegacyTowerProjectileState(game,host);
      return updateTowerCombat(game,dt);
    },
    updateProjectiles(dt){
      normalizeLegacyTowerProjectileState(game,host);
      const state=host.getState();
      const player=updateProjectileCollection(game,dt,state.bullets,PROJECTILE_TEAM.PLAYER);
      const enemy=updateProjectileCollection(game,dt,state.enemyBullets,PROJECTILE_TEAM.ENEMY);
      // Preserve the established production ordering: destruction cleanup runs
      // after both projectile collections. Step 3 already owns unit cleanup;
      // remaining structure cleanup stays legacy until Step 6.
      host.cleanupDestroyed();
      return {
        hits:player.hits+enemy.hits,
        removed:player.removed+enemy.removed,
        active:player.active+enemy.active,
        player,
        enemy,
      };
    },
  };

  const restore=host.installOwners(owners);
  const audit={
    id:MIGRATION_ID,
    active:true,
    owner:'js/combat/towerCombat.js + js/combat/projectiles.js',
    legacyFallbackAvailable:typeof restore==='function',
    towerCombatOwner:'js/combat/towerCombat.js',
    towerTargetingOwner:'js/combat/towerTargeting.js',
    projectileSimulationOwner:'js/combat/projectiles.js',
    playerDamageOwner:'js/combat/playerDamage.js',
    enemyLifecycleOwner:'js/enemies/enemyLifecycle.js',
    unitLifecycleOwner:'unit-combat-step3',
    structureLifecycleOwner:'legacy-until-step6',
    projectileStorage:'legacy-split-arrays-rendering-only',
  };
  if(typeof globalThis!=='undefined'){
    globalThis.__apdTowerProjectileMigration=audit;
    globalThis.__apdAudit={
      ...(globalThis.__apdAudit||{}),
      towerCombatOwner:audit.towerCombatOwner,
      projectileSimulationOwner:audit.projectileSimulationOwner,
      towerProjectileMigration:MIGRATION_ID,
    };
  }
  if(typeof host.markReady==='function')host.markReady(audit);
  return {game,owners,restore,audit};
}
