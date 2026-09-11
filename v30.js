// Alien Planet Defense v30
// Economy/logistics pass: low starting economy, storage upgrades, remote resources,
// base-spawned units, and service-aware auto-start Truck routes.
document.title='Alien Planet Defense v30';

// -----------------------------------------------------------------------------
// ECONOMY TUNING
// The opening industrial chain exactly fits the 125 starting Gold:
// Ore Mine 20 + Refinery 35 + Truck 70. This prevents a 0-Metal soft lock.
// -----------------------------------------------------------------------------
CONFIG.GAME.STARTING_CREDITS=125;
CONFIG.GAME.STARTING_METAL=0;
CONFIG.CRYSTALS.MINE_COST=45;
CONFIG.ORE.MINE_COST=20;
CONFIG.REFINERY.COST=35;
CONFIG.CRYSTALS.DEPOT_BASE_CLEARANCE=720;
CONFIG.ORE.DEPOT_BASE_CLEARANCE=720;

BUILD.mine.cost=CONFIG.CRYSTALS.MINE_COST;BUILD.mine.currency='metal';BUILD.mine.label='Crystal Mine';
BUILD.oremine.cost=CONFIG.ORE.MINE_COST;BUILD.oremine.currency='gold';BUILD.oremine.label='Ore Mine';
BUILD.refinery.cost=CONFIG.REFINERY.COST;BUILD.refinery.currency='gold';

CONFIG.REFINERY.STORAGE_LEVELS=[260,440,700];
CONFIG.REFINERY.STORAGE_UPGRADE_COSTS=[0,80,140];
CONFIG.LANDING_PAD.STORAGE_LEVELS=[520,800,1200];
CONFIG.LANDING_PAD.STORAGE_UPGRADE_COSTS=[0,180,300];

function setBuildPriceLabel(type,text){const b=document.querySelector(`.buildBtn[data-type="${type}"] small`);if(b)b.textContent=text;}
setBuildPriceLabel('mine',`${CONFIG.CRYSTALS.MINE_COST} metal`);
setBuildPriceLabel('oremine',`${CONFIG.ORE.MINE_COST} gold`);
setBuildPriceLabel('refinery',`${CONFIG.REFINERY.COST} gold`);

// -----------------------------------------------------------------------------
// STORAGE LEVELS: Landing Pad + Refinery, 1/3 -> 3/3
// -----------------------------------------------------------------------------
function storageLevel(s){return Math.max(1,Math.min(3,s?.storageLevel||1));}
function storageCap(s){
 if(s?.type==='landingpad')return CONFIG.LANDING_PAD.STORAGE_LEVELS[storageLevel(s)-1];
 if(s?.type==='refinery')return CONFIG.REFINERY.STORAGE_LEVELS[storageLevel(s)-1];
 return 0;
}
function initStorageBuilding(s){if(s&&(s.type==='landingpad'||s.type==='refinery')&&!s.storageLevel)s.storageLevel=1;}
function storageUpgradeCost(s){const next=storageLevel(s)+1;if(next>3)return 0;return s.type==='landingpad'?CONFIG.LANDING_PAD.STORAGE_UPGRADE_COSTS[next-1]:CONFIG.REFINERY.STORAGE_UPGRADE_COSTS[next-1];}
function storageBuildingName(s){return s?.type==='landingpad'?'Landing Pad':'Refinery';}

state.selectedStorageBuilding=null;
const storageUpgradeBtn=document.createElement('button'),storageCloseBtn=document.createElement('button');
storageUpgradeBtn.id='storageUpgradeBtn';storageUpgradeBtn.style.display='none';
storageCloseBtn.id='storageCloseBtn';storageCloseBtn.textContent='CLOSE BUILDING';storageCloseBtn.style.display='none';
els.unitActions.appendChild(storageUpgradeBtn);els.unitActions.appendChild(storageCloseBtn);

function selectedStorageBuilding(){const s=state.selectedStorageBuilding;return s&&state.structures.includes(s)&&s.built&&(s.type==='landingpad'||s.type==='refinery')?s:null;}
function updateStorageActions(){
 const s=selectedStorageBuilding();if(!s)return;
 initStorageBuilding(s);const lvl=storageLevel(s),cap=storageCap(s),label=document.querySelector('#unitActions .unitActionLabel');
 els.unitActions.classList.add('active');
 if(label)label.textContent=`${storageBuildingName(s).toUpperCase()} STORAGE ${lvl}/3 · CAP ${cap}`;
 for(const b of els.unitActions.querySelectorAll('button'))if(b!==storageUpgradeBtn&&b!==storageCloseBtn)b.style.display='none';
 storageCloseBtn.style.display='inline-flex';
 if(lvl<3){const cost=storageUpgradeCost(s);storageUpgradeBtn.style.display='inline-flex';storageUpgradeBtn.disabled=resourceAmount('gold')<cost&&!state.debug.unlimitedCash;storageUpgradeBtn.textContent=`UPGRADE STORAGE ${lvl+1}/3 · ${cost} GOLD`;}
 else{storageUpgradeBtn.style.display='inline-flex';storageUpgradeBtn.disabled=true;storageUpgradeBtn.textContent='STORAGE MAX 3/3';}
}
storageUpgradeBtn.onclick=()=>{
 const s=selectedStorageBuilding();if(!s)return;const lvl=storageLevel(s);if(lvl>=3)return;const cost=storageUpgradeCost(s);
 if(!payResource('gold',cost)){els.message.textContent=`Need ${cost} gold for the storage upgrade.`;return;}
 s.storageLevel=lvl+1;els.message.textContent=`${storageBuildingName(s)} storage upgraded to ${s.storageLevel}/3 · capacity ${storageCap(s)}.`;updateHud();
};
storageCloseBtn.onclick=()=>{state.selectedStorageBuilding=null;storageUpgradeBtn.style.display='none';storageCloseBtn.style.display='none';els.message.textContent='Building selection closed.';updateHud();};

const v29UpdateUnitActionsV30=updateUnitActions;
updateUnitActions=function(){
 v29UpdateUnitActionsV30();
 // START LOOP is intentionally removed: finished routes start automatically.
 els.routeLoop.style.display='none';
 if(state.routeEditing&&state.selectedUnit?.type==='truck')els.routeRecord.textContent='FINISH ROUTE';
 else if(state.selectedUnit?.type==='truck')els.routeRecord.textContent='RECORD ROUTE';
 if(selectedStorageBuilding())updateStorageActions();
};

function logisticsBuildingAt(x,y){
 let best=null,bd=Infinity;
 for(const s of state.structures){
  if(!s.built||!['mine','oremine','refinery','landingpad'].includes(s.type))continue;
  const hit=structureRadius(s)+28,d=Math.hypot(x-s.x,y-s.y);if(d<=hit&&d<bd){best=s;bd=d;}
 }
 return best;
}
function storageSelectableAt(x,y){
 let best=null,bd=Infinity;
 for(const s of state.structures){if(!s.built||(s.type!=='refinery'&&s.type!=='landingpad'))continue;const d=Math.hypot(x-s.x,y-s.y);if(d<=structureRadius(s)+24&&d<bd){best=s;bd=d;}}
 return best;
}

// -----------------------------------------------------------------------------
// MINE CURRENCIES
// v26 hardcoded Gold for both mine types, so replace that branch here.
// -----------------------------------------------------------------------------
const v29PlaceBuildV30=placeBuild;
placeBuild=function(x,y){
 if(buildType==='mine'||buildType==='oremine'){
  const def=BUILD[buildType],resource=buildType==='mine'?'crystal':'ore',currency=buildType==='mine'?'metal':'gold',d=findResourceDepotAt(x,y,resource);
  if(!d){els.message.textContent=`This ${resource} depot already has 3 Mines, or no matching depot is under the cursor.`;return;}
  if(freeWorkers()<=0){els.message.textContent=`All ${CONFIG.WORKERS.COUNT} workers are busy.`;return;}
  if(placementBlocked(x,y,def.radius,buildType)){els.message.textContent='That resource depot is blocked.';return;}
  if(!payResource(currency,def.cost)){els.message.textContent=`Need ${def.cost} ${currency}.`;return;}
  const slot=currentDepotMines(d).length,p=mineSlotPosition(d,slot),hp=buildType==='mine'?CONFIG.CRYSTALS.MINE_HP:CONFIG.ORE.MINE_HP;
  state.structures.push({id:'s'+Date.now()+Math.random(),type:buildType,x:p.x,y:p.y,hp,maxHp:hp,built:false,buildTime:def.buildTime,buildRemaining:def.buildTime,cool:0,protected:false,safeSpotId:null,stored:0,depotId:d.id,mineSlot:slot});
  normalizeDepotMineLinks();els.message.textContent=`${def.label} ${slot+1}/3 construction started for ${def.cost} ${currency}.`;updateHud();return;
 }
 return v29PlaceBuildV30(x,y);
};

// -----------------------------------------------------------------------------
// UNIT PURCHASES SPAWN AT THE BASE
// Unit buttons now purchase immediately; arbitrary battlefield deployment is gone.
// -----------------------------------------------------------------------------
function findBaseSpawnPoint(radius,air=false){
 for(let ring=0;ring<5;ring++)for(let i=0;i<24;i++){
  const a=(i/24)*Math.PI*2+ring*.19,d=BASE_RADIUS+radius+12+ring*26,x=BASE_X+Math.cos(a)*d,y=BASE_Y+Math.sin(a)*d;
  if(!isWorldInside(x,y,radius))continue;
  if(air||!navPointBlocked(x,y,radius))return{x,y};
 }
 return{x:BASE_X+BASE_RADIUS+radius+18,y:BASE_Y};
}
function spawnUnitAtBase(type){
 const def=BUILD[type];if(!def||def.kind!=='unit')return false;
 if(type==='combatship'&&state.units.some(u=>u.role==='combatship'&&u.hp>0)){els.message.textContent='Only one Combat Ship can be active at a time.';return false;}
 if(!payResource('gold',def.cost)){els.message.textContent=`Need ${def.cost} gold for ${def.label}.`;return false;}
 const role=type==='soldier'?'rifleman':type,air=typeof V25_AIR_ROLES!=='undefined'&&V25_AIR_ROLES.has(type),p=findBaseSpawnPoint(def.radius||22,air);let u;
 if(type==='truck'){
  const hp=CONFIG.TRUCK.HP*state.mods.truckHp;u={id:'u'+Date.now()+Math.random(),type:'truck',x:p.x,y:p.y,hp,maxHp:hp,moveTarget:null,path:[],heading:0,cargo:0,cargoType:null,route:[],routeIndex:0,routeLoop:false,routeActive:false,routeWaiting:false,routePendingStart:false};
 }else if(air)u=makeAirUnit(role,p.x,p.y);
 else u=makeGroundUnit(role,p.x,p.y);
 if(role==='apc')u.passengerId=null;
 u.platoonId=null;u.platoonSlot=0;state.units.push(u);buildType=null;state.selectedUnit=u;state.selectedTower=null;state.selectedStorageBuilding=null;
 els.message.textContent=`${unitDisplayName(u)} deployed from the base.`;updateHud();return true;
}
for(const b of document.querySelectorAll('.buildBtn')){
 const type=b.dataset.type,def=BUILD[type];if(!def||def.kind!=='unit')continue;
 b.addEventListener('click',()=>{setTimeout(()=>{if(BUILD[type]?.kind!=='unit')return;spawnUnitAtBase(type);if(typeof closeCommandMenu==='function')closeCommandMenu();},0);});
}

// -----------------------------------------------------------------------------
// TRUCK ROUTES
// Route points may be normal map points or exact logistics-building centers.
// Routes auto-start when FINISH ROUTE is pressed. There is no START LOOP step.
// -----------------------------------------------------------------------------
function routeStopPoint(u,index=u.routeIndex){
 const p=u.route?.[index];if(!p)return null;
 if(p.buildingId){const s=state.structures.find(v=>v.id===p.buildingId&&v.built);if(s)return{x:s.x,y:s.y,buildingId:s.id};}
 return{x:p.x,y:p.y,buildingId:p.buildingId||null};
}
function sendTruckToRouteIndex(u,index){
 if(!u.route?.length)return false;u.routeIndex=((index%u.route.length)+u.route.length)%u.route.length;u.routeWaiting=false;u.routeServiceLabel='';const p=routeStopPoint(u,u.routeIndex);if(!p)return false;
 return setUnitDestination(u,p.x,p.y,{preserveRoute:true});
}
function startTruckRoute(u){
 if(!u||u.type!=='truck'||u.route.length<2)return false;
 if(typeof removeFromPlatoon==='function')removeFromPlatoon(u);
 u.routeLoop=true;u.routeActive=true;u.routePendingStart=false;u.routeWaiting=false;u.routeIndex=0;
 return sendTruckToRouteIndex(u,0);
}
function finishTruckRouteStop(u){
 if(!u.routeActive||!u.routeLoop||u.route.length<2)return;
 u.routeWaiting=false;u.routeServiceLabel='';sendTruckToRouteIndex(u,(u.routeIndex+1)%u.route.length);
}
// Called by inherited movement exactly when the current route destination is reached.
advanceTruckRoute=function(u){
 if(!u.routeLoop||u.route.length<2){u.routeActive=false;u.routeWaiting=false;return;}
 u.routeWaiting=true;u.path=[];u.moveTarget=null;
};

els.routeRecord.onclick=()=>{
 const u=state.selectedUnit;if(!u||u.type!=='truck')return;
 if(!state.routeEditing){
  if(typeof removeFromPlatoon==='function')removeFromPlatoon(u);u.route=[];u.routeLoop=false;u.routeActive=false;u.routeWaiting=false;u.routePendingStart=false;u.path=[];u.moveTarget=null;state.routeEditing=true;
  els.message.textContent='Route recording: tap Mines, Refineries or Landing Pads directly, or tap map waypoints. Press FINISH ROUTE when done.';
 }else{
  if(u.route.length<2){els.message.textContent='Route needs at least 2 stops. Keep recording.';updateHud();return;}
  state.routeEditing=false;if(startTruckRoute(u)){els.message.textContent='Route saved and started automatically. The Truck will fully service each logistics stop before continuing.';state.selectedUnit=null;state.attachMode=false;}else els.message.textContent='Could not start that Truck route.';
 }updateHud();
};
els.routeLoop.onclick=()=>{};
const v29RouteClearV30=els.routeClear.onclick;
els.routeClear.onclick=()=>{const u=state.selectedUnit;if(u?.type==='truck'){u.routeWaiting=false;u.routeServiceLabel='';u.routePendingStart=false;}return v29RouteClearV30();};

// -----------------------------------------------------------------------------
// TRUCK SERVICE: fully load/unload before a route continues.
// -----------------------------------------------------------------------------
function truckCapacity(u){return Math.round(CONFIG.TRUCK.CAPACITY*state.mods.truckCapacity);}
function loadTruckAtMine(u,mine){
 if(!mine||!mine.built||(mine.type!=='mine'&&mine.type!=='oremine'))return true;
 const type=mine.type==='oremine'?'ore':'crystal',cap=truckCapacity(u);if(u.cargoType&&u.cargoType!==type)return true;
 if(u.cargo<cap&&mine.stored>0){const take=Math.min(cap-u.cargo,mine.stored);u.cargoType=type;u.cargo+=take;mine.stored-=take;}
 const depot=state.depots.find(d=>d.id===mine.depotId),depleted=(!depot||depot.stock<=.001)&&mine.stored<=.001;
 u.routeServiceLabel=`LOADING ${Math.floor(u.cargo)}/${cap}`;return u.cargo>=cap-.001||depleted;
}
function unloadTruckAtRefinery(u,r){
 initStorageBuilding(r);if(u.cargo<=.001){u.cargo=0;u.cargoType=null;return true;}if(u.cargoType!=='ore')return true;
 const cap=storageCap(r),room=Math.max(0,cap-r.oreStored),take=Math.min(room,u.cargo);if(take>0){r.oreStored+=take;u.cargo-=take;}if(u.cargo<=.001){u.cargo=0;u.cargoType=null;return true;}u.routeServiceLabel=`UNLOADING ORE ${Math.floor(u.cargo)} LEFT`;return false;
}
function unloadTruckAtPad(u,pad){
 initPadV26(pad);initStorageBuilding(pad);if(u.cargo<=.001){u.cargo=0;u.cargoType=null;return true;}if(u.cargoType!=='crystal')return true;
 const cap=storageCap(pad),room=Math.max(0,cap-pad.crystalStored),take=Math.min(room,u.cargo);if(take>0){pad.crystalStored+=take;u.cargo-=take;}if(u.cargo<=.001){u.cargo=0;u.cargoType=null;return true;}u.routeServiceLabel=`UNLOADING CRYSTAL ${Math.floor(u.cargo)} LEFT`;return false;
}
function serviceTruckAtBuilding(u,s){
 if(!s)return true;if(s.type==='mine'||s.type==='oremine')return loadTruckAtMine(u,s);if(s.type==='refinery')return unloadTruckAtRefinery(u,s);if(s.type==='landingpad')return unloadTruckAtPad(u,s);return true;
}
function nearestManualService(u){
 let best=null,bd=Infinity;for(const s of state.structures){if(!s.built||!['mine','oremine','refinery','landingpad'].includes(s.type))continue;const range=(s.type==='landingpad'?CONFIG.LANDING_PAD.TRUCK_UNLOAD_RANGE:s.type==='refinery'?CONFIG.REFINERY.UNLOAD_RANGE:CONFIG.TRUCK.PICKUP_RANGE),d=Math.hypot(u.x-s.x,u.y-s.y);if(d<=range&&d<bd){best=s;bd=d;}}return best;
}
updateTruckEconomy=function(){
 for(const u of state.units){if(u.type!=='truck')continue;
  if(u.routeActive&&u.routeWaiting){
   const stop=u.route?.[u.routeIndex],s=stop?.buildingId?state.structures.find(v=>v.id===stop.buildingId&&v.built):null;
   if(!stop?.buildingId||!s||serviceTruckAtBuilding(u,s))finishTruckRouteStop(u);continue;
  }
  // A manually controlled Truck only services while actually stopped.
  if(u.path?.length||u.routeActive)continue;const s=nearestManualService(u);if(s)serviceTruckAtBuilding(u,s);
 }
};

// Route-building taps are intercepted before the older truck waypoint logic.
const v29HandleTapV30=handleTap;
handleTap=function(x,y){
 const u=state.selectedUnit;
 if(u?.type==='truck'&&state.routeEditing){
  const s=logisticsBuildingAt(x,y);
  if(s){u.route.push({x:s.x,y:s.y,buildingId:s.id});els.message.textContent=`Route stop ${u.route.length}: ${s.type==='mine'?'Crystal Mine':s.type==='oremine'?'Ore Mine':s.type==='refinery'?'Refinery':'Landing Pad'} (exact building stop).`;updateHud();return;}
  if(navPointBlocked(x,y,uRadius(u))){els.message.textContent='That route waypoint is blocked. Tap a logistics building directly or choose an open waypoint.';return;}
  u.route.push({x,y,buildingId:null});els.message.textContent=`Route waypoint ${u.route.length} added.`;updateHud();return;
 }
 const storage=(!state.selectedUnit&&!(typeof wallModeActive==='function'&&wallModeActive()))?storageSelectableAt(x,y):null;
 if(storage){state.selectedStorageBuilding=storage;state.selectedTower=null;state.selectedUnit=null;buildType=null;els.message.textContent=`${storageBuildingName(storage)} selected · storage ${storageLevel(storage)}/3.`;updateHud();return;}
 state.selectedStorageBuilding=null;return v29HandleTapV30(x,y);
};

// Exact-building routes draw naturally because route points use building centers.
// Add a service status above waiting Trucks so it is obvious why they stopped.
const v29DrawUnitV30=drawUnit;
drawUnit=function(u){v29DrawUnitV30(u);if(u.type!=='truck'||!u.routeWaiting||!u.routeServiceLabel)return;ctx.save();ctx.translate(u.x,u.y);ctx.fillStyle='rgba(4,13,19,.92)';ctx.fillRect(-48,-48,96,15);ctx.fillStyle='#bff4d0';ctx.font='bold 9px Arial';ctx.textAlign='center';ctx.fillText(u.routeServiceLabel,0,-37);ctx.restore();};

const v29DrawStructureV30=drawStructure;
drawStructure=function(s){
 v29DrawStructureV30(s);if(!s.built||(s.type!=='refinery'&&s.type!=='landingpad'))return;initStorageBuilding(s);ctx.save();ctx.translate(s.x,s.y);
 const cap=storageCap(s),stored=s.type==='refinery'?s.oreStored:s.crystalStored,y=s.type==='landingpad'?CONFIG.LANDING_PAD.RADIUS+50:50;
 ctx.fillStyle='rgba(5,14,20,.92)';ctx.fillRect(-48,y-11,96,14);ctx.fillStyle='#e6f6fc';ctx.font='bold 8px Arial';ctx.textAlign='center';ctx.fillText(`STORAGE ${storageLevel(s)}/3 · ${Math.floor(stored)}/${cap}`,0,y-1);
 if(state.selectedStorageBuilding===s){ctx.strokeStyle='#ffe17c';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,structureRadius(s)+10,0,Math.PI*2);ctx.stroke();}
 ctx.restore();
};

// Build choices cancel contextual building selection and route-creation modes.
for(const b of document.querySelectorAll('.buildBtn'))b.addEventListener('click',()=>{state.selectedStorageBuilding=null;if(state.platoonAttachMode)state.platoonAttachMode=false;});

// -----------------------------------------------------------------------------
// GUIDE
// -----------------------------------------------------------------------------
if(typeof guideBoxByTitle==='function'){
 const gold=guideBoxByTitle('Gold & Metal');if(gold)gold.querySelector('p').textContent='New runs start with 125 Gold and 0 Metal. Ore Mines cost Gold; Ore delivered by Trucks to Refineries becomes Metal. Crystal Mines cost Metal, and exported Crystal produces Gold. The opening Ore Mine + Refinery + Truck industrial chain costs exactly 125 Gold.';
 const depots=guideBoxByTitle('Resource Depots');if(depots)depots.querySelector('p').textContent='Crystal and Ore deposits are now generated much farther from the base and contain finite stock; farther deposits still generally hold more. Up to 3 matching Mines can share a deposit. Ore Mines cost Gold; Crystal Mines cost Metal.';
 const trucks=guideBoxByTitle('Trucks & Routes');if(trucks)trucks.querySelector('p').textContent='Select a Truck and RECORD ROUTE. During recording you can tap Mines, Refineries and Landing Pads directly; that creates an exact building stop instead of a nearby waypoint. FINISH ROUTE starts it automatically—there is no Start Route button. Trucks stop at service buildings and wait until fully loaded or fully unloaded before continuing.';
 const pads=guideBoxByTitle('Landing Pads & Export Ships');if(pads)pads.querySelector('p').textContent='Landing Pads warehouse Crystal and can upgrade storage from 1/3 to 3/3: 520 → 800 → 1200. Tap a built Pad and use its storage upgrade in ☰ MENU. Export ships still load from the warehouse, attract nearby aliens and can be destroyed while landed.';
 const vehicles=guideBoxByTitle('Vehicles & Aircraft');if(vehicles)vehicles.querySelector('p').textContent+=' Newly purchased movable units deploy at the central base instead of being placed anywhere on the map.';
}
const guideGridV30=document.querySelector('#guidePanel .guide-grid');if(guideGridV30){const box=document.createElement('div');box.className='guide-box';box.innerHTML='<b>Refinery Storage</b><p>Refineries can upgrade Ore storage from 1/3 to 3/3: 260 → 440 → 700. Tap a built Refinery, open ☰ MENU and buy the next Gold-funded storage upgrade. Larger buffers keep long Truck routes productive while the Refinery continuously converts Ore into Metal.</p>';guideGridV30.appendChild(box);}
const hintV30=document.getElementById('hint');if(hintV30)hintV30.textContent='125 starting Gold · 0 Metal · Ore Mines use Gold · Crystal Mines use Metal · Truck routes auto-start and fully service exact building stops.';

// -----------------------------------------------------------------------------
// RESET: apply the new economy before every fresh map is generated.
// -----------------------------------------------------------------------------
const v29ResetV30=reset;
reset=function(){
 v29ResetV30();state.selectedStorageBuilding=null;state.routeEditing=false;state.platoonAttachMode=false;buildType=null;
 for(const s of state.structures)initStorageBuilding(s);for(const u of state.units)if(u.type==='truck'){u.routeWaiting=false;u.routeServiceLabel='';u.routePendingStart=false;}
 updateHud();
};
els.restart.onclick=reset;

// Rebuild the title-screen preview/state using the new starting resources and
// the much larger resource-depot exclusion radius.
reset();
