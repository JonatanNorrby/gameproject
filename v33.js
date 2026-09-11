// Alien Planet Defense v33
// Stability pass: reliable unit purchases, farther default zoom, fog-aware combat,
// coherent platoon river movement, and mobile-safe state cleanup.
document.title='Alien Planet Defense v33';

const V33_DEFAULT_ZOOM=0.65;
CONFIG.WORLD.DEFAULT_ZOOM=V33_DEFAULT_ZOOM;

// -----------------------------------------------------------------------------
// RELIABLE UNIT PURCHASES
// Older versions layered several click handlers onto the same unit buttons. On
// touch devices those handlers could race build-mode cleanup and base spawning.
// Replace every unit button node once, removing all inherited listeners, and give
// it exactly one purchase action.
// -----------------------------------------------------------------------------
function v33BaseSpawnPoint(radius,air=false){
 const r=Math.max(12,radius||20);
 for(let ring=0;ring<6;ring++){
  const distance=BASE_RADIUS+r+10+ring*28;
  for(let i=0;i<32;i++){
   const a=i/32*Math.PI*2+ring*.17,x=BASE_X+Math.cos(a)*distance,y=BASE_Y+Math.sin(a)*distance;
   if(!isWorldInside(x,y,r))continue;
   if(air||!navPointBlocked(x,y,r))return{x,y};
  }
 }
 return{x:Math.min(WORLD_W-r,BASE_X+BASE_RADIUS+r+18),y:BASE_Y};
}

function v33PurchaseUnit(type){
 const def=BUILD[type];
 if(!def||def.kind!=='unit')return false;
 if(type==='combatship'&&state.units.some(u=>u.role==='combatship'&&u.hp>0)){
  els.message.textContent='Only one Combat Ship can be active at a time.';updateHud();return false;
 }
 if(!payResource('gold',def.cost)){
  els.message.textContent=`Need ${def.cost} gold for ${def.label}.`;updateHud();return false;
 }
 const air=typeof V25_AIR_ROLES!=='undefined'&&V25_AIR_ROLES.has(type),p=v33BaseSpawnPoint(def.radius||22,air);let u;
 try{
  if(type==='truck'){
   const hp=CONFIG.TRUCK.HP*state.mods.truckHp;
   u={id:'u'+Date.now()+Math.random(),type:'truck',x:p.x,y:p.y,hp,maxHp:hp,moveTarget:null,path:[],heading:0,cargo:0,cargoType:null,route:[],routeIndex:0,routeLoop:false,routeActive:false,routeWaiting:false,routePendingStart:false,platoonId:null,platoonSlot:0};
  }else if(air){
   u=makeAirUnit(type,p.x,p.y);
  }else{
   const role=type==='soldier'?'rifleman':type;
   u=makeGroundUnit(role,p.x,p.y);
  }
 }catch(err){
  // Refund if a future unit definition is malformed rather than charging the user.
  refundResource('gold',def.cost);
  console.error('Unit spawn failed',type,err);
  els.message.textContent=`Could not deploy ${def.label}. Purchase refunded.`;updateHud();return false;
 }
 if(type==='apc')u.passengerId=null;
 u.platoonId=null;u.platoonSlot=0;
 state.units.push(u);
 buildType=null;state.routeEditing=false;state.attachMode=false;state.platoonAttachMode=false;
 state.selectedUnit=u;state.selectedTower=null;state.selectedStorageBuilding=null;
 if(typeof updateTowerPanel==='function')updateTowerPanel();
 els.message.textContent=`${unitDisplayName(u)} deployed from the base.`;
 updateHud();
 return true;
}
spawnUnitAtBase=v33PurchaseUnit;

function installV33UnitButtons(){
 const current=[...document.querySelectorAll('.buildBtn[data-type]')];
 for(const oldBtn of current){
  const type=oldBtn.dataset.type,def=BUILD[type];
  if(!def||def.kind!=='unit')continue;
  const btn=oldBtn.cloneNode(true);
  btn.classList.remove('selected');
  btn.type='button';
  btn.onclick=e=>{
   e.preventDefault();e.stopPropagation();
   // Clear every placement/context mode before buying so no stale map tap can
   // consume the purchase or place a second copy.
   buildType=null;state.routeEditing=false;state.attachMode=false;state.platoonAttachMode=false;
   if(typeof resetWallPath==='function')resetWallPath();
   const ok=v33PurchaseUnit(type);
   if(ok&&typeof closeCommandMenu==='function')setTimeout(closeCommandMenu,0);
  };
  btn.addEventListener('pointerdown',e=>e.stopPropagation());
  btn.addEventListener('pointerup',e=>e.stopPropagation());
  oldBtn.replaceWith(btn);
 }
}
installV33UnitButtons();

// Unit build modes are obsolete. If an old state somehow survives a menu/action,
// never let a battlefield tap become a second unit purchase.
const v32PlaceBuildV33=placeBuild;
placeBuild=function(x,y){
 const def=buildType?BUILD[buildType]:null;
 if(def?.kind==='unit'){buildType=null;updateHud();return false;}
 return v32PlaceBuildV33(x,y);
};

// -----------------------------------------------------------------------------
// FOG OF WAR SHOULD AFFECT TARGET ACQUISITION, NOT JUST DRAWING
// -----------------------------------------------------------------------------
function v33WithVisibleEnemies(fn){
 if(typeof pointVisibleV32!=='function')return fn();
 const all=state.enemies;
 state.enemies=all.filter(e=>pointVisibleV32(e.x,e.y));
 try{return fn();}finally{state.enemies=all;}
}
const v32FindTargetV33=findTarget;
findTarget=function(...args){return v33WithVisibleEnemies(()=>v32FindTargetV33(...args));};
const v32FindTargetWhereV33=findTargetWhere;
findTargetWhere=function(...args){return v33WithVisibleEnemies(()=>v32FindTargetWhereV33(...args));};
const v32NearestTargetsWhereV33=nearestTargetsWhere;
nearestTargetsWhere=function(...args){return v33WithVisibleEnemies(()=>v32NearestTargetsWhereV33(...args));};
if(typeof nearestEnemyExcept==='function'){
 const v32NearestEnemyExceptV33=nearestEnemyExcept;
 nearestEnemyExcept=function(...args){return v33WithVisibleEnemies(()=>v32NearestEnemyExceptV33(...args));};
}

// -----------------------------------------------------------------------------
// RIVER + PLATOON SPEED CONSISTENCY
// Rebuild effective unit speed from the actual role config so wrapper layers do
// not recursively double-apply the river penalty. If any active platoon member is
// in water, the group's slowest effective speed governs everybody.
// -----------------------------------------------------------------------------
function v33IntrinsicSpeed(u){
 if(!u)return CONFIG.SOLDIER.MOVE_SPEED;
 if(u.type==='truck')return CONFIG.TRUCK.MOVE_SPEED;
 const cfg=roleConfig(u)||{};
 return Number(cfg.MOVE_SPEED)||CONFIG.SOLDIER.MOVE_SPEED;
}
function v33TerrainSpeed(u){
 let speed=v33IntrinsicSpeed(u);
 if(typeof pointInRiver==='function'&&!isFlyingUnit(u)&&pointInRiver(u.x,u.y))speed*=CONFIG.RIVERS.SLOW_FACTOR;
 return speed;
}
unitSpeed=function(u){
 if(u?.platoonId&&typeof platoonMembers==='function'&&typeof canUsePlatoon==='function'){
  const members=platoonMembers(u.platoonId).filter(canUsePlatoon);
  if(members.length>=2)return Math.min(...members.map(v33TerrainSpeed));
 }
 return v33TerrainSpeed(u);
};

// -----------------------------------------------------------------------------
// DEFAULT CAMERA: START FARTHER OUT
// -----------------------------------------------------------------------------
function applyV33DefaultCamera(){
 state.camera.zoom=V33_DEFAULT_ZOOM;
 const z=V33_DEFAULT_ZOOM;
 state.camera.x=BASE_X-W/(2*z);
 state.camera.y=BASE_Y-H/(2*z);
 clampCamera();
 if(typeof updateZoomLabel==='function')updateZoomLabel();
 if(typeof updateCancelButtonPosition==='function')updateCancelButtonPosition();
}
const v32ResetV33=reset;
reset=function(){
 v32ResetV33();
 buildType=null;state.routeEditing=false;state.attachMode=false;state.platoonAttachMode=false;
 applyV33DefaultCamera();
 updateHud();
};
els.restart.onclick=reset;

// Apply the farther view to the already-created title-screen preview without
// regenerating the map yet again. Fresh START and RESTART both use the wrapper.
applyV33DefaultCamera();

// -----------------------------------------------------------------------------
// MOBILE / INPUT CLEANUP
// -----------------------------------------------------------------------------
function clearV33TransientInput(){
 pointer=null;
 if(typeof wallPainting!=='undefined')wallPainting=false;
 if(typeof v26PanLast!=='undefined')v26PanLast=null;
 state.last=performance.now();
}
window.addEventListener('pagehide',clearV33TransientInput,{passive:true});
window.addEventListener('blur',clearV33TransientInput,{passive:true});
window.addEventListener('orientationchange',()=>setTimeout(()=>{clearV33TransientInput();clampCamera();if(typeof updateZoomLabel==='function')updateZoomLabel();},100),{passive:true});

// Guide corrections for the stabilized behavior.
if(typeof guideBoxByTitle==='function'){
 const camera=guideBoxByTitle('Camera');if(camera)camera.querySelector('p').textContent='Runs now start at a 65% strategic zoom. Use the always-visible − / + controls, the Command Menu zoom controls, or the mouse wheel on desktop. Zoom ranges from 42% to 135%.';
 const mobile=guideBoxByTitle('Mobile / Landscape');if(mobile)mobile.querySelector('p').textContent='Landscape is recommended on phones. The map fills the whole device screen, controls float above it, unit purchases deploy directly from the central base, and large − / + zoom controls remain available without opening ☰ MENU.';
}
