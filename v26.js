// Alien Planet Defense v26
// Backlog batch: Tank, Mobile Artillery, Repair Vehicle, wide camera zoom,
// up to 3 mines per depot, Landing Pad warehouse caps and protectable ships.

document.title='Alien Planet Defense v26';

// -----------------------------------------------------------------------------
// TUNING ADDED BY THIS BACKLOG PASS
// -----------------------------------------------------------------------------
CONFIG.WORLD.MIN_ZOOM=0.42;
CONFIG.WORLD.MAX_ZOOM=1.35;
CONFIG.WORLD.ZOOM_STEP=0.10;
CONFIG.CRYSTALS.MAX_MINES_PER_DEPOT=3;
CONFIG.ORE.MAX_MINES_PER_DEPOT=3;
CONFIG.LANDING_PAD.WAREHOUSE_CAPACITY=520;
CONFIG.LANDING_PAD.SHIP_HP=260;
CONFIG.LANDING_PAD.SHIP_LOAD_RATE=34;
CONFIG.TANK={COST:260,MOVE_SPEED:92,HP:640,RANGE:255,FIRE_INTERVAL:0.82,DAMAGE:34,SPLASH_RADIUS:30,BULLET_SPEED:760};
CONFIG.MOBILE_ARTILLERY={COST:240,MOVE_SPEED:96,HP:285,RANGE:540,MIN_RANGE:125,FIRE_INTERVAL:2.45,DAMAGE:62,SPLASH_RADIUS:76};
CONFIG.REPAIR_VEHICLE={COST:155,MOVE_SPEED:138,HP:330,REPAIR_RANGE:150,REPAIR_PER_SECOND:34};

BUILD.tank={kind:'unit',cost:CONFIG.TANK.COST,currency:'gold',label:'Tank',radius:29};
BUILD.mobileartillery={kind:'unit',cost:CONFIG.MOBILE_ARTILLERY.COST,currency:'gold',label:'Mobile Artillery',radius:28};
BUILD.repairvehicle={kind:'unit',cost:CONFIG.REPAIR_VEHICLE.COST,currency:'gold',label:'Repair Vehicle',radius:27};
V25_GROUND_ROLES.add('tank');
V25_GROUND_ROLES.add('mobileartillery');
V25_GROUND_ROLES.add('repairvehicle');

const v25UnitDisplayNameV26=unitDisplayName;
unitDisplayName=function(u){
 const r=unitRole(u);
 if(r==='tank')return 'Tank';
 if(r==='mobileartillery')return 'Mobile Artillery';
 if(r==='repairvehicle')return 'Repair Vehicle';
 return v25UnitDisplayNameV26(u);
};
const v25RoleConfigV26=roleConfig;
roleConfig=function(u){
 const r=unitRole(u);
 if(r==='tank')return CONFIG.TANK;
 if(r==='mobileartillery')return CONFIG.MOBILE_ARTILLERY;
 if(r==='repairvehicle')return CONFIG.REPAIR_VEHICLE;
 return v25RoleConfigV26(u);
};
const v25URadiusV26=uRadius;
uRadius=function(u){const r=unitRole(u);if(r==='tank')return 29;if(r==='mobileartillery')return 28;if(r==='repairvehicle')return 27;return v25URadiusV26(u);};
const v25StructureOrUnitRadiusV26=structureOrUnitRadius;
structureOrUnitRadius=function(t){const r=t&&t.type==='soldier'?unitRole(t):null;if(r==='tank')return 29;if(r==='mobileartillery')return 28;if(r==='repairvehicle')return 27;return v25StructureOrUnitRadiusV26(t);};

// -----------------------------------------------------------------------------
// DYNAMIC COMMAND-MENU / GUIDE ADDITIONS
// -----------------------------------------------------------------------------
function makeBuildButton(type,label,price){
 const b=document.createElement('button');b.className='buildBtn';b.dataset.type=type;b.innerHTML=`${label} <small>${price} gold</small>`;
 b.onclick=()=>{state.selectedUnit=null;state.routeEditing=false;state.attachMode=false;buildType=type;els.message.textContent=`Build mode: ${BUILD[type].label}.`;updateHud();if(typeof closeCommandMenu==='function')setTimeout(closeCommandMenu,0);};
 return b;
}
const unitsMenuV26=document.getElementById('unitsMenu'),truckBtnV26=unitsMenuV26?.querySelector('[data-type="truck"]');
if(unitsMenuV26&&truckBtnV26){
 unitsMenuV26.insertBefore(makeBuildButton('tank','▣ Tank',CONFIG.TANK.COST),truckBtnV26);
 unitsMenuV26.insertBefore(makeBuildButton('mobileartillery','◉ Mobile Artillery',CONFIG.MOBILE_ARTILLERY.COST),truckBtnV26);
 unitsMenuV26.insertBefore(makeBuildButton('repairvehicle','🔧 Repair Vehicle',CONFIG.REPAIR_VEHICLE.COST),truckBtnV26);
}
const utilityV26=document.getElementById('utilityBar');
const zoomOutBtn=document.createElement('button'),zoomInBtn=document.createElement('button'),zoomLabel=document.createElement('span');
zoomOutBtn.id='zoomOutBtn';zoomOutBtn.textContent='− ZOOM OUT';zoomInBtn.id='zoomInBtn';zoomInBtn.textContent='+ ZOOM IN';zoomLabel.id='zoomLabel';zoomLabel.style.cssText='display:inline-flex;align-items:center;justify-content:center;min-width:62px;padding:0 8px;font-weight:900;color:#dff7ff';
if(utilityV26){utilityV26.insertBefore(zoomOutBtn,utilityV26.firstChild);utilityV26.insertBefore(zoomLabel,utilityV26.children[1]||null);utilityV26.insertBefore(zoomInBtn,utilityV26.children[2]||null);}
const guideGridV26=document.querySelector('#guidePanel .guide-grid');
if(guideGridV26){
 const entries=[
  ['Vehicles','Tanks are durable direct-fire line holders. Mobile Artillery brings long-range splash but cannot fire at nearby targets. Repair Vehicles rapidly repair structures, Trucks, Mechs, Tanks, Artillery and aircraft.'],
  ['Camera Zoom','Use ZOOM IN / ZOOM OUT in the Command Menu or the mouse wheel over the battlefield. The widest zoom shows almost the full battlefield, which is useful for logistics and incoming-enemy overview.'],
  ['Resource Depots','Each Crystal or Ore Depot supports up to 3 Mines directly on the deposit. More Mines increase extraction speed but deplete the same finite resource pool faster.'],
  ['Landing Pad Warehouse','Landing Pads store up to 520 crystal. A landed export ship loads from that warehouse over time and has its own HP. Enemies attracted by the landing damage the ship first; if it is destroyed, its loaded cargo is lost and the 2-minute cooldown restarts.']
 ];
 for(const [title,text] of entries){const d=document.createElement('div');d.className='guide-box';d.innerHTML=`<b>${title}</b><p>${text}</p>`;guideGridV26.appendChild(d);}
}

// -----------------------------------------------------------------------------
// THREE MINES PER DEPOT
// -----------------------------------------------------------------------------
function maxMinesForDepot(d){return d.resourceType==='ore'?CONFIG.ORE.MAX_MINES_PER_DEPOT:CONFIG.CRYSTALS.MAX_MINES_PER_DEPOT;}
function currentDepotMines(d){return state.structures.filter(s=>(s.type==='mine'||s.type==='oremine')&&s.depotId===d.id&&s.hp>0);}
function normalizeDepotMineLinks(){for(const d of state.depots){const mines=currentDepotMines(d);d.mineIds=mines.map(s=>s.id);d.mineId=mines[0]?.id||null;}}
findResourceDepotAt=function(x,y,type){
 let best=null,bd=Infinity;for(const d of state.depots){if(d.resourceType!==type)continue;if(currentDepotMines(d).length>=maxMinesForDepot(d))continue;const dist=Math.hypot(x-d.x,y-d.y);if(dist<=d.r+30&&dist<bd){best=d;bd=dist;}}return best;
};
findMineDepotForPlacement=function(x,y){return findResourceDepotAt(x,y,'crystal');};
const v25PlacementBlockedV26=placementBlocked;
placementBlocked=function(x,y,r,type,ignoreId=null){
 if(type==='mine'||type==='oremine'){
  const resource=type==='mine'?'crystal':'ore',d=findResourceDepotAt(x,y,resource);if(!d)return true;
  if(!isWorldInside(d.x,d.y,12)||pointBlockedByTerrain(d.x,d.y,8))return true;
  for(const s of state.structures){if(s.id===ignoreId)continue;if((s.type==='mine'||s.type==='oremine')&&s.depotId===d.id)continue;if(s.type==='wall'){if(pointSegmentDistance(d.x,d.y,s.x1,s.y1,s.x2,s.y2)<24+wallThickness(s)/2)return true;}else if(Math.hypot(d.x-s.x,d.y-s.y)<24+structureRadius(s))return true;}
  return false;
 }
 return v25PlacementBlockedV26(x,y,r,type,ignoreId);
};
function mineSlotPosition(d,slot){const offsets=[[0,-12],[-15,10],[15,10]],o=offsets[slot]||[0,0];return{x:d.x+o[0],y:d.y+o[1]};}
const v25PlaceBuildV26=placeBuild;
placeBuild=function(x,y){
 if(buildType==='mine'||buildType==='oremine'){
  const def=BUILD[buildType],resource=buildType==='mine'?'crystal':'ore',d=findResourceDepotAt(x,y,resource);if(!d){els.message.textContent=`This ${resource} depot already has 3 Mines, or no matching depot is under the cursor.`;return;}
  if(freeWorkers()<=0){els.message.textContent=`All ${CONFIG.WORKERS.COUNT} workers are busy.`;return;}
  if(placementBlocked(x,y,def.radius,buildType)){els.message.textContent='That resource depot is blocked.';return;}
  if(!payResource('gold',def.cost)){els.message.textContent=`Need ${def.cost} gold.`;return;}
  const slot=currentDepotMines(d).length,p=mineSlotPosition(d,slot),hp=buildType==='mine'?CONFIG.CRYSTALS.MINE_HP:CONFIG.ORE.MINE_HP;
  const s={id:'s'+Date.now()+Math.random(),type:buildType,x:p.x,y:p.y,hp,maxHp:hp,built:false,buildTime:def.buildTime,buildRemaining:def.buildTime,cool:0,protected:false,safeSpotId:null,stored:0,depotId:d.id,mineSlot:slot};
  state.structures.push(s);normalizeDepotMineLinks();els.message.textContent=`${def.label} ${slot+1}/3 construction started on this depot.`;updateHud();return;
 }
 return v25PlaceBuildV26(x,y);
};
const v25CleanupDestroyedV26=cleanupDestroyed;
cleanupDestroyed=function(){v25CleanupDestroyedV26();normalizeDepotMineLinks();};
const v25DrawDepotV26=drawDepot;
drawDepot=function(d){v25DrawDepotV26(d);ctx.save();ctx.translate(d.x,d.y);ctx.fillStyle=d.resourceType==='crystal'?'#e8d0ff':'#f1d1b2';ctx.font='bold 9px Arial';ctx.textAlign='center';ctx.fillText(`MINES ${currentDepotMines(d).length}/${maxMinesForDepot(d)}`,0,d.r+31);ctx.restore();};

// -----------------------------------------------------------------------------
// LANDING PAD WAREHOUSE + PROTECTABLE SHIP
// -----------------------------------------------------------------------------
function initPadV26(s){if(s.type!=='landingpad')return;if(s.crystalStored===undefined)s.crystalStored=0;if(!s.shipState)s.shipState='cooldown';if(s.shipCooldown===undefined)s.shipCooldown=CONFIG.LANDING_PAD.INITIAL_COOLDOWN;if(s.shipCargo===undefined)s.shipCargo=0;if(s.shipHp===undefined)s.shipHp=0;if(s.shipMaxHp===undefined)s.shipMaxHp=CONFIG.LANDING_PAD.SHIP_HP;}
updateTruckEconomy=function(){
 for(const u of state.units){
  if(u.type!=='truck')continue;const cap=Math.round(CONFIG.TRUCK.CAPACITY*state.mods.truckCapacity);
  if(u.cargo<cap){let mine=null,bd=CONFIG.TRUCK.PICKUP_RANGE;for(const s of state.structures){if((s.type!=='mine'&&s.type!=='oremine')||!s.built||s.stored<=0)continue;const type=s.type==='oremine'?'ore':'crystal';if(u.cargoType&&u.cargoType!==type)continue;const d=Math.hypot(u.x-s.x,u.y-s.y);if(d<bd){mine=s;bd=d;}}if(mine){const type=mine.type==='oremine'?'ore':'crystal',take=Math.min(cap-u.cargo,mine.stored);u.cargoType=type;u.cargo+=take;mine.stored-=take;}}
  if(u.cargo<=0){u.cargo=0;u.cargoType=null;continue;}
  if(u.cargoType==='crystal'){
   const pad=nearestStructure(u,'landingpad',CONFIG.LANDING_PAD.TRUCK_UNLOAD_RANGE);if(pad){initPadV26(pad);const room=Math.max(0,CONFIG.LANDING_PAD.WAREHOUSE_CAPACITY-pad.crystalStored),take=Math.min(room,u.cargo);if(take>0){pad.crystalStored+=take;u.cargo-=take;els.message.textContent=`Truck deposited ${Math.floor(take)} crystal (${Math.floor(pad.crystalStored)}/${CONFIG.LANDING_PAD.WAREHOUSE_CAPACITY} stored).`;if(u.cargo<=.001){u.cargo=0;u.cargoType=null;}}}
  }else if(u.cargoType==='ore'){
   const r=nearestStructure(u,'refinery',CONFIG.REFINERY.UNLOAD_RANGE);if(r){const room=Math.max(0,CONFIG.REFINERY.ORE_CAPACITY-r.oreStored),take=Math.min(room,u.cargo);if(take>0){r.oreStored+=take;u.cargo-=take;if(u.cargo<=.001){u.cargo=0;u.cargoType=null;}}}
  }
 }
};
updateLandingPads=function(dt){
 for(const s of state.structures){if(s.type!=='landingpad'||!s.built)continue;initPadV26(s);if(s.landingFlash>0)s.landingFlash=Math.max(0,s.landingFlash-dt);
  if(s.shipState==='landed'&&s.shipHp<=0){s.shipState='cooldown';s.shipCooldown=CONFIG.LANDING_PAD.COOLDOWN;s.shipCargo=0;s.shipHp=0;els.message.textContent='Export ship destroyed — loaded crystal was lost. Landing Pad cooldown restarted.';continue;}
  if(s.shipState==='cooldown'){s.shipCooldown=Math.max(0,s.shipCooldown-dt);if(s.shipCooldown<=0){s.shipState='landed';s.shipCargo=0;s.shipMaxHp=CONFIG.LANDING_PAD.SHIP_HP;s.shipHp=s.shipMaxHp;attractEnemiesToPad(s);}}
  if(s.shipState==='landed'){
   const room=CONFIG.LANDING_PAD.SHIP_CAPACITY-s.shipCargo,take=Math.min(room,s.crystalStored,CONFIG.LANDING_PAD.SHIP_LOAD_RATE*dt);if(take>0){s.crystalStored-=take;s.shipCargo+=take;}
   if(s.shipCargo>=CONFIG.LANDING_PAD.SHIP_CAPACITY-.001){const sold=CONFIG.LANDING_PAD.SHIP_CAPACITY,gold=Math.round(sold*CONFIG.CRYSTALS.GOLD_PER_CRYSTAL);if(!state.debug.unlimitedCash)state.credits+=gold;s.shipCargo=0;s.shipHp=0;s.shipState='cooldown';s.shipCooldown=CONFIG.LANDING_PAD.COOLDOWN;els.message.textContent=`Export ship launched full: ${sold} crystal sold for ${gold} gold.`;}
  }
 }
};
updateMines=function(dt){updateResourceMines(dt);updateRefineries(dt);updateLandingPads(dt);};
const v25DamageTargetV26=damageTarget;
damageTarget=function(t,amount){
 if(t?.type==='landingpad'&&t.built){initPadV26(t);if(t.shipState==='landed'&&t.shipHp>0){const mult=(t.acidTime||0)>0?CONFIG.ACID_LOBBER.ARMOR_DAMAGE_MULTIPLIER:1;t.shipHp-=amount*mult;return;}}
 return v25DamageTargetV26(t,amount);
};
const v25DrawStructureV26=drawStructure;
drawStructure=function(s){v25DrawStructureV26(s);if(s.type!=='landingpad'||!s.built)return;initPadV26(s);ctx.save();ctx.translate(s.x,s.y);ctx.fillStyle='#dce9ef';ctx.font='bold 9px Arial';ctx.textAlign='center';ctx.fillText(`WAREHOUSE ${Math.floor(s.crystalStored)}/${CONFIG.LANDING_PAD.WAREHOUSE_CAPACITY}`,0,CONFIG.LANDING_PAD.RADIUS+40);if(s.shipState==='landed'){ctx.fillStyle='#111';ctx.fillRect(-31,-61,62,5);ctx.fillStyle='#75dff2';ctx.fillRect(-31,-61,62*Math.max(0,s.shipHp/s.shipMaxHp),5);ctx.fillStyle='#dff8ff';ctx.fillText(`SHIP HP ${Math.ceil(Math.max(0,s.shipHp))}`,0,-66);}ctx.restore();};

// -----------------------------------------------------------------------------
// TANK / MOBILE ARTILLERY / REPAIR VEHICLE
// -----------------------------------------------------------------------------
function repairVehicleTarget(u){let best=null,ratio=1,bd=CONFIG.REPAIR_VEHICLE.REPAIR_RANGE;const candidates=[...state.structures.filter(s=>s.built),...state.units.filter(v=>v!==u&&(v.type==='truck'||isFlyingUnit(v)||['mech','tank','mobileartillery','repairvehicle'].includes(unitRole(v))))];for(const t of candidates){if(!t.maxHp||t.hp>=t.maxHp)continue;const d=Math.hypot(t.x-u.x,t.y-u.y),r=t.hp/t.maxHp;if(d<=bd&&(r<ratio-.001||(!best&&r<1))){best=t;ratio=r;bd=d;}}return best;}
function v26Fx(f){if(!state.v26Effects)state.v26Effects=[];state.v26Effects.push(f);}
const v25UpdateUnitCombatV26=updateUnitCombat;
updateUnitCombat=function(dt){
 const special=state.units.filter(u=>['tank','mobileartillery','repairvehicle'].includes(unitRole(u))),all=state.units;state.units=all.filter(u=>!special.includes(u));v25UpdateUnitCombatV26(dt);state.units=all;
 for(const u of special){if(u.hp<=0)continue;const r=unitRole(u),cfg=roleConfig(u);u.cooldowns[0]=(u.cooldowns[0]||0)-dt;
  if(r==='repairvehicle'){u.repairFxCooldown=Math.max(0,(u.repairFxCooldown||0)-dt);const t=repairVehicleTarget(u);if(t){t.hp=Math.min(t.maxHp,t.hp+cfg.REPAIR_PER_SECOND*dt);if(u.repairFxCooldown<=0){v26Fx({kind:'repairvehicle',x1:u.x,y1:u.y,x2:t.x,y2:t.y,expires:performance.now()+170});u.repairFxCooldown=.28;}}continue;}
  if(u.cooldowns[0]>0)continue;
  if(r==='tank'){const target=findTarget(u.x,u.y,cfg.RANGE);if(!target)continue;for(const e of [...state.enemies])if(enemyTargetableFrom(e,u.x,u.y)&&Math.hypot(e.x-target.x,e.y-target.y)<=cfg.SPLASH_RADIUS)hitEnemy(e,cfg.DAMAGE*(e===target?1:.32));v26Fx({kind:'tankshot',x1:u.x,y1:u.y,x2:target.x,y2:target.y,r:cfg.SPLASH_RADIUS,expires:performance.now()+155});u.cooldowns[0]=cfg.FIRE_INTERVAL;}
  else{const target=findTargetWhere(u.x,u.y,cfg.RANGE,e=>e.type!=='flyer',cfg.MIN_RANGE);if(!target)continue;for(const e of [...state.enemies])if(e.type!=='flyer'&&Math.hypot(e.x-target.x,e.y-target.y)<=cfg.SPLASH_RADIUS)hitEnemy(e,cfg.DAMAGE*(e===target?1:.62));v26Fx({kind:'artillery',x1:u.x,y1:u.y,x2:target.x,y2:target.y,r:cfg.SPLASH_RADIUS,expires:performance.now()+240});u.cooldowns[0]=cfg.FIRE_INTERVAL;}
 }
};
const v25DrawUnitV26=drawUnit;
drawUnit=function(u){const r=unitRole(u);if(!['tank','mobileartillery','repairvehicle'].includes(r))return v25DrawUnitV26(u);ctx.save();ctx.translate(u.x,u.y);drawUnitPathV25(u);ctx.rotate(u.heading||0);
 if(r==='tank'){ctx.fillStyle='#46533f';ctx.fillRect(-22,-15,44,30);ctx.fillStyle='#222923';ctx.fillRect(-25,-18,8,36);ctx.fillRect(17,-18,8,36);ctx.fillStyle='#738168';ctx.beginPath();ctx.arc(0,0,12,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#b7c49f';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(4,0);ctx.lineTo(31,0);ctx.stroke();}
 else if(r==='mobileartillery'){ctx.fillStyle='#4a4d43';ctx.fillRect(-23,-14,46,28);ctx.fillStyle='#222';ctx.fillRect(-25,-17,8,34);ctx.fillRect(17,-17,8,34);ctx.fillStyle='#747868';ctx.fillRect(-10,-11,20,22);ctx.strokeStyle='#d5c48f';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(0,-4);ctx.lineTo(29,-18);ctx.stroke();}
 else{ctx.fillStyle='#36505a';ctx.fillRect(-21,-13,42,26);ctx.fillStyle='#17252b';ctx.fillRect(-23,-16,7,32);ctx.fillRect(16,-16,7,32);ctx.fillStyle='#78d7df';ctx.fillRect(-7,-8,14,16);ctx.strokeStyle='#ffd45b';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(7,0);ctx.lineTo(25,0);ctx.stroke();}
 ctx.rotate(-(u.heading||0));drawUnitHudV25(u,r==='tank'?35:32);ctx.restore();};

// -----------------------------------------------------------------------------
// WIDE CAMERA ZOOM
// -----------------------------------------------------------------------------
function zoomValue(){return Math.max(CONFIG.WORLD.MIN_ZOOM,Math.min(CONFIG.WORLD.MAX_ZOOM,state.camera?.zoom||1));}
function updateZoomLabel(){if(zoomLabel)zoomLabel.textContent=`${Math.round(zoomValue()*100)}%`;if(zoomOutBtn)zoomOutBtn.disabled=zoomValue()<=CONFIG.WORLD.MIN_ZOOM+.001;if(zoomInBtn)zoomInBtn.disabled=zoomValue()>=CONFIG.WORLD.MAX_ZOOM-.001;}
clampCamera=function(){const z=zoomValue(),vw=W/z,vh=H/z;state.camera.x=Math.max(0,Math.min(Math.max(0,WORLD_W-vw),state.camera.x));state.camera.y=Math.max(0,Math.min(Math.max(0,WORLD_H-vh),state.camera.y));};
function setZoom(z,sx=W/2,sy=H/2){const old=zoomValue(),next=Math.max(CONFIG.WORLD.MIN_ZOOM,Math.min(CONFIG.WORLD.MAX_ZOOM,z)),wx=state.camera.x+sx/old,wy=state.camera.y+sy/old;state.camera.zoom=next;state.camera.x=wx-sx/next;state.camera.y=wy-sy/next;clampCamera();updateZoomLabel();}
zoomOutBtn.onclick=()=>setZoom(zoomValue()-CONFIG.WORLD.ZOOM_STEP);
zoomInBtn.onclick=()=>setZoom(zoomValue()+CONFIG.WORLD.ZOOM_STEP);
els.center.onclick=()=>{const z=zoomValue();state.camera.x=BASE_X-W/(2*z);state.camera.y=BASE_Y-H/(2*z);clampCamera();};
worldFromEvent=function(e){const rect=canvas.getBoundingClientRect(),cssW=canvas.clientWidth||rect.width,cssH=canvas.clientHeight||rect.height,localX=e.clientX-rect.left-(canvas.clientLeft||0),localY=e.clientY-rect.top-(canvas.clientTop||0),sx=localX*(W/cssW),sy=localY*(H/cssH),z=zoomValue();return{x:sx/z+state.camera.x,y:sy/z+state.camera.y,sx,sy};};
canvas.addEventListener('wheel',e=>{if(typeof commandMenuOpen==='function'&&commandMenuOpen())return;e.preventDefault();const rect=canvas.getBoundingClientRect(),sx=(e.clientX-rect.left)*W/rect.width,sy=(e.clientY-rect.top)*H/rect.height;setZoom(zoomValue()+(e.deltaY<0?CONFIG.WORLD.ZOOM_STEP:-CONFIG.WORLD.ZOOM_STEP),sx,sy);},{passive:false});
let v26PanLast=null;
canvas.addEventListener('pointerdown',e=>{v26PanLast={id:e.pointerId,x:e.clientX,y:e.clientY};});
canvas.addEventListener('pointermove',e=>{if(!v26PanLast||v26PanLast.id!==e.pointerId||!pointer||pointer.type!=='touch'||!pointer.drag)return;const dx=e.clientX-v26PanLast.x,dy=e.clientY-v26PanLast.y;v26PanLast.x=e.clientX;v26PanLast.y=e.clientY;const z=zoomValue();if(Math.abs(z-1)<.001)return;const rect=canvas.getBoundingClientRect(),extra=(1/z-1);state.camera.x-=dx*W/rect.width*extra;state.camera.y-=dy*H/rect.height*extra;clampCamera();});
canvas.addEventListener('pointerup',()=>v26PanLast=null);canvas.addEventListener('pointercancel',()=>v26PanLast=null);

// Screen-space helpers used while the world itself is scaled.
drawOffscreenUnitIndicators=function(){if(state.v19Options?.unitArrows===false)return;const z=zoomValue();ctx.save();ctx.setTransform(1,0,0,1,0,0);for(const u of state.units){if(u.garrisonedIn)continue;const sx=(u.x-state.camera.x)*z,sy=(u.y-state.camera.y)*z;if(sx>=0&&sx<=W&&sy>=0&&sy<=H)continue;const dx=sx-W/2,dy=sy-H/2,p=edgePoint(dx,dy,28),a=Math.atan2(dy,dx);ctx.save();ctx.translate(p.x,p.y);ctx.rotate(a);ctx.fillStyle=state.selectedUnit===u?'#ffe47b':u.type==='truck'?'#d2a8ff':isFlyingUnit(u)?'#9fe8ff':'#7fe6ff';ctx.beginPath();ctx.moveTo(12,0);ctx.lineTo(-7,-7);ctx.lineTo(-7,7);ctx.closePath();ctx.fill();ctx.restore();}ctx.restore();};
drawIncomingEnemyArrows=function(){if(state.v19Options?.enemyArrows===false)return;const z=zoomValue(),sectors=Array.from({length:12},()=>({count:0,dx:0,dy:0,dist:Infinity}));ctx.save();ctx.setTransform(1,0,0,1,0,0);for(const e of state.enemies){const sx=(e.x-state.camera.x)*z,sy=(e.y-state.camera.y)*z;if(sx>=0&&sx<=W&&sy>=0&&sy<=H)continue;const dx=sx-W/2,dy=sy-H/2,a=Math.atan2(dy,dx),idx=(Math.floor(((a+Math.PI)/(Math.PI*2))*12)+12)%12,d=Math.hypot(dx,dy),sec=sectors[idx];sec.count++;if(d<sec.dist){sec.dist=d;sec.dx=dx;sec.dy=dy;}}for(const sec of sectors){if(!sec.count)continue;const p=edgePoint(sec.dx,sec.dy,36),a=Math.atan2(sec.dy,sec.dx);ctx.save();ctx.translate(p.x,p.y);ctx.rotate(a);ctx.fillStyle='#ff4f55';ctx.strokeStyle='#450b0d';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(16,0);ctx.lineTo(-8,-9);ctx.lineTo(-4,0);ctx.lineTo(-8,9);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();ctx.fillStyle='#fff';ctx.font='bold 11px Arial';ctx.textAlign='center';ctx.fillText(sec.count,p.x,p.y+4);}ctx.restore();};
updateCancelButtonPosition=function(){const u=state.selectedUnit;if(!u||u.garrisonedIn){els.cancelUnit.classList.remove('visible');return;}const z=zoomValue(),sx=(u.x-state.camera.x)*z,sy=(u.y-state.camera.y)*z;if(sx<0||sy<0||sx>W||sy>H){els.cancelUnit.classList.remove('visible');return;}const r=canvas.getBoundingClientRect(),shell=document.getElementById('canvasShell').getBoundingClientRect(),cssX=(r.left-shell.left)+sx*r.width/W,cssY=(r.top-shell.top)+sy*r.height/H;els.cancelUnit.style.left=`${cssX+26}px`;els.cancelUnit.style.top=`${cssY-30}px`;els.cancelUnit.classList.add('visible');};

const v25DrawV26=draw;
draw=function(){
 const z=zoomValue();ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,W,H);ctx.restore();
 if(Math.abs(z-1)<.001){v25DrawV26();return;}
 const wasPaused=state.paused,wasGameOver=state.gameOver,dc=state.debug.unlimitedCash,dl=state.debug.unlimitedLives;
 state.paused=false;state.gameOver=false;state.debug.unlimitedCash=false;state.debug.unlimitedLives=false;
 ctx.save();ctx.scale(z,z);v25DrawV26();ctx.restore();
 state.paused=wasPaused;state.gameOver=wasGameOver;state.debug.unlimitedCash=dc;state.debug.unlimitedLives=dl;
 ctx.save();ctx.setTransform(1,0,0,1,0,0);
 if(dc||dl){ctx.fillStyle='#7fe6ff';ctx.font='bold 13px Arial';ctx.textAlign='left';ctx.fillText(`DEBUG ${dc?'∞ CASH ':''}${dl?'∞ LIVES':''}`,14,H-14);}
 if(wasPaused&&!wasGameOver){ctx.fillStyle='rgba(0,0,0,.36)';ctx.fillRect(0,0,W,H);ctx.fillStyle='#ffe36b';ctx.font='bold 48px Arial';ctx.textAlign='center';ctx.fillText('PAUSED',W/2,80);ctx.font='16px Arial';ctx.fillText('Orders and building placements can still be queued',W/2,108);}
 if(wasGameOver){ctx.fillStyle='rgba(0,0,0,.65)';ctx.fillRect(0,0,W,H);ctx.fillStyle='#fff';ctx.font='bold 42px Arial';ctx.textAlign='center';ctx.fillText('BASE LOST',W/2,H/2);ctx.font='20px Arial';ctx.fillText('Press RESTART to begin a new run',W/2,H/2+38);}
 ctx.restore();
};

// -----------------------------------------------------------------------------
// EXTRA DRAWING FOR V26 COMBAT EFFECTS
// -----------------------------------------------------------------------------
const v26WorldDraw=draw;
draw=function(){v26WorldDraw();if(!state.v26Effects?.length)return;const now=performance.now(),z=zoomValue();state.v26Effects=state.v26Effects.filter(f=>f.expires>now);ctx.save();ctx.scale(z,z);ctx.translate(-state.camera.x,-state.camera.y);for(const f of state.v26Effects){ctx.globalAlpha=Math.max(.15,(f.expires-now)/260);if(f.kind==='repairvehicle'){ctx.strokeStyle='#ffd55f';ctx.lineWidth=4;ctx.setLineDash([6,4]);ctx.beginPath();ctx.moveTo(f.x1,f.y1);ctx.lineTo(f.x2,f.y2);ctx.stroke();ctx.setLineDash([]);}else{ctx.strokeStyle=f.kind==='artillery'?'#f0bf72':'#c8d7a3';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(f.x1,f.y1);ctx.lineTo(f.x2,f.y2);ctx.stroke();ctx.fillStyle=f.kind==='artillery'?'rgba(240,150,70,.24)':'rgba(190,205,130,.18)';ctx.beginPath();ctx.arc(f.x2,f.y2,f.r,0,Math.PI*2);ctx.fill();ctx.stroke();}}ctx.restore();ctx.globalAlpha=1;};

// -----------------------------------------------------------------------------
// RESET INTEGRATION
// -----------------------------------------------------------------------------
const v25ResetV26=reset;
reset=function(){v25ResetV26();state.camera.zoom=1;state.v26Effects=[];normalizeDepotMineLinks();for(const s of state.structures)if(s.type==='landingpad')initPadV26(s);updateZoomLabel();};
els.restart.onclick=reset;
reset();
