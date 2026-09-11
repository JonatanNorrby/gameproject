// Alien Planet Defense v25
// Remaining mobile/support backlog: Engineer, Scout, Sniper, Flamethrower
// Trooper, Combat Drone, Combat Ship, Mech, Sneaky Spotter, Mine Layer, Bunker.

const dropMineBtn=document.getElementById('dropMineBtn');
const garrisonBtn=document.getElementById('garrisonBtn');
const ungarrisonBtn=document.getElementById('ungarrisonBtn');

BUILD.engineer={kind:'unit',cost:CONFIG.ENGINEER.COST,currency:'gold',label:'Engineer Squad',radius:22};
BUILD.scout={kind:'unit',cost:CONFIG.SCOUT.COST,currency:'gold',label:'Scout Squad',radius:21};
BUILD.sniper={kind:'unit',cost:CONFIG.SNIPER.COST,currency:'gold',label:'Sniper Squad',radius:21};
BUILD.flametrooper={kind:'unit',cost:CONFIG.FLAME_TROOPER.COST,currency:'gold',label:'Flamethrower Troopers',radius:22};
BUILD.spotter={kind:'unit',cost:CONFIG.SPOTTER.COST,currency:'gold',label:'Sneaky Spotter Squad',radius:21};
BUILD.minelayer={kind:'unit',cost:CONFIG.MINE_LAYER.COST,currency:'gold',label:'Mine Layer Squad',radius:23};
BUILD.mech={kind:'unit',cost:CONFIG.MECH.COST,currency:'gold',label:'Combat Mech',radius:29};
BUILD.combatdrone={kind:'unit',cost:CONFIG.COMBAT_DRONE.COST,currency:'gold',label:'Combat Drone',radius:16};
BUILD.combatship={kind:'unit',cost:CONFIG.COMBAT_SHIP.COST,currency:'gold',label:'Combat Ship',radius:27};
BUILD.bunker={kind:'structure',cost:CONFIG.BUNKER.COST,currency:'gold',label:'Bunker',radius:CONFIG.BUNKER.RADIUS,buildTime:CONFIG.BUILD_TIME.BUNKER};

const V25_GROUND_ROLES=new Set(['engineer','scout','sniper','flametrooper','spotter','minelayer','mech']);
const V25_AIR_ROLES=new Set(['combatdrone','combatship']);
const V25_GARRISON_ROLES=new Set(['rifleman','heavygunner','rocketeer','medic','engineer','scout','sniper','flametrooper','spotter']);
const V25_ESCORT_ROLES=new Set(['rifleman','heavygunner','rocketeer','medic','engineer','scout','sniper','flametrooper','spotter','minelayer']);

state.playerMines=[];state.v25Effects=[];

function isFlyingUnit(u){return !!u&&u.type==='airunit';}
function isV25Role(r){return V25_GROUND_ROLES.has(r)||V25_AIR_ROLES.has(r);}

const v24UnitDisplayNameV25=unitDisplayName;
unitDisplayName=function(u){
 const r=u.role||unitRole(u);
 if(r==='engineer')return 'Engineer Squad';if(r==='scout')return 'Scout Squad';if(r==='sniper')return 'Sniper Squad';
 if(r==='flametrooper')return 'Flamethrower Troopers';if(r==='spotter')return 'Sneaky Spotter Squad';if(r==='minelayer')return 'Mine Layer Squad';
 if(r==='mech')return 'Combat Mech';if(r==='combatdrone')return 'Combat Drone';if(r==='combatship')return 'Combat Ship';
 return v24UnitDisplayNameV25(u);
};

const v24RoleConfigV25=roleConfig;
roleConfig=function(u){
 const r=u.role||unitRole(u);
 if(r==='engineer')return CONFIG.ENGINEER;if(r==='scout')return CONFIG.SCOUT;if(r==='sniper')return CONFIG.SNIPER;
 if(r==='flametrooper')return CONFIG.FLAME_TROOPER;if(r==='spotter')return CONFIG.SPOTTER;if(r==='minelayer')return CONFIG.MINE_LAYER;
 if(r==='mech')return CONFIG.MECH;if(r==='combatdrone')return CONFIG.COMBAT_DRONE;if(r==='combatship')return CONFIG.COMBAT_SHIP;
 return v24RoleConfigV25(u);
};

const v24URadiusV25=uRadius;
uRadius=function(u){if(isFlyingUnit(u))return u.role==='combatship'?26:15;if(unitRole(u)==='mech')return 28;return v24URadiusV25(u);};
const v24StructureRadiusV25=structureRadius;
structureRadius=function(s){if(s?.type==='bunker')return CONFIG.BUNKER.RADIUS;return v24StructureRadiusV25(s);};
const v24StructureOrUnitRadiusV25=structureOrUnitRadius;
structureOrUnitRadius=function(t){if(t?.type==='airunit')return t.role==='combatship'?26:15;if(t?.type==='soldier'&&unitRole(t)==='mech')return 28;return v24StructureOrUnitRadiusV25(t);};

function makeGroundUnit(role,x,y){
 const cfg=roleConfig({type:'soldier',role}),members=cfg.MEMBERS||cfg.BARRELS||1;
 return{id:'u'+Date.now()+Math.random(),type:'soldier',role,x,y,hp:cfg.HP,maxHp:cfg.HP,moveTarget:null,path:[],heading:0,attachedTo:null,attachSlot:0,garrisonedIn:null,cooldowns:Array(members).fill(0).map(()=>Math.random()*.35),repairFxCooldown:0};
}
function makeAirUnit(role,x,y){
 const cfg=roleConfig({type:'airunit',role});
 return{id:'u'+Date.now()+Math.random(),type:'airunit',role,x,y,hp:cfg.HP,maxHp:cfg.HP,moveTarget:null,path:[],heading:0,cooldowns:[Math.random()*.3],garrisonedIn:null};
}

// -----------------------------------------------------------------------------
// Placement
// -----------------------------------------------------------------------------
const v24PlaceBuildV25=placeBuild;
placeBuild=function(x,y){
 if(V25_GROUND_ROLES.has(buildType)){
  const def=BUILD[buildType];if(!isWorldInside(x,y,def.radius)||navPointBlocked(x,y,def.radius)){els.message.textContent='Unit deployment point is blocked.';return;}
  if(!payResource('gold',def.cost)){els.message.textContent=`Need ${def.cost} gold.`;return;}
  state.units.push(makeGroundUnit(buildType,x,y));els.message.textContent=`${def.label} deployed.`;updateHud();return;
 }
 if(V25_AIR_ROLES.has(buildType)){
  const def=BUILD[buildType];if(!isWorldInside(x,y,def.radius)||Math.hypot(x-BASE_X,y-BASE_Y)<BASE_RADIUS+def.radius){els.message.textContent='Air unit deployment point is blocked.';return;}
  if(buildType==='combatship'){
   if(state.units.some(u=>u.role==='combatship'&&u.hp>0)){els.message.textContent='Only one Combat Ship can be active at a time.';return;}
   const pad=state.structures.find(s=>s.type==='landingpad'&&s.built&&Math.hypot(x-s.x,y-s.y)<=190);if(!pad){els.message.textContent='Combat Ships must deploy within 190px of a built Landing Pad.';return;}
  }
  if(!payResource('gold',def.cost)){els.message.textContent=`Need ${def.cost} gold.`;return;}
  state.units.push(makeAirUnit(buildType,x,y));els.message.textContent=`${def.label} deployed.`;updateHud();return;
 }
 if(buildType==='bunker'){
  const def=BUILD.bunker;if(freeWorkers()<=0){els.message.textContent=`All ${CONFIG.WORKERS.COUNT} workers are busy.`;return;}
  if(placementBlocked(x,y,def.radius,'bunker')){els.message.textContent='That Bunker location is blocked.';return;}
  if(!payResource('gold',def.cost)){els.message.textContent=`Need ${def.cost} gold.`;return;}
  state.structures.push({id:'b'+Date.now()+Math.random(),type:'bunker',x,y,hp:CONFIG.BUNKER.HP,maxHp:CONFIG.BUNKER.HP,built:false,buildTime:def.buildTime,buildRemaining:def.buildTime,cool:0,protected:false,safeSpotId:null,garrisonedUnitId:null});
  els.message.textContent=`Bunker construction started (${def.buildTime.toFixed(1)}s).`;updateHud();return;
 }
 return v24PlaceBuildV25(x,y);
};

// Flying units move directly, ignoring terrain, Walls and resource deposits.
const v24SetUnitDestinationV25=setUnitDestination;
setUnitDestination=function(u,x,y,opt={}){
 if(isFlyingUnit(u)){if(!isWorldInside(x,y,uRadius(u))){els.message.textContent='Destination is outside the map.';return false;}u.path=[{x,y}];u.moveTarget={x,y};return true;}
 return v24SetUnitDestinationV25(u,x,y,opt);
};

const v24HandleTapV25=handleTap;
handleTap=function(x,y){
 if(state.selectedUnit?.garrisonedIn){els.message.textContent='This squad is inside a Bunker. Use UNGARRISON in the Command Menu first.';return;}
 if(state.selectedUnit&&isFlyingUnit(state.selectedUnit)&&!(typeof wallModeActive==='function'&&wallModeActive())){
  const clicked=unitAt(x,y),tower=typeof towerAt==='function'?towerAt(x,y):null;if(!clicked&&!tower){setUnitDestination(state.selectedUnit,x,y);els.message.textContent='Air move order queued.';return;}
 }
 return v24HandleTapV25(x,y);
};

function unitSpeed(u){if(u.type==='truck')return CONFIG.TRUCK.MOVE_SPEED;if(isFlyingUnit(u))return roleConfig(u).MOVE_SPEED;return roleConfig(u).MOVE_SPEED||CONFIG.SOLDIER.MOVE_SPEED;}
updateUnitMovement=function(dt){
 for(const u of state.units){
  if(u.garrisonedIn){const b=state.structures.find(s=>s.id===u.garrisonedIn&&s.type==='bunker'&&s.built);if(b){u.x=b.x;u.y=b.y;u.path=[];u.moveTarget=null;continue;}u.garrisonedIn=null;}
  if(u.type==='soldier'&&u.attachedTo){const truck=state.units.find(t=>t.id===u.attachedTo&&t.type==='truck');if(!truck){u.attachedTo=null;continue;}const off=ATTACH_OFFSETS[u.attachSlot%ATTACH_OFFSETS.length],c=Math.cos(truck.heading||0),s=Math.sin(truck.heading||0);u.x=truck.x+off[0]*c-off[1]*s;u.y=truck.y+off[0]*s+off[1]*c;continue;}
  if(!u.path||!u.path.length)continue;const p=u.path[0],dx=p.x-u.x,dy=p.y-u.y,d=Math.hypot(dx,dy);if(d<5){u.x=p.x;u.y=p.y;u.path.shift();if(!u.path.length){u.moveTarget=null;if(u.type==='truck'&&u.routeActive)advanceTruckRoute(u);}continue;}
  const speed=unitSpeed(u)*state.mods.unitMove,step=Math.min(d,speed*dt);u.heading=Math.atan2(dy,dx);u.x+=dx/d*step;u.y+=dy/d*step;
 }
 for(const u of state.units){if(u.type!=='truck'||!u.routePendingStart||u.path?.length||!u.route?.length)continue;const p=u.route[0];if(Math.hypot(u.x-p.x,u.y-p.y)<=10){u.routePendingStart=false;u.routeLoop=true;u.routeActive=true;u.routeIndex=0;advanceTruckRoute(u);if(state.selectedUnit===u){state.selectedUnit=null;state.routeEditing=false;state.attachMode=false;}els.message.textContent='Truck reached loop start — repeating route started.';updateHud();}}
};

// -----------------------------------------------------------------------------
// Bunker / Mine Layer contextual actions
// -----------------------------------------------------------------------------
function nearbyEmptyBunker(u){let best=null,bd=CONFIG.BUNKER.GARRISON_RANGE;for(const b of state.structures){if(b.type!=='bunker'||!b.built||b.garrisonedUnitId)continue;const d=Math.hypot(u.x-b.x,u.y-b.y);if(d<bd){best=b;bd=d;}}return best;}
function currentBunker(u){return u?.garrisonedIn?state.structures.find(s=>s.id===u.garrisonedIn&&s.type==='bunker'):null;}
function canGarrison(u){return !!u&&u.type==='soldier'&&V25_GARRISON_ROLES.has(unitRole(u));}

const v24UpdateUnitActionsV25=updateUnitActions;
updateUnitActions=function(){
 v24UpdateUnitActionsV25();const u=state.selectedUnit,r=u?unitRole(u):null,escort=!!u&&u.type==='soldier'&&V25_ESCORT_ROLES.has(r)&&!u.garrisonedIn;
 els.attach.style.display=escort&&!u.attachedTo?'inline-flex':'none';els.detach.style.display=escort&&u.attachedTo?'inline-flex':'none';
 dropMineBtn.style.display=u&&r==='minelayer'&&!u.garrisonedIn?'inline-flex':'none';
 const bunker=currentBunker(u),eligible=canGarrison(u);garrisonBtn.style.display=eligible&&!bunker?'inline-flex':'none';garrisonBtn.disabled=eligible&&!bunker&&!nearbyEmptyBunker(u);
 ungarrisonBtn.style.display=bunker?'inline-flex':'none';
 const label=document.querySelector('#unitActions .unitActionLabel');if(label&&u)label.textContent=unitDisplayName(u).toUpperCase();else if(label)label.textContent='SELECTED UNIT';
};

dropMineBtn.onclick=()=>{
 const u=state.selectedUnit;if(!u||unitRole(u)!=='minelayer'||u.garrisonedIn)return;const owned=state.playerMines.filter(m=>m.ownerId===u.id);
 if(owned.length>=CONFIG.MINE_LAYER.MAX_MINES_PER_UNIT){els.message.textContent=`This Mine Layer already has ${CONFIG.MINE_LAYER.MAX_MINES_PER_UNIT} active mines.`;return;}
 if(state.playerMines.some(m=>Math.hypot(m.x-u.x,m.y-u.y)<34)){els.message.textContent='Another mine is too close.';return;}
 if(!payResource('gold',CONFIG.MINE_LAYER.MINE_GOLD_COST)){els.message.textContent=`Need ${CONFIG.MINE_LAYER.MINE_GOLD_COST} gold to deploy a mine.`;return;}
 state.playerMines.push({id:'pm'+Date.now()+Math.random(),ownerId:u.id,x:u.x,y:u.y});els.message.textContent=`Mine deployed for ${CONFIG.MINE_LAYER.MINE_GOLD_COST} gold (${owned.length+1}/${CONFIG.MINE_LAYER.MAX_MINES_PER_UNIT}).`;updateHud();
};
garrisonBtn.onclick=()=>{
 const u=state.selectedUnit;if(!canGarrison(u)||u.garrisonedIn)return;const b=nearbyEmptyBunker(u);if(!b){els.message.textContent='Move this squad within range of an empty Bunker first.';return;}
 if(u.attachedTo){u.attachedTo=null;u.attachSlot=0;}u.garrisonedIn=b.id;u.path=[];u.moveTarget=null;u.x=b.x;u.y=b.y;b.garrisonedUnitId=u.id;els.message.textContent=`${unitDisplayName(u)} garrisoned. Range +28%, damage +35%; enemies must destroy the Bunker first.`;updateHud();
};
ungarrisonBtn.onclick=()=>{
 const u=state.selectedUnit,b=currentBunker(u);if(!u||!b)return;b.garrisonedUnitId=null;u.garrisonedIn=null;let placed=false;
 for(let i=0;i<12;i++){const a=i/12*Math.PI*2,x=b.x+Math.cos(a)*(CONFIG.BUNKER.RADIUS+34),y=b.y+Math.sin(a)*(CONFIG.BUNKER.RADIUS+34);if(!navPointBlocked(x,y,uRadius(u))){u.x=x;u.y=y;placed=true;break;}}
 if(!placed){u.x=b.x+CONFIG.BUNKER.RADIUS+38;u.y=b.y;}els.message.textContent=`${unitDisplayName(u)} left the Bunker.`;updateHud();
};

// Sneaky Spotters and garrisoned squads are never valid enemy targets. Ground
// melee also cannot attack flying player units; Spitters can still shoot aircraft.
closestAttackTarget=function(e,maxRange,includeProtected){
 let best=null,bd=Infinity;for(const s of state.structures){if(!includeProtected&&s.protected)continue;const d=Math.hypot(e.x-s.x,e.y-s.y);if(d<maxRange&&d<bd){best=s;bd=d;}}
 for(const u of state.units){if(u.garrisonedIn||unitRole(u)==='spotter'||(!includeProtected&&isFlyingUnit(u)))continue;const d=Math.hypot(e.x-u.x,e.y-u.y);if(d<maxRange&&d<bd){best=u;bd=d;}}
 return best;
};

const v24SaboteurDetectedV25=saboteurDetected;
saboteurDetected=function(e){for(const u of state.units){const r=unitRole(u),range=r==='scout'?CONFIG.SCOUT.DETECT_RANGE:r==='spotter'?CONFIG.SPOTTER.SPOT_RANGE:0;if(range&&Math.hypot(e.x-u.x,e.y-u.y)<=range)return true;}return v24SaboteurDetectedV25(e);};

// -----------------------------------------------------------------------------
// Support and combat
// -----------------------------------------------------------------------------
const v24HitEnemyV25=hitEnemy;
hitEnemy=function(e,dmg){if((e.markTime||0)>0)dmg*=e.markMult||1;return v24HitEnemyV25(e,dmg);};
function markEnemy(e,mult,duration){e.markMult=Math.max(e.markMult||1,mult);e.markTime=Math.max(e.markTime||0,duration);}
function bunkerBuff(u){const b=currentBunker(u);return b&&b.built?{range:CONFIG.BUNKER.RANGE_MULTIPLIER,damage:CONFIG.BUNKER.DAMAGE_MULTIPLIER}:{range:1,damage:1};}
function v25Effect(fx){state.v25Effects.push(fx);}
function repairTargetFor(u){
 let best=null,ratio=1;const candidates=[...state.structures.filter(s=>s.built),...state.units.filter(v=>v!==u&&(v.type==='truck'||unitRole(v)==='mech'||isFlyingUnit(v)))];
 for(const t of candidates){if(!t.maxHp||t.hp>=t.maxHp||Math.hypot(t.x-u.x,t.y-u.y)>CONFIG.ENGINEER.REPAIR_RANGE)continue;const r=t.hp/t.maxHp;if(r<ratio){best=t;ratio=r;}}return best;
}
function updatePlayerMines(){
 for(let i=state.playerMines.length-1;i>=0;i--){const m=state.playerMines[i],trigger=state.enemies.find(e=>e.type!=='flyer'&&!e.burrowed&&Math.hypot(e.x-m.x,e.y-m.y)<=CONFIG.MINE_LAYER.MINE_TRIGGER_RADIUS+e.r);if(!trigger)continue;
  for(const e of [...state.enemies])if(e.type!=='flyer'&&!e.burrowed&&Math.hypot(e.x-m.x,e.y-m.y)<=CONFIG.MINE_LAYER.MINE_SPLASH_RADIUS)hitEnemy(e,CONFIG.MINE_LAYER.MINE_DAMAGE*(e===trigger?1:.72));
  v25Effect({kind:'mineblast',x:m.x,y:m.y,r:CONFIG.MINE_LAYER.MINE_SPLASH_RADIUS,expires:performance.now()+240});state.playerMines.splice(i,1);
 }
}

updateUnitCombat=function(dt){
 for(const e of state.enemies){if((e.markTime||0)>0){e.markTime=Math.max(0,e.markTime-dt);if(e.markTime<=0)e.markMult=1;}}
 for(const u of state.units){
  if(u.hp<=0||u.type==='truck')continue;const r=unitRole(u),cfg=roleConfig(u),buff=bunkerBuff(u),ox=u.x,oy=u.y;
  if(r==='engineer'){
   u.repairFxCooldown=Math.max(0,(u.repairFxCooldown||0)-dt);const t=repairTargetFor(u);if(t){t.hp=Math.min(t.maxHp,t.hp+CONFIG.ENGINEER.REPAIR_PER_SECOND*dt);if(u.repairFxCooldown<=0){v25Effect({kind:'repair',x1:ox,y1:oy,x2:t.x,y2:t.y,expires:performance.now()+160});u.repairFxCooldown=.3;}}continue;
  }
  if(r==='medic'){
   u.healFxCooldown=Math.max(0,(u.healFxCooldown||0)-dt);let target=null,best=1;for(const f of state.units){if(f===u||f.type==='truck'||isFlyingUnit(f)||!f.maxHp||f.hp>=f.maxHp)continue;const d=Math.hypot(f.x-ox,f.y-oy);if(d>cfg.HEAL_RANGE*buff.range)continue;const ratio=f.hp/f.maxHp;if(ratio<best){best=ratio;target=f;}}
   if(target){target.hp=Math.min(target.maxHp,target.hp+cfg.HEAL_PER_SECOND*dt);if(u.healFxCooldown<=0){fxPush({kind:'heal',x1:ox,y1:oy,x2:target.x,y2:target.y,expires:performance.now()+150});u.healFxCooldown=.28;}}continue;
  }
  if(r==='spotter'){
   for(const e of state.enemies)if(enemyTargetableFrom(e,ox,oy)&&Math.hypot(e.x-ox,e.y-oy)<=cfg.SPOT_RANGE*buff.range)markEnemy(e,cfg.MARK_DAMAGE_MULTIPLIER,cfg.MARK_REFRESH);continue;
  }
  if(r==='flametrooper'){
   u.cooldowns[0]=(u.cooldowns[0]||0)-dt;if(u.cooldowns[0]>0)continue;const targets=nearestTargetsWhere(ox,oy,cfg.RANGE*buff.range,()=>true,cfg.TARGETS);if(!targets.length)continue;
   for(const e of targets){hitEnemy(e,cfg.DIRECT_DAMAGE*buff.damage);if(e.hp>0){e.burn=Math.max(e.burn,cfg.BURN_DURATION);e.burnTick=Math.min(e.burnTick,.01);}v25Effect({kind:'trooperflame',x1:ox,y1:oy,x2:e.x,y2:e.y,expires:performance.now()+110});}u.cooldowns[0]=cfg.FIRE_INTERVAL;continue;
  }
  if(r==='combatship'){
   u.cooldowns[0]=(u.cooldowns[0]||0)-dt;if(u.cooldowns[0]>0)continue;const target=findTarget(ox,oy,cfg.RANGE);if(!target)continue;for(const e of [...state.enemies])if(Math.hypot(e.x-target.x,e.y-target.y)<=cfg.SPLASH_RADIUS)hitEnemy(e,cfg.DAMAGE*(e===target?1:.55));v25Effect({kind:'shipblast',x1:ox,y1:oy,x2:target.x,y2:target.y,r:cfg.SPLASH_RADIUS,expires:performance.now()+180});u.cooldowns[0]=cfg.FIRE_INTERVAL;continue;
  }
  if(r==='combatdrone'){
   u.cooldowns[0]=(u.cooldowns[0]||0)-dt;if(u.cooldowns[0]>0)continue;const target=findTarget(ox,oy,cfg.RANGE);if(!target)continue;shoot(ox,oy,target,'droneunit',cfg.DAMAGE,cfg.BULLET_SPEED,.02);u.cooldowns[0]=cfg.FIRE_INTERVAL;continue;
  }
  if(r==='mech'){
   while(u.cooldowns.length<cfg.BARRELS)u.cooldowns.push(Math.random()*.2);for(let i=0;i<cfg.BARRELS;i++){u.cooldowns[i]-=dt;if(u.cooldowns[i]>0)continue;const target=findTarget(ox,oy,cfg.RANGE);if(!target)continue;shoot(ox+(i?7:-7),oy,target,'mech',cfg.DAMAGE,cfg.BULLET_SPEED,.025);u.cooldowns[i]=cfg.FIRE_INTERVAL;}}continue;
  }
  if(r==='minelayer')continue;

  const members=cfg.MEMBERS||1;while(u.cooldowns.length<members)u.cooldowns.push(Math.random()*.2);if(u.cooldowns.length>members)u.cooldowns.length=members;
  for(let i=0;i<members;i++){
   u.cooldowns[i]-=dt;if(u.cooldowns[i]>0)continue;const range=(cfg.RANGE||CONFIG.SOLDIER.RANGE)*buff.range,target=findTarget(ox,oy,range);if(!target)continue;const off=SOLDIER_OFFSETS[i%SOLDIER_OFFSETS.length]||[0,0],damage=(cfg.DAMAGE||CONFIG.SOLDIER.DAMAGE)*buff.damage;
   if(r==='rocketeer'){for(const e of [...state.enemies])if(Math.hypot(e.x-target.x,e.y-target.y)<=cfg.SPLASH_RADIUS)hitEnemy(e,cfg.DAMAGE*buff.damage*(e===target?1:.65));fxPush({kind:'rocket',x1:ox+off[0],y1:oy+off[1],x2:target.x,y2:target.y,r:cfg.SPLASH_RADIUS,expires:performance.now()+190});}
   else{if(r==='scout')markEnemy(target,cfg.MARK_DAMAGE_MULTIPLIER,cfg.MARK_DURATION);shoot(ox+off[0],oy+off[1],target,r==='sniper'?'sniper':r==='heavygunner'?'heavy':'soldier',damage,cfg.BULLET_SPEED||CONFIG.SOLDIER.BULLET_SPEED,r==='sniper'?.005:.02);}
   u.cooldowns[i]=(cfg.FIRE_INTERVAL||CONFIG.SOLDIER.FIRE_INTERVAL)*(r==='rifleman'?state.mods.soldierRate:1)*(.94+Math.random()*.12);
  }
 }
 updatePlayerMines();
};

// Engineers accelerate one nearby construction group by 40% each, capped at +80%.
const v24UpdateConstructionV25=updateConstruction;
updateConstruction=function(dt){
 v24UpdateConstructionV25(dt);const groups=new Map();for(const s of state.structures)if(!s.built){const k=s.groupId||s.id;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(s);}
 const engineers=state.units.filter(u=>unitRole(u)==='engineer'&&u.hp>0&&!u.garrisonedIn);
 for(const items of groups.values()){
  let count=0;for(const u of engineers)if(items.some(s=>Math.hypot(u.x-s.x,u.y-s.y)<=CONFIG.ENGINEER.REPAIR_RANGE)){count++;if(count>=2)break;}if(!count)continue;
  const remaining=Math.max(0,items[0].buildRemaining-dt*CONFIG.ENGINEER.CONSTRUCTION_BONUS*count);for(const s of items)s.buildRemaining=remaining;if(remaining<=0){for(const s of items)s.built=true;els.message.textContent=`${BUILD[items[0].type]?.label||'Building'} construction completed with Engineer support.`;}
 }
};

// -----------------------------------------------------------------------------
// Cleanup / bunker destruction
// -----------------------------------------------------------------------------
const v24CleanupDestroyedV25=cleanupDestroyed;
cleanupDestroyed=function(){
 const deadBunkers=state.structures.filter(s=>s.type==='bunker'&&s.hp<=0);for(const b of deadBunkers){const u=state.units.find(x=>x.id===b.garrisonedUnitId);if(u){u.garrisonedIn=null;u.x=b.x+CONFIG.BUNKER.RADIUS+34;u.y=b.y;b.garrisonedUnitId=null;}}
 v24CleanupDestroyedV25();
};

// -----------------------------------------------------------------------------
// Drawing
// -----------------------------------------------------------------------------
function drawUnitPathV25(u){if(u.path&&u.path.length){ctx.setLineDash([8,6]);ctx.strokeStyle='rgba(96,225,255,.8)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,0);for(const p of u.path)ctx.lineTo(p.x-u.x,p.y-u.y);ctx.stroke();ctx.setLineDash([]);}}
function drawUnitHudV25(u,radius=29){if(state.selectedUnit===u){ctx.strokeStyle='#ffe47b';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,radius,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#f7eaa5';ctx.font='bold 9px Arial';ctx.textAlign='center';ctx.fillText(unitDisplayName(u).toUpperCase(),0,-radius-7);}if(u.hp<u.maxHp){ctx.fillStyle='#111';ctx.fillRect(-22,radius+4,44,4);ctx.fillStyle='#ef6666';ctx.fillRect(-22,radius+4,44*Math.max(0,u.hp/u.maxHp),4);}}
const v24DrawUnitV25=drawUnit;
drawUnit=function(u){
 if(u.garrisonedIn)return;const r=u.role||unitRole(u);if(!isV25Role(r))return v24DrawUnitV25(u);ctx.save();ctx.translate(u.x,u.y);drawUnitPathV25(u);
 if(r==='engineer'){ctx.fillStyle='#38444c';ctx.beginPath();ctx.arc(0,0,21,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#ffd25a';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-10,8);ctx.lineTo(10,-10);ctx.moveTo(-7,-10);ctx.lineTo(11,8);ctx.stroke();}
 else if(r==='scout'){ctx.fillStyle='#254a3e';ctx.beginPath();ctx.arc(0,0,19,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#80efb9';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,-16);ctx.lineTo(12,8);ctx.lineTo(-12,8);ctx.closePath();ctx.stroke();}
 else if(r==='sniper'){ctx.fillStyle='#27353a';ctx.beginPath();ctx.arc(0,0,19,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#d9e8de';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-13,8);ctx.lineTo(17,-13);ctx.stroke();ctx.fillStyle='#8fbc9c';ctx.beginPath();ctx.arc(-4,1,5,0,Math.PI*2);ctx.fill();}
 else if(r==='flametrooper'){ctx.fillStyle='#493126';ctx.beginPath();ctx.arc(0,0,21,0,Math.PI*2);ctx.fill();ctx.fillStyle='#ff9b42';ctx.fillRect(-5,-18,10,25);ctx.fillStyle='#ffcf69';ctx.beginPath();ctx.arc(0,-20,5,0,Math.PI*2);ctx.fill();}
 else if(r==='spotter'){ctx.fillStyle='rgba(35,78,80,.58)';ctx.beginPath();ctx.arc(0,0,19,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#7de7e9';ctx.setLineDash([4,4]);ctx.beginPath();ctx.arc(0,0,17,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#aef9f5';ctx.beginPath();ctx.arc(0,0,4,0,Math.PI*2);ctx.fill();}
 else if(r==='minelayer'){ctx.fillStyle='#484334';ctx.beginPath();ctx.arc(0,0,22,0,Math.PI*2);ctx.fill();ctx.fillStyle='#d6b863';ctx.beginPath();ctx.arc(0,0,8,0,Math.PI*2);ctx.fill();for(let i=0;i<6;i++){const a=i/6*Math.PI*2;ctx.strokeStyle='#e7d590';ctx.beginPath();ctx.moveTo(Math.cos(a)*7,Math.sin(a)*7);ctx.lineTo(Math.cos(a)*14,Math.sin(a)*14);ctx.stroke();}}
 else if(r==='mech'){ctx.rotate(u.heading||0);ctx.fillStyle='#3b4d5c';ctx.fillRect(-22,-18,44,36);ctx.fillStyle='#7290a4';ctx.fillRect(-14,-21,28,20);ctx.strokeStyle='#c2dae8';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-8,-13);ctx.lineTo(27,-13);ctx.moveTo(-8,8);ctx.lineTo(27,8);ctx.stroke();ctx.rotate(-(u.heading||0));}
 else if(r==='combatdrone'){ctx.rotate(u.heading||0);ctx.fillStyle='#83d7f0';ctx.beginPath();ctx.moveTo(14,0);ctx.lineTo(0,-8);ctx.lineTo(-14,0);ctx.lineTo(0,8);ctx.closePath();ctx.fill();ctx.fillStyle='#263d49';ctx.beginPath();ctx.arc(0,0,4,0,Math.PI*2);ctx.fill();ctx.rotate(-(u.heading||0));}
 else{ctx.rotate(u.heading||0);ctx.fillStyle='#536f80';ctx.beginPath();ctx.moveTo(28,0);ctx.lineTo(7,-17);ctx.lineTo(-24,-11);ctx.lineTo(-14,0);ctx.lineTo(-24,11);ctx.lineTo(7,17);ctx.closePath();ctx.fill();ctx.fillStyle='#9fe8ff';ctx.fillRect(-2,-5,13,10);ctx.rotate(-(u.heading||0));}
 drawUnitHudV25(u,r==='mech'?34:r==='combatship'?34:28);ctx.restore();
};

const v24DrawStructureV25=drawStructure;
drawStructure=function(s){
 if(s.type!=='bunker')return v24DrawStructureV25(s);if(!s.built){drawConstruction(s);return;}ctx.save();ctx.translate(s.x,s.y);ctx.fillStyle='#27313a';ctx.beginPath();ctx.arc(0,0,CONFIG.BUNKER.RADIUS,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#8996a0';ctx.lineWidth=5;ctx.stroke();ctx.fillStyle='#111a20';ctx.fillRect(-20,-11,40,22);ctx.strokeStyle='#657681';ctx.lineWidth=3;ctx.strokeRect(-20,-11,40,22);ctx.fillStyle='#dce7ec';ctx.font='bold 9px Arial';ctx.textAlign='center';ctx.fillText(s.garrisonedUnitId?'GARRISONED':'EMPTY',0,3);if((s.acidTime||0)>0){ctx.strokeStyle='#9bff46';ctx.lineWidth=3;ctx.setLineDash([5,4]);ctx.beginPath();ctx.arc(0,0,CONFIG.BUNKER.RADIUS+7,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);}if(s.hp<s.maxHp){ctx.fillStyle='#111';ctx.fillRect(-28,43,56,5);ctx.fillStyle='#ef6666';ctx.fillRect(-28,43,56*Math.max(0,s.hp/s.maxHp),5);}ctx.restore();
};

const v24DrawEnemyV25=drawEnemy;
drawEnemy=function(e){v24DrawEnemyV25(e);if((e.markTime||0)<=0||e.burrowed)return;ctx.save();ctx.translate(e.x,e.y);ctx.strokeStyle='#79ecff';ctx.lineWidth=2;ctx.setLineDash([4,3]);ctx.beginPath();ctx.arc(0,0,e.r+8,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.restore();};

const v24DrawV25=draw;
draw=function(){
 v24DrawV25();const now=performance.now();ctx.save();ctx.translate(-state.camera.x,-state.camera.y);
 for(const m of state.playerMines){ctx.fillStyle='#71653b';ctx.beginPath();ctx.arc(m.x,m.y,7,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#d8c474';ctx.lineWidth=1.5;for(let i=0;i<6;i++){const a=i/6*Math.PI*2;ctx.beginPath();ctx.moveTo(m.x+Math.cos(a)*6,m.y+Math.sin(a)*6);ctx.lineTo(m.x+Math.cos(a)*11,m.y+Math.sin(a)*11);ctx.stroke();}}
 state.v25Effects=state.v25Effects.filter(f=>f.expires>now);for(const f of state.v25Effects){ctx.globalAlpha=Math.max(.15,(f.expires-now)/260);if(f.kind==='repair'){ctx.strokeStyle='#ffd65c';ctx.lineWidth=3;ctx.setLineDash([5,4]);ctx.beginPath();ctx.moveTo(f.x1,f.y1);ctx.lineTo(f.x2,f.y2);ctx.stroke();ctx.setLineDash([]);}else if(f.kind==='trooperflame'){ctx.strokeStyle='#ff8a3d';ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(f.x1,f.y1);ctx.lineTo(f.x2,f.y2);ctx.stroke();}else if(f.kind==='shipblast'){ctx.strokeStyle='#9fe8ff';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(f.x1,f.y1);ctx.lineTo(f.x2,f.y2);ctx.stroke();ctx.fillStyle='rgba(110,205,255,.22)';ctx.beginPath();ctx.arc(f.x2,f.y2,f.r,0,Math.PI*2);ctx.fill();}else{ctx.fillStyle='rgba(255,180,70,.27)';ctx.strokeStyle='#ffc061';ctx.lineWidth=3;ctx.beginPath();ctx.arc(f.x,f.y,f.r,0,Math.PI*2);ctx.fill();ctx.stroke();}}
 ctx.restore();ctx.globalAlpha=1;
};

// Restart integration.
const v24ResetV25=reset;
reset=function(){v24ResetV25();state.playerMines=[];state.v25Effects=[];};
els.restart.onclick=reset;
updateUnitActions();
