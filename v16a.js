// Alien Planet Defense v16 patch
// Removes XP/cards, adds gold+metal logistics, shaped terrain, ore/refining,
// resource-depot mines, and crystal export landing pads.

const metalEl=document.getElementById('metal');

// -----------------------------------------------------------------------------
// BUILD REGISTRY / ECONOMY
// -----------------------------------------------------------------------------
BUILD.soldier.cost=CONFIG.SOLDIER.COST;BUILD.soldier.currency='gold';BUILD.soldier.label='Fire Squad';
BUILD.truck.cost=CONFIG.TRUCK.COST;BUILD.truck.currency='gold';BUILD.truck.label='Logistics Truck';
BUILD.laser.cost=CONFIG.LASER.COST;BUILD.laser.currency='metal';
BUILD.flame.cost=CONFIG.FLAME.COST;BUILD.flame.currency='metal';
BUILD.wall.currency='metal';BUILD.wall.label='Wall';
BUILD.safespot.cost=CONFIG.SAFE_SPOT.COST;BUILD.safespot.currency='gold';
BUILD.mine={kind:'structure',cost:CONFIG.CRYSTALS.MINE_COST,currency:'gold',label:'Crystal Mine',radius:CONFIG.CRYSTALS.DEPOT_RADIUS,buildTime:CONFIG.BUILD_TIME.MINE};
BUILD.oremine={kind:'structure',cost:CONFIG.ORE.MINE_COST,currency:'gold',label:'Ore Mine',radius:CONFIG.ORE.DEPOT_RADIUS,buildTime:CONFIG.BUILD_TIME.ORE_MINE};
BUILD.refinery={kind:'structure',cost:CONFIG.REFINERY.COST,currency:'gold',label:'Refinery',radius:38,buildTime:CONFIG.BUILD_TIME.REFINERY};
BUILD.landingpad={kind:'structure',cost:CONFIG.LANDING_PAD.COST,currency:'gold',label:'Landing Pad',radius:CONFIG.LANDING_PAD.RADIUS,buildTime:CONFIG.BUILD_TIME.LANDING_PAD};

function resourceAmount(currency){return currency==='metal'?(state.metal||0):state.credits;}
function payResource(currency,cost){
 if(currency==='gold'&&state.debug.unlimitedCash)return true;
 if(resourceAmount(currency)<cost)return false;
 if(currency==='metal')state.metal-=cost;else state.credits-=cost;
 return true;
}
function refundResource(currency,cost){
 if(currency==='gold'&&state.debug.unlimitedCash)return;
 if(currency==='metal')state.metal+=cost;else state.credits+=cost;
}

// -----------------------------------------------------------------------------
// NO XP / NO ROGUELITE CARDS
// -----------------------------------------------------------------------------
gainXp=function(){};
showCards=function(){state.choosing=false;els.overlay.classList.add('hidden');};
function enemyGoldReward(e){
 const c=e.type==='swarm'?CONFIG.SWARM:e.type==='runner'?CONFIG.RUNNER:e.type==='brute'?CONFIG.BRUTE:CONFIG.RANGED_ALIEN;
 return c.GOLD_REWARD||1;
}
hitEnemy=function(e,dmg){
 e.hp-=dmg;
 if(e.hp>0)return;
 const i=state.enemies.indexOf(e);if(i>=0)state.enemies.splice(i,1);
 if(!state.debug.unlimitedCash)state.credits+=enemyGoldReward(e);
 for(let k=0;k<(e.type==='brute'?9:4);k++)state.particles.push({x:e.x,y:e.y,vx:(Math.random()-.5)*100,vy:(Math.random()-.5)*100,life:.45});
};

// -----------------------------------------------------------------------------
// SHAPED TERRAIN: forests, hills, lakes.
// -----------------------------------------------------------------------------
function pointInPoly(x,y,pts){
 let inside=false;
 for(let i=0,j=pts.length-1;i<pts.length;j=i++){
  const a=pts[i],b=pts[j];
  const hit=((a.y>y)!==(b.y>y))&&(x<(b.x-a.x)*(y-a.y)/(b.y-a.y||1e-9)+a.x);
  if(hit)inside=!inside;
 }
 return inside;
}
function polyDistance(x,y,pts){
 if(pointInPoly(x,y,pts))return 0;
 let best=Infinity;
 for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length];best=Math.min(best,pointSegmentDistance(x,y,a.x,a.y,b.x,b.y));}
 return best;
}
function makeBlob(kind,x,y,rx,ry){
 const n=kind==='lake'?16:kind==='forest'?14:12,pts=[];
 for(let i=0;i<n;i++){
  const a=i/n*Math.PI*2,j=.78+Math.random()*.34;
  pts.push({x:x+Math.cos(a)*rx*j,y:y+Math.sin(a)*ry*j});
 }
 const f={kind,x,y,rx,ry,r:Math.max(rx,ry),points:pts,decor:[]};
 if(kind==='forest'){
  let tries=0;while(f.decor.length<18&&tries++<180){const px=x+(Math.random()*2-1)*rx*.88,py=y+(Math.random()*2-1)*ry*.88;if(pointInPoly(px,py,pts))f.decor.push({x:px,y:py,s:7+Math.random()*7});}
 }
 return f;
}
generateTerrain=function(){
 const out=[];let tries=0;
 while(out.length<CONFIG.TERRAIN.FEATURE_COUNT&&tries++<2000){
  const rx=CONFIG.TERRAIN.MIN_RX+Math.random()*(CONFIG.TERRAIN.MAX_RX-CONFIG.TERRAIN.MIN_RX);
  const ry=CONFIG.TERRAIN.MIN_RY+Math.random()*(CONFIG.TERRAIN.MAX_RY-CONFIG.TERRAIN.MIN_RY);
  const x=rx+70+Math.random()*(WORLD_W-rx*2-140),y=ry+70+Math.random()*(WORLD_H-ry*2-140);
  const bound=Math.max(rx,ry);
  if(Math.hypot(x-BASE_X,y-BASE_Y)<BASE_RADIUS+CONFIG.WORLD.BASE_TERRAIN_CLEARANCE+bound*.25)continue;
  if(out.some(o=>Math.hypot(x-o.x,y-o.y)<bound+o.r+CONFIG.TERRAIN.FEATURE_SEPARATION))continue;
  const roll=Math.random(),kind=roll<.40?'forest':roll<.70?'hill':'lake';
  out.push(makeBlob(kind,x,y,rx,ry));
 }
 return out;
};
pointBlockedByTerrain=function(x,y,extra=0){return state.terrain.some(o=>polyDistance(x,y,o.points)<=extra+CONFIG.TERRAIN.BUILD_CLEARANCE);};

function terrainSegmentBlocked(a,b,pad){
 for(const o of state.terrain){
  if(pointInPoly(a.x,a.y,o.points)||pointInPoly(b.x,b.y,o.points))return true;
  for(let i=0;i<o.points.length;i++){
   const p=o.points[i],q=o.points[(i+1)%o.points.length];
   if(segmentSegmentDistance(a.x,a.y,b.x,b.y,p.x,p.y,q.x,q.y)<=pad)return true;
  }
 }
 return false;
}
function orient(ax,ay,bx,by,cx,cy){return (bx-ax)*(cy-ay)-(by-ay)*(cx-ax);}
function segmentsCross(ax,ay,bx,by,cx,cy,dx,dy){
 const o1=orient(ax,ay,bx,by,cx,cy),o2=orient(ax,ay,bx,by,dx,dy),o3=orient(cx,cy,dx,dy,ax,ay),o4=orient(cx,cy,dx,dy,bx,by);
 return ((o1>0)!==(o2>0))&&((o3>0)!==(o4>0));
}
function segmentSegmentDistance(ax,ay,bx,by,cx,cy,dx,dy){
 if(segmentsCross(ax,ay,bx,by,cx,cy,dx,dy))return 0;
 return Math.min(pointSegmentDistance(ax,ay,cx,cy,dx,dy),pointSegmentDistance(bx,by,cx,cy,dx,dy),pointSegmentDistance(cx,cy,ax,ay,bx,by),pointSegmentDistance(dx,dy,ax,ay,bx,by));
}

// -----------------------------------------------------------------------------
// RESOURCE DEPOTS. Stock scales with distance from base.
// -----------------------------------------------------------------------------
function depotStock(type,x,y){
 const cfg=type==='ore'?CONFIG.ORE:CONFIG.CRYSTALS,d=Math.hypot(x-BASE_X,y-BASE_Y);
 return Math.round(cfg.NEAR_STOCK+d*cfg.STOCK_PER_PIXEL);
}
generateDepots=function(){
 const out=[];
 function addType(type,count,cfg){
  let tries=0,placed=0;
  while(placed<count&&tries++<2000){
   const x=100+Math.random()*(WORLD_W-200),y=100+Math.random()*(WORLD_H-200);
   if(Math.hypot(x-BASE_X,y-BASE_Y)<cfg.DEPOT_BASE_CLEARANCE)continue;
   if(pointBlockedByTerrain(x,y,cfg.DEPOT_RADIUS+6))continue;
   if(out.some(d=>Math.hypot(x-d.x,y-d.y)<Math.max(cfg.DEPOT_SEPARATION,220)))continue;
   out.push({id:type[0]+placed+'-'+Math.random(),resourceType:type,x,y,r:cfg.DEPOT_RADIUS,stock:depotStock(type,x,y),mineId:null});placed++;
  }
 }
 addType('crystal',CONFIG.CRYSTALS.DEPOT_COUNT,CONFIG.CRYSTALS);
 addType('ore',CONFIG.ORE.DEPOT_COUNT,CONFIG.ORE);
 return out;
};
function findResourceDepotAt(x,y,type){
 let best=null,bd=Infinity;
 for(const d of state.depots){
  if(d.resourceType!==type||d.mineId)continue;
  const dist=Math.hypot(x-d.x,y-d.y);
  if(dist<=d.r+28&&dist<bd){best=d;bd=dist;}
 }
 return best;
}
findMineDepotForPlacement=function(x,y){return findResourceDepotAt(x,y,'crystal');};

// -----------------------------------------------------------------------------
// COLLISION / PATHFINDING with shaped terrain and new buildings.
// -----------------------------------------------------------------------------
const v15StructureRadiusV16=structureRadius;
structureRadius=function(s){
 if(s.type==='landingpad')return CONFIG.LANDING_PAD.RADIUS;
 if(s.type==='refinery')return 38;
 if(s.type==='oremine'||s.type==='mine')return 30;
 return v15StructureRadiusV16(s);
};

placementBlocked=function(x,y,r,type,ignoreId=null){
 if(type==='mine'||type==='oremine'){
  const resource=type==='mine'?'crystal':'ore',d=findResourceDepotAt(x,y,resource);if(!d)return true;
  const px=d.x,py=d.y;
  if(!isWorldInside(px,py,r)||Math.hypot(px-BASE_X,py-BASE_Y)<BASE_RADIUS+r+CONFIG.WORLD.BASE_BUILD_CLEARANCE)return true;
  if(pointBlockedByTerrain(px,py,r*.45))return true;
  for(const s of state.structures){if(s.id===ignoreId)continue;if(Math.hypot(px-s.x,py-s.y)<r+structureRadius(s)+3)return true;}
  return false;
 }
 if(!isWorldInside(x,y,r))return true;
 if(Math.hypot(x-BASE_X,y-BASE_Y)<BASE_RADIUS+r+CONFIG.WORLD.BASE_BUILD_CLEARANCE)return true;
 if(pointBlockedByTerrain(x,y,r))return true;
 for(const s of state.structures){
  if(s.id===ignoreId)continue;
  if(s.type==='wall'){if(pointSegmentDistance(x,y,s.x1,s.y1,s.x2,s.y2)<r+wallThickness(s)/2+3)return true;}
  else if(Math.hypot(x-s.x,y-s.y)<r+structureRadius(s)+4)return true;
 }
 for(const d of state.depots)if(Math.hypot(x-d.x,y-d.y)<r+d.r+3)return true;
 return false;
};

navPointBlocked=function(x,y,r){
 if(!isWorldInside(x,y,r))return true;
 if(Math.hypot(x-BASE_X,y-BASE_Y)<BASE_RADIUS+r+4)return true;
 if(pointBlockedByTerrain(x,y,r+2))return true;
 for(const d of state.depots)if(Math.hypot(x-d.x,y-d.y)<d.r+r+2)return true;
 for(const s of state.structures){
  if(s.type==='safespot')continue;
  if(s.type==='wall'){if(pointSegmentDistance(x,y,s.x1,s.y1,s.x2,s.y2)<wallThickness(s)/2+r+3)return true;}
  else if(Math.hypot(x-s.x,y-s.y)<structureRadius(s)+r+3)return true;
 }
 return false;
};

wallSegmentValid=function(a,b){
 const len=Math.hypot(b.x-a.x,b.y-a.y),half=CONFIG.WALL.THICKNESS/2;
 if(len<CONFIG.WALL.MIN_LENGTH)return{ok:false,msg:`Wall must be at least ${CONFIG.WALL.MIN_LENGTH}px long.`};
 if(len>CONFIG.WALL.MAX_LENGTH)return{ok:false,msg:`Wall can be at most ${CONFIG.WALL.MAX_LENGTH}px long.`};
 if(!isWorldInside(a.x,a.y,half)||!isWorldInside(b.x,b.y,half))return{ok:false,msg:'Wall must stay inside the map.'};
 if(pointSegmentDistance(BASE_X,BASE_Y,a.x,a.y,b.x,b.y)<BASE_RADIUS+half+2)return{ok:false,msg:'Wall cannot overlap the base.'};
 if(terrainSegmentBlocked(a,b,half+2))return{ok:false,msg:'Terrain blocks that wall.'};
 for(const d of state.depots)if(pointSegmentDistance(d.x,d.y,a.x,a.y,b.x,b.y)<d.r+half+2)return{ok:false,msg:'A resource depot blocks that wall.'};
 for(const s of state.structures){
  if(s.type==='wall'){
   if(segmentSegmentDistance(a.x,a.y,b.x,b.y,s.x1,s.y1,s.x2,s.y2)<half+wallThickness(s)/2+3)return{ok:false,msg:'That wall overlaps another wall.'};
  }else if(pointSegmentDistance(s.x,s.y,a.x,a.y,b.x,b.y)<structureRadius(s)+half+3)return{ok:false,msg:'A building blocks that wall.'};
 }
 return{ok:true};
};

// -----------------------------------------------------------------------------
// BUILD PLACEMENT. Mines snap ON TOP of matching depots.
// -----------------------------------------------------------------------------
function structureHp(type){
 if(type==='laser')return CONFIG.LASER.HP;if(type==='flame')return CONFIG.FLAME.HP;if(type==='safespot')return CONFIG.SAFE_SPOT.HP;
 if(type==='mine')return CONFIG.CRYSTALS.MINE_HP;if(type==='oremine')return CONFIG.ORE.MINE_HP;if(type==='refinery')return CONFIG.REFINERY.HP;if(type==='landingpad')return CONFIG.LANDING_PAD.HP;
 return 100;
}
placeBuild=function(x,y){
 const def=BUILD[buildType];if(!def)return;
 if(def.kind==='unit'){
  const r=def.radius;if(!isWorldInside(x,y,r)||pointBlockedByTerrain(x,y,r)||Math.hypot(x-BASE_X,y-BASE_Y)<BASE_RADIUS+r+4){els.message.textContent='Unit deployment point is blocked.';return;}
  if(!payResource('gold',def.cost)){els.message.textContent=`Need ${def.cost} gold.`;return;}
  if(buildType==='soldier')state.units.push({id:'u'+Date.now()+Math.random(),type:'soldier',x,y,hp:CONFIG.SOLDIER.HP,maxHp:CONFIG.SOLDIER.HP,moveTarget:null,path:[],heading:0,attachedTo:null,attachSlot:0,cooldowns:Array(CONFIG.SOLDIER.MEMBERS).fill(0).map(()=>Math.random()*.3)});
  else state.units.push({id:'u'+Date.now()+Math.random(),type:'truck',x,y,hp:CONFIG.TRUCK.HP*state.mods.truckHp,maxHp:CONFIG.TRUCK.HP*state.mods.truckHp,moveTarget:null,path:[],heading:0,cargo:0,cargoType:null,route:[],routeIndex:0,routeLoop:false,routeActive:false});
  updateHud();return;
 }
 if(freeWorkers()<=0){els.message.textContent=`All ${CONFIG.WORKERS.COUNT} workers are busy.`;return;}

 let px=x,py=y,pad=null,depot=null;
 if(buildType==='mine'||buildType==='oremine'){
  const resource=buildType==='mine'?'crystal':'ore';depot=findResourceDepotAt(x,y,resource);
  if(!depot){els.message.textContent=`Place the ${resource==='crystal'?'Crystal':'Ore'} Mine directly on an unused ${resource} depot.`;return;}
  px=depot.x;py=depot.y;
  if(placementBlocked(x,y,def.radius,buildType)){els.message.textContent='That resource depot is blocked.';return;}
 }else{
  if(buildType==='laser'||buildType==='flame'){pad=findSafeSpotAt(x,y);if(pad){px=pad.x;py=pad.y;}}
  if(placementBlocked(px,py,def.radius,buildType,pad?pad.id:null)){els.message.textContent='That building location is blocked.';return;}
  if(buildType==='safespot'&&state.structures.some(s=>s.type==='safespot'&&Math.hypot(px-s.x,py-s.y)<CONFIG.SAFE_SPOT.PLACEMENT_CLEARANCE)){els.message.textContent='Safe Spots are too close together.';return;}
 }
 const currency=def.currency||'gold';
 if(!payResource(currency,def.cost)){els.message.textContent=`Need ${def.cost} ${currency}.`;return;}
 const hp=structureHp(buildType),s={id:'s'+Date.now()+Math.random(),type:buildType,x:px,y:py,hp,maxHp:hp,built:false,buildTime:def.buildTime,buildRemaining:def.buildTime,cool:Math.random()*.2,protected:false,safeSpotId:null,occupied:false};
 if(buildType==='mine'||buildType==='oremine'){s.stored=0;s.depotId=depot.id;depot.mineId=s.id;}
 if(buildType==='refinery')s.oreStored=0;
 if(buildType==='landingpad'){s.crystalStored=0;s.shipCargo=0;s.shipState='cooldown';s.shipCooldown=CONFIG.LANDING_PAD.INITIAL_COOLDOWN;s.landingFlash=0;}
 if(pad){pad.occupied=true;s.protected=true;s.safeSpotId=pad.id;}
 state.structures.push(s);els.message.textContent=`${def.label} construction started (${def.buildTime.toFixed(1)}s).`;updateHud();
};

// Wall now spends METAL, not gold.
wallAccept.onclick=()=>{
 if(!wallDraft||!wallDraft.pending)return;
 const p=wallDraft.pending,valid=wallSegmentValid(p.a,p.b);
 if(!valid.ok){els.message.textContent=valid.msg;clearWallDraft();return;}
 if(freeWorkers()<=0){els.message.textContent=`All ${CONFIG.WORKERS.COUNT} workers are busy.`;clearWallDraft();return;}
 if((state.metal||0)<p.cost){els.message.textContent=`Need ${p.cost} metal for this wall.`;clearWallDraft();return;}
 state.metal-=p.cost;
 const x=(p.a.x+p.b.x)/2,y=(p.a.y+p.b.y)/2,hp=wallHp(p.length);
 state.structures.push({id:'w'+Date.now()+Math.random(),type:'wall',x,y,x1:p.a.x,y1:p.a.y,x2:p.b.x,y2:p.b.y,length:p.length,thickness:CONFIG.WALL.THICKNESS,hp,maxHp:hp,built:false,buildTime:p.buildTime,buildRemaining:p.buildTime,cool:0,protected:false,safeSpotId:null});
 els.message.textContent=`Wall construction started: ${Math.round(p.length)}px, ${p.cost} metal.`;clearWallDraft();updateHud();
};
