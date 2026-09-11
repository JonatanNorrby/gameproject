// Alien Planet Defense v29
// Platoons are now control groups made from existing movable units, not a unit type.
// Also adds the Machinegun Car light combat vehicle.
document.title='Alien Planet Defense v29';

// -----------------------------------------------------------------------------
// REMOVE THE v28 PURCHASED RIFLE PLATOON
// -----------------------------------------------------------------------------
document.querySelector('[data-type="platoon"]')?.remove();
delete BUILD.platoon;
V25_GROUND_ROLES.delete('platoon');
if(typeof APC_BOARDABLE!=='undefined')APC_BOARDABLE.delete('platoon');
state.units=state.units.filter(u=>unitRole(u)!=='platoon');

// -----------------------------------------------------------------------------
// MACHINEGUN CAR
// Fast and lightly armored. Its value is response speed rather than Tank durability.
// -----------------------------------------------------------------------------
CONFIG.MACHINEGUN_CAR={COST:125,MOVE_SPEED:215,HP:245,RANGE:215,FIRE_INTERVAL:0.16,DAMAGE:3.0,BULLET_SPEED:930,MEMBERS:1};
BUILD.mgcar={kind:'unit',cost:CONFIG.MACHINEGUN_CAR.COST,currency:'gold',label:'Machinegun Car',radius:24};
V25_GROUND_ROLES.add('mgcar');

const v28RoleConfigV29=roleConfig;
roleConfig=function(u){const r=u?.role||unitRole(u);if(r==='mgcar')return CONFIG.MACHINEGUN_CAR;return v28RoleConfigV29(u);};
const v28UnitDisplayNameV29=unitDisplayName;
unitDisplayName=function(u){const r=u?.role||unitRole(u);if(r==='mgcar')return 'Machinegun Car';return v28UnitDisplayNameV29(u);};
const v28URadiusV29=uRadius;
uRadius=function(u){return (u?.role||unitRole(u))==='mgcar'?24:v28URadiusV29(u);};
const v28StructureOrUnitRadiusV29=structureOrUnitRadius;
structureOrUnitRadius=function(t){return (t?.role||((t?.type==='soldier')?unitRole(t):null))==='mgcar'?24:v28StructureOrUnitRadiusV29(t);};

function v29BuildButton(type,label,cost){
 const b=document.createElement('button');b.className='buildBtn';b.dataset.type=type;b.innerHTML=`${label} <small>${cost} gold</small>`;
 b.onclick=()=>{
  state.selectedUnit=null;state.routeEditing=false;state.attachMode=false;state.platoonAttachMode=false;
  if(state.selectedTower){state.selectedTower=null;if(typeof updateTowerPanel==='function')updateTowerPanel();}
  if(typeof resetWallPath==='function')resetWallPath();
  buildType=type;els.message.textContent=`Build mode: ${BUILD[type].label}.`;updateHud();
  if(typeof closeCommandMenu==='function')setTimeout(closeCommandMenu,0);
 };
 return b;
}
const unitsMenuV29=document.getElementById('unitsMenu'),truckBtnV29=unitsMenuV29?.querySelector('[data-type="truck"]');
if(unitsMenuV29&&truckBtnV29)unitsMenuV29.insertBefore(v29BuildButton('mgcar','🚙 Machinegun Car',CONFIG.MACHINEGUN_CAR.COST),truckBtnV29);

// -----------------------------------------------------------------------------
// PLATOON CONTROL GROUPS
// -----------------------------------------------------------------------------
state.platoonAttachMode=false;
let platoonSerialV29=1;
function canUsePlatoon(u){return !!u&&state.units.includes(u)&&u.hp>0&&!u.garrisonedIn&&!u.transportedIn&&!u.attachedTo;}
function platoonMembers(ref){const id=typeof ref==='string'?ref:ref?.platoonId;if(!id)return[];return state.units.filter(u=>u.platoonId===id);}
function platoonIdFor(u){return u?.platoonId||null;}
function platoonLabel(id){const n=String(id||'').split('-').pop();return `P${n}`;}
function assignPlatoonSlots(id){platoonMembers(id).forEach((u,i)=>u.platoonSlot=i);}
function normalizePlatoon(id){if(!id)return;const members=platoonMembers(id);if(members.length<2){for(const u of members){u.platoonId=null;u.platoonSlot=0;}}else assignPlatoonSlots(id);}
function removeFromPlatoon(u){const id=u?.platoonId;if(!id)return;u.platoonId=null;u.platoonSlot=0;normalizePlatoon(id);}
function ensurePlatoon(u){if(u.platoonId)return u.platoonId;u.platoonId=`platoon-${platoonSerialV29++}`;u.platoonSlot=0;return u.platoonId;}
function mergeIntoPlatoon(leader,target){
 if(!canUsePlatoon(leader)||!canUsePlatoon(target)||leader===target)return false;
 const id=ensurePlatoon(leader),otherId=target.platoonId;
 if(otherId===id)return false;
 if(otherId){for(const m of platoonMembers(otherId)){m.platoonId=id;m.platoonSlot=0;}}
 else{target.platoonId=id;target.platoonSlot=0;}
 assignPlatoonSlots(id);return true;
}
function disbandPlatoon(id){for(const u of platoonMembers(id)){u.platoonId=null;u.platoonSlot=0;}}
function platoonBaseSpeed(id){const members=platoonMembers(id).filter(canUsePlatoon);if(!members.length)return 0;return Math.min(...members.map(u=>v28UnitSpeedV29(u)));}
function formationOffset(index,count){if(index===0)return{x:0,y:0};const ring=Math.ceil(Math.sqrt(index)),r=54*ring,a=index*2.399963229728653;return{x:Math.cos(a)*r,y:Math.sin(a)*r};}
function orderPlatoon(id,x,y){
 const members=platoonMembers(id).filter(canUsePlatoon);if(members.length<2){normalizePlatoon(id);return false;}
 assignPlatoonSlots(id);let ordered=0;
 for(let i=0;i<members.length;i++){
  const u=members[i],off=formationOffset(i,members.length),r=uRadius(u),tx=Math.max(r,Math.min(WORLD_W-r,x+off.x)),ty=Math.max(r,Math.min(WORLD_H-r,y+off.y));
  if(u.type==='truck'){u.routeLoop=false;u.routeActive=false;u.routePendingStart=false;}
  let ok=setUnitDestination(u,tx,ty);if(!ok&&Math.hypot(tx-x,ty-y)>1)ok=setUnitDestination(u,x,y);if(ok)ordered++;
 }
 const speed=Math.round(platoonBaseSpeed(id)*(state.mods.unitMove||1));
 els.message.textContent=`${platoonLabel(id)} move order: ${ordered}/${members.length} units · formation speed ${speed}.`;updateHud();return ordered>0;
}

// The inherited movement pass calls unitSpeed(), so returning the group's minimum
// here guarantees every platoon member moves at the slowest member's speed.
const v28UnitSpeedV29=unitSpeed;
unitSpeed=function(u){const own=v28UnitSpeedV29(u);if(!u?.platoonId)return own;const members=platoonMembers(u.platoonId).filter(canUsePlatoon);if(members.length<2)return own;return Math.min(...members.map(m=>v28UnitSpeedV29(m)));};

// Contextual platoon controls live beside the other selected-unit actions.
const platoonAddBtn=document.createElement('button'),platoonLeaveBtn=document.createElement('button'),platoonDisbandBtn=document.createElement('button');
platoonAddBtn.id='platoonAddBtn';platoonAddBtn.textContent='START PLATOON';platoonLeaveBtn.id='platoonLeaveBtn';platoonLeaveBtn.textContent='LEAVE PLATOON';platoonDisbandBtn.id='platoonDisbandBtn';platoonDisbandBtn.textContent='DISBAND PLATOON';
for(const b of [platoonAddBtn,platoonLeaveBtn,platoonDisbandBtn]){b.style.display='none';els.unitActions.appendChild(b);}
platoonAddBtn.onclick=()=>{
 const u=state.selectedUnit;if(!canUsePlatoon(u)){els.message.textContent='This unit cannot join a Platoon right now.';return;}
 state.platoonAttachMode=true;state.attachMode=false;state.routeEditing=false;
 els.message.textContent=`${u.platoonId?'Add to '+platoonLabel(u.platoonId):'Start Platoon'}: tap another movable unit on the battlefield.`;
 if(typeof closeCommandMenu==='function')closeCommandMenu();
};
platoonLeaveBtn.onclick=()=>{const u=state.selectedUnit,id=u?.platoonId;if(!id)return;removeFromPlatoon(u);state.platoonAttachMode=false;els.message.textContent=`${unitDisplayName(u)} left ${platoonLabel(id)}.`;updateHud();};
platoonDisbandBtn.onclick=()=>{const id=state.selectedUnit?.platoonId;if(!id)return;const n=platoonMembers(id).length;disbandPlatoon(id);state.platoonAttachMode=false;els.message.textContent=`${platoonLabel(id)} disbanded (${n} units released).`;updateHud();};

const v28UpdateUnitActionsV29=updateUnitActions;
updateUnitActions=function(){
 v28UpdateUnitActionsV29();const u=state.selectedUnit,id=u?.platoonId,members=id?platoonMembers(id):[];
 const eligible=canUsePlatoon(u);platoonAddBtn.style.display=eligible?'inline-flex':'none';platoonAddBtn.textContent=id?'ADD UNIT TO PLATOON':'START PLATOON';
 platoonLeaveBtn.style.display=id?'inline-flex':'none';platoonDisbandBtn.style.display=members.length>=2?'inline-flex':'none';
 const label=document.querySelector('#unitActions .unitActionLabel');if(label&&u&&id)label.textContent=`${platoonLabel(id)} · ${members.length} UNITS · SLOWEST ${Math.round(platoonBaseSpeed(id)*(state.mods.unitMove||1))}`;
};

// Selection/ordering layer. Tapping any member selects that member as the group's
// anchor; an empty-map order then fans the whole group into formation positions.
const v28HandleTapV29=handleTap;
handleTap=function(x,y){
 const clicked=unitAt(x,y);
 if(state.platoonAttachMode){
  const leader=state.selectedUnit;
  if(!leader||!canUsePlatoon(leader)){state.platoonAttachMode=false;els.message.textContent='Platoon creation cancelled.';return;}
  if(!clicked){els.message.textContent='Tap directly on another movable unit to add it.';return;}
  if(!canUsePlatoon(clicked)){els.message.textContent='That unit cannot join while transported, garrisoned or attached to a Truck.';return;}
  if(clicked===leader){els.message.textContent='Choose a different unit.';return;}
  const before=leader.platoonId;if(mergeIntoPlatoon(leader,clicked)){const id=leader.platoonId;state.platoonAttachMode=false;els.message.textContent=`${before?'Expanded':'Created'} ${platoonLabel(id)} — ${platoonMembers(id).length} units, speed capped by the slowest member.`;updateHud();return;}
  state.platoonAttachMode=false;els.message.textContent='Those units are already in the same Platoon.';return;
 }
 const selected=state.selectedUnit,id=selected?.platoonId,tower=typeof towerAt==='function'?towerAt(x,y):null;
 const special=state.attachMode||state.routeEditing||(typeof wallModeActive==='function'&&wallModeActive());
 if(id&&canUsePlatoon(selected)&&!clicked&&!tower&&!special){orderPlatoon(id,x,y);return;}
 v28HandleTapV29(x,y);
 const now=state.selectedUnit;if(clicked&&now===clicked&&clicked.platoonId){els.message.textContent=`${platoonLabel(clicked.platoonId)} selected — ${platoonMembers(clicked.platoonId).length} units move together at the slowest unit's speed.`;updateHud();}
};

// Existing single-unit attachment systems remove that unit from its control Platoon.
const v28AttachSoldierV29=attachSoldierToTruck;
attachSoldierToTruck=function(soldier,truck){removeFromPlatoon(soldier);return v28AttachSoldierV29(soldier,truck);};
if(typeof garrisonBtn!=='undefined'){
 const v28GarrisonClickV29=garrisonBtn.onclick;garrisonBtn.onclick=()=>{const u=state.selectedUnit;if(u&&u.platoonId&&nearbyEmptyBunker(u))removeFromPlatoon(u);return v28GarrisonClickV29();};
}
if(typeof apcLoadBtn!=='undefined'){
 const v28ApcLoadClickV29=apcLoadBtn.onclick;apcLoadBtn.onclick=()=>{const apc=state.selectedUnit;if(apc&&unitRole(apc)==='apc'&&!apcPassenger(apc)){const candidate=nearestBoardable(apc);if(candidate?.platoonId)removeFromPlatoon(candidate);}return v28ApcLoadClickV29();};
}

// -----------------------------------------------------------------------------
// MACHINEGUN CAR COMBAT
// -----------------------------------------------------------------------------
// Masquerade as a Truck through inherited support logic so Medics do not heal it,
// while Engineers and Repair Vehicles correctly recognize it as mechanical.
const v28UpdateUnitCombatV29=updateUnitCombat;
updateUnitCombat=function(dt){
 const cars=state.units.filter(u=>unitRole(u)==='mgcar'&&!u.transportedIn);for(const u of cars)u.type='truck';
 try{v28UpdateUnitCombatV29(dt);}finally{for(const u of cars)u.type='soldier';}
 for(const u of cars){if(u.hp<=0)continue;u.cooldowns[0]=(u.cooldowns[0]||0)-dt;if(u.cooldowns[0]>0)continue;const t=findTarget(u.x,u.y,CONFIG.MACHINEGUN_CAR.RANGE);if(!t)continue;shoot(u.x,u.y,t,'mgcar',CONFIG.MACHINEGUN_CAR.DAMAGE,CONFIG.MACHINEGUN_CAR.BULLET_SPEED,.045);u.cooldowns[0]=CONFIG.MACHINEGUN_CAR.FIRE_INTERVAL;}
};

// -----------------------------------------------------------------------------
// DRAWING / GROUP READABILITY
// -----------------------------------------------------------------------------
const v28DrawUnitV29=drawUnit;
drawUnit=function(u){
 if(u.transportedIn)return;
 const r=unitRole(u);
 if(r==='mgcar'){
  ctx.save();ctx.translate(u.x,u.y);drawUnitPathV25(u);ctx.rotate(u.heading||0);
  ctx.fillStyle='#354957';ctx.fillRect(-20,-11,40,22);ctx.fillStyle='#6b8798';ctx.fillRect(-10,-13,20,26);ctx.fillStyle='#161f24';for(const x of [-21,15]){ctx.fillRect(x,-14,6,8);ctx.fillRect(x,6,6,8);}
  ctx.fillStyle='#27343c';ctx.beginPath();ctx.arc(3,0,7,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#d7e1c1';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(7,0);ctx.lineTo(27,0);ctx.stroke();ctx.rotate(-(u.heading||0));drawUnitHudV25(u,30);ctx.restore();
 }else v28DrawUnitV29(u);
 const selectedId=state.selectedUnit?.platoonId;if(u.platoonId&&u.platoonId===selectedId&&!u.garrisonedIn&&!u.transportedIn){ctx.save();ctx.translate(u.x,u.y);ctx.strokeStyle='#77e9ff';ctx.lineWidth=2;ctx.setLineDash([5,4]);ctx.beginPath();ctx.arc(0,0,uRadius(u)+8,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#baf6ff';ctx.font='bold 8px Arial';ctx.textAlign='center';ctx.fillText(platoonLabel(u.platoonId),0,uRadius(u)+20);ctx.restore();}
};

// Clean group IDs after casualties. A one-unit group automatically dissolves.
const v28CleanupDestroyedV29=cleanupDestroyed;
cleanupDestroyed=function(){const ids=new Set(state.units.map(u=>u.platoonId).filter(Boolean));v28CleanupDestroyedV29();for(const id of ids)normalizePlatoon(id);};

// -----------------------------------------------------------------------------
// RESET / GUIDE
// -----------------------------------------------------------------------------
const v28ResetV29=reset;
reset=function(){v28ResetV29();state.platoonAttachMode=false;platoonSerialV29=1;for(const u of state.units){u.platoonId=null;u.platoonSlot=0;}updateHud();};
els.restart.onclick=reset;

if(typeof guideBoxByTitle==='function'){
 const infantry=guideBoxByTitle('Infantry & Support');if(infantry)infantry.querySelector('p').textContent='Riflemen, Heavy Gunners, Rocketeers and Flamethrower Troopers provide frontline damage. Medics heal infantry. Engineers repair and accelerate construction. Scouts detect/mark, Snipers provide extreme range, Spotters mark enemies while being ignored, and Mine Layers deploy paid anti-ground mines.';
 const vehicles=guideBoxByTitle('Vehicles & Aircraft');if(vehicles)vehicles.querySelector('p').textContent='Mechs and Tanks are durable line holders. Mobile Artillery provides long-range ground splash. Machinegun Cars are fast light-response vehicles with sustained fire. Repair Vehicles repair mechanical assets. APCs transport one infantry squad; Combat Drones and the limited Combat Ship provide air support.';
 const pbox=guideBoxByTitle('Platoons & APCs');if(pbox){pbox.querySelector('b').textContent='Platoons';pbox.querySelector('p').textContent='Platoons are control groups, not purchasable formations. Select any movable unit, choose START PLATOON / ADD UNIT TO PLATOON in ☰ MENU, then tap another unit. Selecting any member lets one map order control the whole group in a loose formation. The entire Platoon moves at the speed of its slowest member. Units can leave individually or the group can be disbanded.';}
}
const hintV29=document.getElementById('hint');if(hintV29)hintV29.textContent='Platoons group existing units for shared orders · every Platoon moves at its slowest member’s speed · Machinegun Cars provide fast mobile firepower.';

updateHud();
