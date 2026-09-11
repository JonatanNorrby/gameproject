// Alien Planet Defense v28
// Persistent resource HUD, clear paused view, first-run starts paused,
// plus Platoons and APC transports.
document.title='Alien Planet Defense v28';

// -----------------------------------------------------------------------------
// PERSISTENT RESOURCE STRIP
// -----------------------------------------------------------------------------
const persistentResources=document.createElement('div');
persistentResources.id='persistentResources';
persistentResources.innerHTML=`
 <span>BASE <b id="persistBase">300</b></span>
 <span>GOLD <b id="persistGold">650</b></span>
 <span>METAL <b id="persistMetal">160</b></span>
 <span>WORKERS <b id="persistWorkers">3/3</b></span>
 <span id="persistPaused">PAUSED</span>`;
document.body.appendChild(persistentResources);
const persistBase=document.getElementById('persistBase'),persistGold=document.getElementById('persistGold'),persistMetal=document.getElementById('persistMetal'),persistWorkers=document.getElementById('persistWorkers'),persistPaused=document.getElementById('persistPaused');
function updatePersistentResources(){
 if(!state)return;
 persistBase.textContent=`${Math.ceil(state.baseHp)}/${state.maxBaseHp}`;
 persistGold.textContent=state.debug?.unlimitedCash?'∞':Math.floor(state.credits||0);
 persistMetal.textContent=Math.floor(state.metal||0);
 const total=CONFIG.WORKERS.COUNT,busy=activeConstructionCount();persistWorkers.textContent=`${Math.max(0,total-busy)}/${total}`;
 persistPaused.classList.toggle('active',!!state.paused&&!state.gameOver);
 persistentResources.classList.toggle('title-hidden',typeof mainMenu!=='undefined'&&!mainMenu.classList.contains('hidden'));
}
const v27UpdateHudV28=updateHud;
updateHud=function(){v27UpdateHudV28();updatePersistentResources();};

// Keep the resource strip readable when the command drawer is open.
const v27SetCommandMenuV28=setCommandMenu;
setCommandMenu=function(open){document.body.classList.toggle('command-open-v28',open);v27SetCommandMenuV28(open);updatePersistentResources();};

// -----------------------------------------------------------------------------
// PAUSE PRESENTATION + FIRST START
// -----------------------------------------------------------------------------
// The simulation remains paused, but drawing runs with the pause flag hidden so
// no dimmer or PAUSED overlay obscures the battlefield.
const v27DrawV28=draw;
draw=function(){
 const paused=state.paused;
 if(paused)state.paused=false;
 try{v27DrawV28();}finally{state.paused=paused;}
};

// First START opens a fresh run already paused. Later RESUME behaves normally.
startGameBtn.onclick=()=>{
 const first=!gameStarted;
 if(first){reset();gameStarted=true;}
 closeMainMenu();
 if(first){
  state.paused=true;
  els.pause.textContent='▶ RESUME';
  els.pause.classList.add('paused');
  els.message.textContent='Run started paused — plan your opening, then press RESUME in ☰ MENU.';
 }else{
  els.pause.textContent=state.paused?'▶ RESUME':'⏸ PAUSE';
  els.pause.classList.toggle('paused',state.paused);
 }
 state.last=performance.now();updateHud();
};

// -----------------------------------------------------------------------------
// PLATOON + APC TUNING
// -----------------------------------------------------------------------------
CONFIG.PLATOON={COST:115,MOVE_SPEED:142,HP:360,RANGE:235,MEMBERS:15,FIRE_INTERVAL:0.52,DAMAGE:1.50,BULLET_SPEED:740};
CONFIG.APC={COST:190,MOVE_SPEED:172,HP:520,RANGE:185,FIRE_INTERVAL:0.23,DAMAGE:3.2,BULLET_SPEED:820,LOAD_RANGE:105,UNLOAD_DISTANCE:56,CAPACITY:1};
BUILD.platoon={kind:'unit',cost:CONFIG.PLATOON.COST,currency:'gold',label:'Rifle Platoon',radius:34};
BUILD.apc={kind:'unit',cost:CONFIG.APC.COST,currency:'gold',label:'APC',radius:30};
V25_GROUND_ROLES.add('platoon');
V25_GROUND_ROLES.add('apc');

const v27RoleConfigV28=roleConfig;
roleConfig=function(u){const r=u?.role||unitRole(u);if(r==='platoon')return CONFIG.PLATOON;if(r==='apc')return CONFIG.APC;return v27RoleConfigV28(u);};
const v27UnitDisplayNameV28=unitDisplayName;
unitDisplayName=function(u){const r=u?.role||unitRole(u);if(r==='platoon')return 'Rifle Platoon';if(r==='apc')return 'APC';return v27UnitDisplayNameV28(u);};
const v27URadiusV28=uRadius;
uRadius=function(u){const r=u?.role||unitRole(u);if(r==='platoon')return 34;if(r==='apc')return 30;return v27URadiusV28(u);};
const v27StructureOrUnitRadiusV28=structureOrUnitRadius;
structureOrUnitRadius=function(t){const r=t?.role||((t?.type==='soldier')?unitRole(t):null);if(r==='platoon')return 34;if(r==='apc')return 30;return v27StructureOrUnitRadiusV28(t);};

function v28BuildButton(type,label,cost){
 const b=document.createElement('button');b.className='buildBtn';b.dataset.type=type;b.innerHTML=`${label} <small>${cost} gold</small>`;
 b.onclick=()=>{
  state.selectedUnit=null;state.routeEditing=false;state.attachMode=false;
  if(state.selectedTower){state.selectedTower=null;if(typeof updateTowerPanel==='function')updateTowerPanel();}
  if(typeof resetWallPath==='function')resetWallPath();
  buildType=type;els.message.textContent=`Build mode: ${BUILD[type].label}.`;updateHud();
  if(typeof closeCommandMenu==='function')setTimeout(closeCommandMenu,0);
 };
 return b;
}
const unitsMenuV28=document.getElementById('unitsMenu'),truckBtnV28=unitsMenuV28?.querySelector('[data-type="truck"]');
if(unitsMenuV28&&truckBtnV28){unitsMenuV28.insertBefore(v28BuildButton('platoon','🪖 Rifle Platoon',CONFIG.PLATOON.COST),truckBtnV28);unitsMenuV28.insertBefore(v28BuildButton('apc','▣ APC',CONFIG.APC.COST),truckBtnV28);}
// Also harden v26 dynamically-created vehicle buttons against stale Tower/wall state.
for(const b of document.querySelectorAll('[data-type="tank"],[data-type="mobileartillery"],[data-type="repairvehicle"]'))b.addEventListener('click',()=>{if(state.selectedTower){state.selectedTower=null;updateTowerPanel();}if(typeof resetWallPath==='function')resetWallPath();});

// -----------------------------------------------------------------------------
// APC TRANSPORT ACTIONS
// -----------------------------------------------------------------------------
const apcLoadBtn=document.createElement('button'),apcUnloadBtn=document.createElement('button');
apcLoadBtn.id='apcLoadBtn';apcLoadBtn.textContent='LOAD INFANTRY';apcLoadBtn.style.display='none';
apcUnloadBtn.id='apcUnloadBtn';apcUnloadBtn.textContent='UNLOAD';apcUnloadBtn.style.display='none';
els.unitActions.appendChild(apcLoadBtn);els.unitActions.appendChild(apcUnloadBtn);
const APC_BOARDABLE=new Set(['rifleman','heavygunner','rocketeer','medic','engineer','scout','sniper','flametrooper','spotter','minelayer','platoon']);
function apcPassenger(apc){return apc?.passengerId?state.units.find(u=>u.id===apc.passengerId):null;}
function nearestBoardable(apc){let best=null,bd=CONFIG.APC.LOAD_RANGE;for(const u of state.units){if(u===apc||u.transportedIn||u.garrisonedIn||!APC_BOARDABLE.has(unitRole(u)))continue;const d=Math.hypot(u.x-apc.x,u.y-apc.y);if(d<bd){best=u;bd=d;}}return best;}
function placePassengerNear(apc,u){for(let i=0;i<16;i++){const a=i/16*Math.PI*2,d=CONFIG.APC.UNLOAD_DISTANCE,x=apc.x+Math.cos(a)*d,y=apc.y+Math.sin(a)*d;if(isWorldInside(x,y,uRadius(u))&&!navPointBlocked(x,y,uRadius(u))){u.x=x;u.y=y;return true;}}u.x=Math.max(uRadius(u),Math.min(WORLD_W-uRadius(u),apc.x+CONFIG.APC.UNLOAD_DISTANCE));u.y=apc.y;return false;}
function unloadAPC(apc,damageFrac=0){const u=apcPassenger(apc);if(!u){apc.passengerId=null;return null;}apc.passengerId=null;u.transportedIn=null;placePassengerNear(apc,u);if(damageFrac>0)u.hp=Math.max(1,u.hp*(1-damageFrac));return u;}
apcLoadBtn.onclick=()=>{const apc=state.selectedUnit;if(!apc||unitRole(apc)!=='apc')return;if(apcPassenger(apc)){els.message.textContent='APC is already carrying an infantry formation.';return;}const u=nearestBoardable(apc);if(!u){els.message.textContent='Move an infantry squad or Platoon within 105px of the APC first.';return;}u.transportedIn=apc.id;u.path=[];u.moveTarget=null;u.attachedTo=null;u.attachSlot=0;u.x=apc.x;u.y=apc.y;apc.passengerId=u.id;els.message.textContent=`${unitDisplayName(u)} loaded into APC.`;updateHud();};
apcUnloadBtn.onclick=()=>{const apc=state.selectedUnit;if(!apc||unitRole(apc)!=='apc')return;const u=unloadAPC(apc);els.message.textContent=u?`${unitDisplayName(u)} unloaded.`:'APC is empty.';updateHud();};

const v27UpdateUnitActionsV28=updateUnitActions;
updateUnitActions=function(){v27UpdateUnitActionsV28();const u=state.selectedUnit,isApc=!!u&&unitRole(u)==='apc';apcLoadBtn.style.display=isApc&&!apcPassenger(u)?'inline-flex':'none';apcLoadBtn.disabled=isApc&&!nearestBoardable(u);apcUnloadBtn.style.display=isApc&&!!apcPassenger(u)?'inline-flex':'none';if(isApc){const label=document.querySelector('#unitActions .unitActionLabel');if(label)label.textContent=`APC · ${apcPassenger(u)?'1/1 LOADED':'EMPTY'}`;}};

// Transported formations follow their APC and do not independently move.
const v27UpdateUnitMovementV28=updateUnitMovement;
updateUnitMovement=function(dt){v27UpdateUnitMovementV28(dt);for(const u of state.units){if(!u.transportedIn)continue;const apc=state.units.find(v=>v.id===u.transportedIn&&unitRole(v)==='apc'&&v.hp>0);if(!apc){u.transportedIn=null;continue;}u.x=apc.x;u.y=apc.y;u.path=[];u.moveTarget=null;}for(const apc of state.units.filter(u=>unitRole(u)==='apc'))if(apc.passengerId&&!state.units.some(u=>u.id===apc.passengerId))apc.passengerId=null;};

// Hide passengers from selection, enemy targeting, spotting and off-screen arrows.
unitAt=function(x,y){const z=typeof zoomValue==='function'?zoomValue():1,cssScale=W/Math.max(1,canvas.clientWidth||W),base=Math.max(38,26*cssScale)/z;let best=null,bd=Infinity;for(const u of state.units){if(u.garrisonedIn||u.transportedIn)continue;const hit=Math.max(base,uRadius(u)+12/z),d=Math.hypot(x-u.x,y-u.y);if(d<hit&&d<bd){best=u;bd=d;}}return best;};
const v27ClosestAttackTargetV28=closestAttackTarget;
closestAttackTarget=function(...args){const all=state.units;state.units=all.filter(u=>!u.transportedIn);try{return v27ClosestAttackTargetV28(...args);}finally{state.units=all;}};
const v27SaboteurDetectedV28=saboteurDetected;
saboteurDetected=function(e){const all=state.units;state.units=all.filter(u=>!u.transportedIn);try{return v27SaboteurDetectedV28(e);}finally{state.units=all;}};
const v27DrawOffscreenV28=drawOffscreenUnitIndicators;
drawOffscreenUnitIndicators=function(){const all=state.units;state.units=all.filter(u=>!u.transportedIn);try{return v27DrawOffscreenV28();}finally{state.units=all;}};
const v27CancelPositionV28=updateCancelButtonPosition;
updateCancelButtonPosition=function(){if(state.selectedUnit?.transportedIn){els.cancelUnit.classList.remove('visible');return;}return v27CancelPositionV28();};

// During the inherited combat pass, APCs masquerade as Trucks: Medics therefore
// do not heal them, while Engineers/Repair Vehicles correctly treat them as machines.
// Their light MG is then resolved explicitly afterward.
const v27UpdateUnitCombatV28=updateUnitCombat;
updateUnitCombat=function(dt){
 const all=state.units,transported=all.filter(u=>u.transportedIn),active=all.filter(u=>!u.transportedIn),apcs=active.filter(u=>unitRole(u)==='apc');
 state.units=active;for(const u of apcs)u.type='truck';
 try{v27UpdateUnitCombatV28(dt);}finally{for(const u of apcs)u.type='soldier';state.units=all;}
 for(const u of apcs){if(u.hp<=0)continue;u.cooldowns[0]=(u.cooldowns[0]||0)-dt;if(u.cooldowns[0]>0)continue;const t=findTarget(u.x,u.y,CONFIG.APC.RANGE);if(!t)continue;shoot(u.x,u.y,t,'apc',CONFIG.APC.DAMAGE,CONFIG.APC.BULLET_SPEED,.025);u.cooldowns[0]=CONFIG.APC.FIRE_INTERVAL;}
};

// APC destruction ejects its passenger with 30% HP loss instead of silently deleting it.
const v27CleanupDestroyedV28=cleanupDestroyed;
cleanupDestroyed=function(){for(const apc of state.units.filter(u=>unitRole(u)==='apc'&&u.hp<=0))unloadAPC(apc,.30);v27CleanupDestroyedV28();};

// -----------------------------------------------------------------------------
// PLATOON / APC DRAWING
// -----------------------------------------------------------------------------
const v27DrawUnitV28=drawUnit;
drawUnit=function(u){
 if(u.transportedIn)return;const r=unitRole(u);if(r!=='platoon'&&r!=='apc')return v27DrawUnitV28(u);
 ctx.save();ctx.translate(u.x,u.y);drawUnitPathV25(u);
 if(r==='platoon'){
  ctx.fillStyle='rgba(26,48,58,.9)';ctx.beginPath();ctx.arc(0,0,32,0,Math.PI*2);ctx.fill();
  const centers=[[0,-14],[-15,10],[15,10]];for(let s=0;s<3;s++){const c=centers[s];ctx.strokeStyle='#7896a7';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(c[0],c[1],10,0,Math.PI*2);ctx.stroke();for(let i=0;i<5;i++){const a=i/5*Math.PI*2;ctx.fillStyle='#cbd6dc';ctx.beginPath();ctx.arc(c[0]+Math.cos(a)*6,c[1]+Math.sin(a)*6,2.2,0,Math.PI*2);ctx.fill();}}
 }else{
  ctx.rotate(u.heading||0);ctx.fillStyle='#3e5260';ctx.fillRect(-25,-15,50,30);ctx.fillStyle='#6f8796';ctx.fillRect(-12,-18,23,36);ctx.fillStyle='#1c272d';for(const x of [-26,20]){ctx.fillRect(x,-18,6,11);ctx.fillRect(x,7,6,11);}ctx.fillStyle='#9fc4d6';ctx.fillRect(4,-4,23,8);ctx.rotate(-(u.heading||0));ctx.fillStyle='#d9eef6';ctx.font='bold 9px Arial';ctx.textAlign='center';ctx.fillText(apcPassenger(u)?'1/1 LOADED':'EMPTY',0,-24);
 }
 drawUnitHudV25(u,r==='platoon'?39:35);ctx.restore();
};

// -----------------------------------------------------------------------------
// GUIDE / HINT
// -----------------------------------------------------------------------------
function guideBoxByTitle(title){for(const box of document.querySelectorAll('#guidePanel .guide-box'))if(box.querySelector('b')?.textContent===title)return box;return null;}
const pauseGuide=guideBoxByTitle('Pause & Planning');if(pauseGuide)pauseGuide.querySelector('p').textContent='A new run enters the battlefield already PAUSED. Pausing freezes simulation only—the battlefield remains fully bright and unobstructed so you can inspect, move units and queue construction before resuming.';
const mobileGuide=guideBoxByTitle('Mobile / Landscape');if(mobileGuide)mobileGuide.querySelector('p').textContent='Landscape is the recommended phone orientation. Drag to pan, tap units/Towers to select them, and use ☰ MENU for persistent controls. Base HP, Gold, Metal and Workers stay visible even while the Command Menu is closed.';
const infantryGuide=guideBoxByTitle('Infantry & Support');if(infantryGuide)infantryGuide.querySelector('p').textContent+=' Rifle Platoons combine fifteen riflemen into one larger formation for simpler frontline control.';
const vehicleGuide=guideBoxByTitle('Vehicles & Aircraft');if(vehicleGuide)vehicleGuide.querySelector('p').textContent+=' APCs are fast armored infantry carriers with a light machine gun and capacity for one squad or Platoon.';
const guideGridV28=document.querySelector('#guidePanel .guide-grid');if(guideGridV28&&!guideBoxByTitle('Platoons & APCs')){const box=document.createElement('div');box.className='guide-box';box.innerHTML='<b>Platoons & APCs</b><p>Rifle Platoons are larger fifteen-soldier formations. APCs carry one eligible infantry squad or Platoon: select an APC, move infantry within 105px, then use LOAD INFANTRY in ☰ MENU. Select the APC later and use UNLOAD. Passengers cannot fight or be targeted while inside; if the APC is destroyed they are ejected with 30% HP loss.</p>';guideGridV28.appendChild(box);}
const hintV28=document.getElementById('hint');if(hintV28)hintV28.textContent='Resources stay visible at all times · new runs begin paused · APCs load one nearby infantry squad or Platoon · landscape recommended on phones.';

updateHud();
