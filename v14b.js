canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture?.(e.pointerId);pointer={id:e.pointerId,startX:e.clientX,startY:e.clientY,lastX:e.clientX,lastY:e.clientY,drag:false,type:e.pointerType};});
canvas.addEventListener('pointermove',e=>{if(!pointer||pointer.id!==e.pointerId)return;const dx=e.clientX-pointer.lastX,dy=e.clientY-pointer.lastY;if(Math.hypot(e.clientX-pointer.startX,e.clientY-pointer.startY)>8)pointer.drag=true;if(pointer.type==='touch'&&pointer.drag){const r=canvas.getBoundingClientRect();state.camera.x-=dx*W/r.width;state.camera.y-=dy*H/r.height;clampCamera();}pointer.lastX=e.clientX;pointer.lastY=e.clientY;});
canvas.addEventListener('pointerup',e=>{if(!pointer||pointer.id!==e.pointerId)return;const wasDrag=pointer.drag,p=worldFromEvent(e);pointer=null;if(!wasDrag)handleTap(p.x,p.y);});
canvas.addEventListener('contextmenu',e=>e.preventDefault());

function unitAt(x,y){let best=null,bd=34;for(const u of state.units){const d=Math.hypot(x-u.x,y-u.y);if(d<bd){best=u;bd=d;}}return best;}
function handleTap(x,y){
 if(state.gameOver||state.choosing)return;
 const clicked=unitAt(x,y);
 if(state.attachMode&&state.selectedUnit&&state.selectedUnit.type==='soldier'){
  if(clicked&&clicked.type==='truck'){attachSoldierToTruck(state.selectedUnit,clicked);state.attachMode=false;els.message.textContent='Fire Squad attached to truck patrol.';updateHud();return;}
  els.message.textContent='Attach mode: tap directly on a Crystal Truck.';return;
 }
 if(clicked){state.selectedUnit=clicked;state.routeEditing=false;state.attachMode=false;els.message.textContent=`${clicked.type==='truck'?'Crystal Truck':'Fire Squad'} selected.`;updateHud();return;}
 if(state.selectedUnit){
  const u=state.selectedUnit;
  if(u.type==='truck'&&state.routeEditing){if(navPointBlocked(x,y,uRadius(u))){els.message.textContent='That route point is blocked.';return;}u.route.push({x,y});els.message.textContent=`Route point ${u.route.length} added.`;updateHud();return;}
  if(u.attachedTo){els.message.textContent='Detach this Fire Squad before giving it an independent move order.';return;}
  if(navPointBlocked(x,y,uRadius(u))){els.message.textContent='That destination is blocked.';return;}
  if(u.type==='truck'){u.routeLoop=false;u.routeActive=false;}
  setUnitDestination(u,x,y);els.message.textContent='Move order queued.';return;
 }
 placeBuild(x,y);
}
function spend(cost){if(state.debug.unlimitedCash)return true;if(state.credits<cost)return false;state.credits-=cost;return true;}
function refund(cost){if(!state.debug.unlimitedCash)state.credits+=cost;}
function freeWorkers(){return CONFIG.WORKERS.COUNT-activeConstructionCount();}
function findSafeSpotAt(x,y){return state.structures.find(s=>s.type==='safespot'&&s.built&&!s.occupied&&Math.hypot(x-s.x,y-s.y)<=CONFIG.SAFE_SPOT.RADIUS);}
function findMineDepotForPlacement(x,y){let best=null,bd=Infinity;for(const d of state.depots){if(d.mineId)continue;const dist=Math.hypot(x-d.x,y-d.y);if(dist<=CONFIG.CRYSTALS.MINE_PLACEMENT_RANGE&&dist>=d.r+14&&dist<bd){best=d;bd=dist;}}return best;}
function placeBuild(x,y){
 const def=BUILD[buildType];if(!def)return;
 if(def.kind==='unit'){
  const r=def.radius;if(!isWorldInside(x,y,r)||pointBlockedByTerrain(x,y,r)||Math.hypot(x-BASE_X,y-BASE_Y)<BASE_RADIUS+r+4){els.message.textContent='Unit deployment point is blocked.';return;}
  if(!spend(def.cost)){els.message.textContent=`Need ${def.cost} credits.`;return;}
  if(buildType==='soldier')state.units.push({id:'u'+Date.now()+Math.random(),type:'soldier',x,y,hp:CONFIG.SOLDIER.HP,maxHp:CONFIG.SOLDIER.HP,moveTarget:null,path:[],heading:0,attachedTo:null,attachSlot:0,cooldowns:Array(CONFIG.SOLDIER.MEMBERS).fill(0).map(()=>Math.random()*.3)});
  else state.units.push({id:'u'+Date.now()+Math.random(),type:'truck',x,y,hp:CONFIG.TRUCK.HP*state.mods.truckHp,maxHp:CONFIG.TRUCK.HP*state.mods.truckHp,moveTarget:null,path:[],heading:0,cargo:0,route:[],routeIndex:0,routeLoop:false,routeActive:false});
  updateHud();return;
 }
 if(freeWorkers()<=0){els.message.textContent=`All ${CONFIG.WORKERS.COUNT} workers are busy. Wait for a building to finish.`;return;}
 let px=x,py=y,pad=null;
 if(buildType==='laser'||buildType==='flame'){pad=findSafeSpotAt(x,y);if(pad){px=pad.x;py=pad.y;}}
 const r=def.radius;
 let depot=null;
 if(buildType==='mine'){
  depot=findMineDepotForPlacement(px,py);if(!depot){els.message.textContent='Crystal Mines must be placed near an unused crystal depot.';return;}
  if(!isWorldInside(px,py,r)||Math.hypot(px-BASE_X,py-BASE_Y)<BASE_RADIUS+r+CONFIG.WORLD.BASE_BUILD_CLEARANCE||pointBlockedByTerrain(px,py,r)){els.message.textContent='That mine location is blocked.';return;}
  for(const s of state.structures){if(Math.hypot(px-s.x,py-s.y)<r+structureRadius(s)+8){els.message.textContent='That mine location overlaps another building.';return;}}
 }else if(placementBlocked(px,py,r,buildType,pad?pad.id:null)){els.message.textContent='That building location is blocked.';return;}
 if(buildType==='safespot'&&state.structures.some(s=>s.type==='safespot'&&Math.hypot(px-s.x,py-s.y)<CONFIG.SAFE_SPOT.PLACEMENT_CLEARANCE)){els.message.textContent='Safe Spots are too close together.';return;}
 if(!spend(def.cost)){els.message.textContent=`Need ${def.cost} credits.`;return;}
 const hp=buildType==='laser'?CONFIG.LASER.HP:buildType==='flame'?CONFIG.FLAME.HP:buildType==='blockade'?CONFIG.BLOCKADE.HP:buildType==='mine'?CONFIG.CRYSTALS.MINE_HP:CONFIG.SAFE_SPOT.HP;
 const s={id:'s'+Date.now()+Math.random(),type:buildType,x:px,y:py,hp,maxHp:hp,built:false,buildTime:def.buildTime,buildRemaining:def.buildTime,cool:Math.random()*.2,protected:false,safeSpotId:null,occupied:false,w:CONFIG.BLOCKADE.WIDTH,h:CONFIG.BLOCKADE.HEIGHT};
 if(buildType==='mine'){s.stored=0;s.depotId=depot.id;depot.mineId=s.id;}
 if(pad){pad.occupied=true;s.protected=true;s.safeSpotId=pad.id;}
 state.structures.push(s);els.message.textContent=`${def.label} construction started (${def.buildTime.toFixed(1)}s).`;updateHud();
}

function uRadius(u){return u.type==='truck'?22:20;}
function navPointBlocked(x,y,r){
 if(!isWorldInside(x,y,r))return true;
 if(Math.hypot(x-BASE_X,y-BASE_Y)<BASE_RADIUS+r+6)return true;
 if(state.terrain.some(o=>Math.hypot(x-o.x,y-o.y)<o.r+r+4))return true;
 for(const d of state.depots)if(Math.hypot(x-d.x,y-d.y)<d.r+r+2)return true;
 for(const s of state.structures){if(s.type==='safespot')continue;if(Math.hypot(x-s.x,y-s.y)<structureRadius(s)+r+4)return true;}
 return false;
}
function cellKey(x,y){return `${x},${y}`;}
function reconstructPath(came,key,cell,goal){const out=[];let k=key;while(came.has(k)){const [cx,cy]=k.split(',').map(Number);out.push({x:cx*cell+cell/2,y:cy*cell+cell/2});k=came.get(k);}out.reverse();out.push({x:goal.x,y:goal.y});return simplifyPath(out);}
function simplifyPath(path){if(path.length<3)return path;const out=[path[0]];let lastDir=null;for(let i=1;i<path.length;i++){const prev=out[out.length-1],p=path[i],dx=Math.sign(Math.round((p.x-prev.x)/10)),dy=Math.sign(Math.round((p.y-prev.y)/10)),dir=`${dx},${dy}`;if(lastDir&&dir===lastDir)out[out.length-1]=p;else{out.push(p);lastDir=dir;}}return out;}
function findPath(sx,sy,gx,gy,radius){
 const cell=CONFIG.PATHFINDING.CELL_SIZE,cols=Math.ceil(WORLD_W/cell),rows=Math.ceil(WORLD_H/cell);
 const sc={x:Math.max(0,Math.min(cols-1,Math.floor(sx/cell))),y:Math.max(0,Math.min(rows-1,Math.floor(sy/cell)))},gc={x:Math.max(0,Math.min(cols-1,Math.floor(gx/cell))),y:Math.max(0,Math.min(rows-1,Math.floor(gy/cell)))};
 const start=cellKey(sc.x,sc.y),goal=cellKey(gc.x,gc.y),open=[{x:sc.x,y:sc.y,g:0,f:0,key:start}],best=new Map([[start,0]]),came=new Map();let visited=0;
 const dirs=[[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,1.414],[1,-1,1.414],[-1,1,1.414],[-1,-1,1.414]];
 while(open.length&&visited++<CONFIG.PATHFINDING.MAX_VISITED){open.sort((a,b)=>a.f-b.f);const cur=open.shift();if(cur.key===goal)return reconstructPath(came,cur.key,cell,{x:gx,y:gy});for(const [dx,dy,cost] of dirs){const nx=cur.x+dx,ny=cur.y+dy;if(nx<0||ny<0||nx>=cols||ny>=rows)continue;const wx=nx*cell+cell/2,wy=ny*cell+cell/2;if(navPointBlocked(wx,wy,radius)&&!(nx===gc.x&&ny===gc.y))continue;const nk=cellKey(nx,ny),ng=cur.g+cost;if(ng>=(best.get(nk)??Infinity))continue;best.set(nk,ng);came.set(nk,cur.key);const h=Math.hypot(gc.x-nx,gc.y-ny);open.push({x:nx,y:ny,g:ng,f:ng+h,key:nk});}}
 return [];
}
function setUnitDestination(u,x,y,opt={}){const path=findPath(u.x,u.y,x,y,uRadius(u));if(!path.length){els.message.textContent='No safe path to that destination.';return false;}u.path=path;u.moveTarget={x,y};if(u.type==='truck'&&!opt.preserveRoute){u.routeActive=false;}return true;}
function attachSoldierToTruck(soldier,truck){const attached=state.units.filter(u=>u.type==='soldier'&&u.attachedTo===truck.id);soldier.attachedTo=truck.id;soldier.attachSlot=attached.length;soldier.path=[];soldier.moveTarget=null;}
function detachFollowersOfTruck(truck){for(const u of state.units)if(u.attachedTo===truck.id){u.attachedTo=null;u.attachSlot=0;}}
function advanceTruckRoute(u){if(!u.routeLoop||u.route.length<2){u.routeActive=false;return;}u.routeIndex=(u.routeIndex+1)%u.route.length;setUnitDestination(u,u.route[u.routeIndex].x,u.route[u.routeIndex].y,{preserveRoute:true});}
function updateUnitMovement(dt){
 for(const u of state.units){
  if(u.type==='soldier'&&u.attachedTo){const truck=state.units.find(t=>t.id===u.attachedTo&&t.type==='truck');if(!truck){u.attachedTo=null;continue;}const off=ATTACH_OFFSETS[u.attachSlot%ATTACH_OFFSETS.length],c=Math.cos(truck.heading||0),s=Math.sin(truck.heading||0);u.x=truck.x+off[0]*c-off[1]*s;u.y=truck.y+off[0]*s+off[1]*c;continue;}
  if(!u.path||!u.path.length)continue;const p=u.path[0],dx=p.x-u.x,dy=p.y-u.y,d=Math.hypot(dx,dy);if(d<5){u.x=p.x;u.y=p.y;u.path.shift();if(!u.path.length){u.moveTarget=null;if(u.type==='truck'&&u.routeActive)advanceTruckRoute(u);}continue;}
  const speed=(u.type==='truck'?CONFIG.TRUCK.MOVE_SPEED:CONFIG.SOLDIER.MOVE_SPEED)*state.mods.unitMove,step=Math.min(d,speed*dt);u.heading=Math.atan2(dy,dx);u.x+=dx/d*step;u.y+=dy/d*step;
 }
}
function updateConstruction(dt){for(const s of state.structures){if(s.built)continue;s.buildRemaining=Math.max(0,s.buildRemaining-dt);if(s.buildRemaining<=0){s.built=true;els.message.textContent=`${BUILD[s.type].label} construction complete.`;}}}
function updateMines(dt){for(const s of state.structures){if(s.type!=='mine'||!s.built)continue;const depot=state.depots.find(d=>d.id===s.depotId);if(!depot||depot.stock<=0)continue;const cap=CONFIG.CRYSTALS.MINE_STORAGE*state.mods.mineStorage,amount=Math.min(CONFIG.CRYSTALS.MINE_RATE*state.mods.mineRate*dt,depot.stock,cap-s.stored);if(amount>0){s.stored+=amount;depot.stock-=amount;}}}
function updateTruckEconomy(){for(const u of state.units){if(u.type!=='truck')continue;const cap=Math.round(CONFIG.TRUCK.CAPACITY*state.mods.truckCapacity);if(u.cargo<cap){let mine=null,bd=CONFIG.TRUCK.PICKUP_RANGE;for(const s of state.structures)if(s.type==='mine'&&s.built&&s.stored>0){const d=Math.hypot(u.x-s.x,u.y-s.y);if(d<bd){mine=s;bd=d;}}if(mine){const take=Math.min(cap-u.cargo,mine.stored);u.cargo+=take;mine.stored-=take;}}
  if(u.cargo>0&&Math.hypot(u.x-BASE_X,u.y-BASE_Y)<BASE_RADIUS+CONFIG.TRUCK.UNLOAD_RANGE){const money=u.cargo*CONFIG.CRYSTALS.MONEY_PER_CRYSTAL*state.mods.crystalValue;if(!state.debug.unlimitedCash)state.credits+=money;u.cargo=0;els.message.textContent=`Truck delivered crystals: +${Math.round(money)} credits.`;}}
}
