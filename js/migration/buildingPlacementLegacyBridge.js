import { createGameConfig } from '../core/config.js';
import { getBuildingConfig } from '../buildings/buildingConfig.js';
import { initializeBuildingRuntime, upgradeBuildingStorage } from '../buildings/buildingRuntime.js';
import {
  activeConstructionCount as cleanActiveConstructionCount,
  freeWorkers as cleanFreeWorkers,
  normalizeWallPath as cleanNormalizeWallPath,
  placeStructure as cleanPlaceStructure,
  placeWallPath as cleanPlaceWallPath,
  validateWallPath as cleanValidateWallPath,
  wallPathLength as cleanWallPathLength,
} from '../buildings/placement.js';
import { updateConstruction as cleanUpdateConstruction } from '../buildings/construction.js';
import { initializeResourceDepotRuntime, normalizeDepotMineLinks } from '../economy/depots.js';
import { getTowerConfig } from '../towers/towerConfig.js';
import { cleanupDeadPlayerUnits, cleanupDeadStructures } from '../combat/lifecycle.js';

const MIGRATION_ID='buildings-placement-step6';
const ECONOMIC_TYPES=new Set(['mine','oremine','refinery','landingpad']);

function numberOr(value,fallback=0){
  if(value===null||value===''||typeof value==='boolean')return fallback;
  const number=Number(value);
  return Number.isFinite(number)?number:fallback;
}
function nonNegative(value,fallback=0){return Math.max(0,numberOr(value,fallback));}
function defineLiveProperty(target,key,get,set){Object.defineProperty(target,key,{configurable:false,enumerable:true,get,set});}
function requireHost(host){
  if(!host||typeof host.getState!=='function')throw new TypeError('Building placement bridge requires getState()');
  if(typeof host.installOwners!=='function')throw new TypeError('Building placement bridge requires installOwners()');
  return host;
}
function currentWallState(host){
  const state=host.getState();
  if(!state)return {path:[],cursor:null,reviewOpen:false};
  if(!state.v6WallPlacement||typeof state.v6WallPlacement!=='object')state.v6WallPlacement={path:[],cursor:null,reviewOpen:false};
  const wall=state.v6WallPlacement;
  if(!Array.isArray(wall.path))wall.path=[];
  if(!('cursor' in wall))wall.cursor=null;
  wall.reviewOpen=Boolean(wall.reviewOpen);
  return wall;
}
function serviceId(host,prefix){
  const now=typeof host.now==='function'?host.now():Date.now();
  const random=typeof host.random==='function'?host.random():Math.random();
  return `${prefix}${now}-${String(random).replace('.','')}`;
}

function normalizeTower(host,structure){
  let config;
  try{config=getTowerConfig(structure.type);}catch{return structure;}
  structure.id=structure.id||serviceId(host,'t');
  structure.maxHp=numberOr(structure.maxHp,config.maxHp)>0?numberOr(structure.maxHp,config.maxHp):config.maxHp;
  if(!Number.isFinite(Number(structure.hp)))structure.hp=structure.maxHp;
  structure.built=structure.built!==false;
  structure.buildTime=nonNegative(structure.buildTime,config.buildTime);
  structure.buildRemaining=structure.built?0:nonNegative(structure.buildRemaining,structure.buildTime);
  structure.cool=numberOr(structure.cool,0);
  structure.level=Math.max(1,Math.min(3,Math.floor(numberOr(structure.level,1))));
  structure.protected=Boolean(structure.protected);
  if(!('safeSpotId' in structure))structure.safeSpotId=null;
  return structure;
}

function normalizeWall(host,game,structure){
  const config=getBuildingConfig('wall').wall;
  structure.id=structure.id||serviceId(host,'w');
  const x1=numberOr(structure.x1,structure.x),y1=numberOr(structure.y1,structure.y);
  const x2=numberOr(structure.x2,structure.x),y2=numberOr(structure.y2,structure.y);
  structure.x1=x1;structure.y1=y1;structure.x2=x2;structure.y2=y2;
  structure.length=Math.max(0,numberOr(structure.length,Math.hypot(x2-x1,y2-y1)));
  structure.x=numberOr(structure.x,(x1+x2)/2);structure.y=numberOr(structure.y,(y1+y2)/2);
  structure.thickness=Math.max(1,numberOr(structure.thickness,config.thickness));
  const fallbackHp=Math.max(1,Math.round(config.hpPer100*structure.length/100));
  structure.maxHp=numberOr(structure.maxHp,fallbackHp)>0?numberOr(structure.maxHp,fallbackHp):fallbackHp;
  if(!Number.isFinite(Number(structure.hp)))structure.hp=structure.maxHp;
  structure.built=structure.built!==false;
  const fallbackTime=config.baseBuildTime+structure.length/100*config.buildTimePer100;
  structure.buildTime=nonNegative(structure.buildTime,fallbackTime);
  structure.buildRemaining=structure.built?0:nonNegative(structure.buildRemaining,structure.buildTime);
  structure.cool=numberOr(structure.cool,0);
  structure.protected=false;
  structure.safeSpotId=null;
  return structure;
}

function normalizeStructure(host,game,structure){
  if(!structure?.type)return structure;
  if(ECONOMIC_TYPES.has(structure.type)){
    initializeBuildingRuntime(game,structure);
    if(!structure.built){
      const definition=getBuildingConfig(structure.type);
      structure.buildTime=nonNegative(structure.buildTime,definition.buildTime);
      structure.buildRemaining=nonNegative(structure.buildRemaining,structure.buildTime);
    }
    return structure;
  }
  if(structure.type==='wall')return normalizeWall(host,game,structure);
  return normalizeTower(host,structure);
}

export function createLegacyBuildingPlacementGame(hostInput){
  const host=requireHost(hostInput),config=createGameConfig(),resources={},debug={},entities={},base={},selection={};
  const current=()=>host.getState();

  defineLiveProperty(resources,'gold',()=>nonNegative(current()?.credits),value=>{const state=current();if(state)state.credits=nonNegative(value);});
  defineLiveProperty(resources,'metal',()=>nonNegative(current()?.metal),value=>{const state=current();if(state)state.metal=nonNegative(value);});
  defineLiveProperty(debug,'unlimitedCash',()=>Boolean(current()?.debug?.unlimitedCash),value=>{const state=current();if(!state)return;state.debug||={};state.debug.unlimitedCash=Boolean(value);});
  defineLiveProperty(debug,'unlimitedLives',()=>Boolean(current()?.debug?.unlimitedLives),value=>{const state=current();if(!state)return;state.debug||={};state.debug.unlimitedLives=Boolean(value);});

  for(const key of ['units','enemies','structures','terrain','depots','rivers'])defineLiveProperty(entities,key,
    ()=>Array.isArray(current()?.[key])?current()[key]:[],
    value=>{const state=current();if(state)state[key]=Array.isArray(value)?value:[];});

  defineLiveProperty(base,'x',()=>numberOr(host.baseX),()=>{});
  defineLiveProperty(base,'y',()=>numberOr(host.baseY),()=>{});
  defineLiveProperty(base,'radius',()=>nonNegative(host.baseRadius),()=>{});
  defineLiveProperty(base,'hp',()=>nonNegative(current()?.baseHp),value=>{const state=current();if(state)state.baseHp=nonNegative(value);});
  defineLiveProperty(base,'maxHp',()=>Math.max(1,nonNegative(current()?.maxBaseHp,1)),value=>{const state=current();if(state)state.maxBaseHp=Math.max(1,nonNegative(value,1));});

  defineLiveProperty(selection,'unitId',
    ()=>current()?.selectedUnit?.id??null,
    value=>{const state=current();if(state)state.selectedUnit=value==null?null:(state.units||[]).find(unit=>unit.id===value)||null;});
  defineLiveProperty(selection,'towerId',
    ()=>current()?.selectedTower?.id??null,
    value=>{const state=current();if(state)state.selectedTower=value==null?null:(state.structures||[]).find(item=>item.id===value)||null;});
  defineLiveProperty(selection,'storageBuildingId',
    ()=>current()?.selectedStorageBuilding?.id??null,
    value=>{const state=current();if(state)state.selectedStorageBuilding=value==null?null:(state.structures||[]).find(item=>item.id===value)||null;});

  return {
    config,
    state:{resources,debug,entities,base,selection},
    services:{
      now:()=>typeof host.now==='function'?host.now():Date.now(),
      random:()=>typeof host.random==='function'?host.random():Math.random(),
      buildings:{
        createBuildingId:type=>serviceId(host,type==='wall'?'w':'s'),
        onConstructionComplete:(_game,structure,group)=>{if(typeof host.onConstructionComplete==='function')host.onConstructionComplete(structure,group);},
      },
      lifecycle:{
        onStructureDestroyed:(_game,structure)=>{if(typeof host.onStructureDestroyed==='function')host.onStructureDestroyed(structure);},
      },
    },
  };
}

export function normalizeLegacyBuildingPlacementState(game,hostInput){
  const host=requireHost(hostInput);
  for(const depot of game?.state?.entities?.depots||[])initializeResourceDepotRuntime(game,depot);
  for(const structure of game?.state?.entities?.structures||[])normalizeStructure(host,game,structure);
  normalizeDepotMineLinks(game);
  currentWallState(host);
  return game;
}

function syncWall(host,wall,{stopPainting=false}={}){
  if(typeof host.syncWallPreview==='function')host.syncWallPreview({
    path:wall.path.map(point=>({x:point.x,y:point.y})),
    cursor:wall.cursor?{x:wall.cursor.x,y:wall.cursor.y}:null,
    reviewOpen:Boolean(wall.reviewOpen),
  },{stopPainting});
}

function wallReasonMessage(reason){
  const messages={
    'empty-path':'Draw a wall path first.',
    'path-too-long':'Wall path is too long.',
    'too-short':'A wall segment is too short.',
    'too-long':'A wall segment is too long.',
    'outside-world':'Wall must stay inside the map.',
    'base-overlap':'Wall cannot overlap the base.',
    'terrain-overlap':'Terrain blocks that wall.',
    'depot-overlap':'A resource depot blocks that wall.',
    'wall-overlap':'That wall overlaps another wall.',
    'structure-overlap':'A building blocks that wall.',
    'no-workers':'All workers are busy.',
    'cannot-afford':'Not enough Metal for that wall.',
  };
  return messages[reason]||'Wall path is not valid.';
}

export function installLegacyBuildingPlacementBridge(hostInput){
  const host=requireHost(hostInput),game=createLegacyBuildingPlacementGame(host);
  normalizeLegacyBuildingPlacementState(game,host);

  const owners={
    placeStructure(type,x,y){
      normalizeLegacyBuildingPlacementState(game,host);
      const result=cleanPlaceStructure(game,type,x,y);
      if(result?.ok&&result.structure)normalizeStructure(host,game,result.structure);
      return result;
    },
    updateConstruction(dt){
      normalizeLegacyBuildingPlacementState(game,host);
      return cleanUpdateConstruction(game,dt);
    },
    activeConstructionCount(){
      normalizeLegacyBuildingPlacementState(game,host);
      return cleanActiveConstructionCount(game);
    },
    freeWorkers(){
      normalizeLegacyBuildingPlacementState(game,host);
      return cleanFreeWorkers(game);
    },
    appendWallPoint(point,{force=false}={}){
      normalizeLegacyBuildingPlacementState(game,host);
      const wall=currentWallState(host),config=game.config.buildings.wall.wall;
      if(!point||!Number.isFinite(Number(point.x))||!Number.isFinite(Number(point.y)))return false;
      const p={x:Number(point.x),y:Number(point.y)};
      if(!wall.path.length)wall.path.push(p);
      else{
        const last=wall.path.at(-1),distance=Math.hypot(p.x-last.x,p.y-last.y);
        if((!force&&distance<config.paintPointSpacing)||(force&&distance<8))return false;
        wall.path.push(p);
      }
      wall.cursor=p;wall.reviewOpen=false;syncWall(host,wall);return true;
    },
    normalizeWallPath(points){return cleanNormalizeWallPath(game,points);},
    validateWallPath(points=null){
      normalizeLegacyBuildingPlacementState(game,host);
      const wall=currentWallState(host),result=cleanValidateWallPath(game,points||wall.path);
      return result.ok?result:{...result,msg:wallReasonMessage(result.reason)};
    },
    wallPathLength(points=null){return cleanWallPathLength(points||currentWallState(host).path);},
    reviewWall(){
      normalizeLegacyBuildingPlacementState(game,host);
      const wall=currentWallState(host),result=cleanValidateWallPath(game,wall.path);
      if(!result.ok)return {...result,msg:wallReasonMessage(result.reason)};
      wall.path=result.points;wall.reviewOpen=true;syncWall(host,wall);return result;
    },
    confirmWall(){
      normalizeLegacyBuildingPlacementState(game,host);
      const wall=currentWallState(host),result=cleanPlaceWallPath(game,wall.path);
      if(!result.ok)return {...result,msg:wallReasonMessage(result.reason)};
      wall.path=[];wall.cursor=null;wall.reviewOpen=false;syncWall(host,wall,{stopPainting:true});return result;
    },
    cancelWall(){
      const wall=currentWallState(host);wall.path=[];wall.cursor=null;wall.reviewOpen=false;syncWall(host,wall,{stopPainting:true});return true;
    },
    getWallState(){
      const wall=currentWallState(host);return {path:wall.path.map(point=>({...point})),cursor:wall.cursor?{...wall.cursor}:null,reviewOpen:wall.reviewOpen};
    },
    upgradeStorage(structure){
      normalizeLegacyBuildingPlacementState(game,host);
      if(!structure||!ECONOMIC_TYPES.has(structure.type)||(structure.type!=='refinery'&&structure.type!=='landingpad'))return {ok:false,reason:'not-storage'};
      initializeBuildingRuntime(game,structure);
      return upgradeBuildingStorage(game,structure);
    },
    cleanupDestroyed(){
      normalizeLegacyBuildingPlacementState(game,host);
      const units=cleanupDeadPlayerUnits(game);
      const structures=cleanupDeadStructures(game);
      normalizeDepotMineLinks(game);
      return {units,structures};
    },
  };

  const restore=host.installOwners(owners);
  const audit={
    id:MIGRATION_ID,
    active:true,
    owner:'js/buildings/* + structure-only js/combat/lifecycle.js',
    placementOwner:'js/buildings/placement.js',
    constructionOwner:'js/buildings/construction.js',
    storageUpgradeOwner:'js/buildings/buildingRuntime.js',
    wallOwner:'js/buildings/placement.js',
    structureLifecycleOwner:'js/combat/lifecycle.js:cleanupDeadStructures',
    unitLifecycleOwner:'js/combat/lifecycle.js:cleanupDeadPlayerUnits (Step 3 composition)',
    enemyLifecycleOwner:'Step 4 unchanged',
    inputOwner:'legacy-until-step8',
    renderingOwner:'legacy-until-step7',
    legacyFallbackAvailable:typeof restore==='function',
  };
  if(typeof globalThis!=='undefined'){
    globalThis.__apdBuildingPlacementMigration=audit;
    globalThis.__apdAudit={...(globalThis.__apdAudit||{}),buildingPlacementOwner:audit.owner,buildingPlacementMigration:MIGRATION_ID};
  }
  if(typeof host.markReady==='function')host.markReady(audit);
  return {game,owners,restore,audit};
}
