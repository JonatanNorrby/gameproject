// Alien Planet Defense v18 - backlog fixes
// Wall path painting/cancel/confirm, truck loop handoff, and smarter enemy wall routing.

const wallCancelModeBtn=document.getElementById('wallCancelModeBtn');
const wallConfirmPathBtn=document.getElementById('wallConfirmPathBtn');
let wallPath=[];
let wallPainting=false;
let wallLastWorld=null;

function wallModeActive(){return buildType==='wall'&&!state.selectedUnit;}
function wallPathLength(points=wallPath){let n=0;for(let i=1;i<points.length;i++)n+=Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y);return n;}
function normalizeWallPath(points){
 const out=[];for(const p of points){if(!out.length||Math.hypot(p.x-out[out.length-1].x,p.y-out[out.length-1].y)>=CONFIG.WALL.MIN_LENGTH)out.push({x:p.x,y:p.y});}
 if(out.length>=3&&Math.hypot(out.at(-1).x-out.at(-2).x,out.at(-1).y-out.at(-2).y)<CONFIG.WALL.MIN_LENGTH)out.splice(-2,1);
 return out;
}
function validateWallPath(points){
 if(points.length<2)return{ok:false,msg:'Draw a wall path first.'};
 const total=wallPathLength(points);if(total>CONFIG.WALL.MAX_PATH_LENGTH)return{ok:false,msg:`Wall path can be at most ${CONFIG.WALL.MAX_PATH_LENGTH}px total.`};
 for(let i=1;i<points.length;i++){const r=wallSegmentValid(points[i-1],points[i]);if(!r.ok)return r;}
 return{ok:true,total};
}
function resetWallPath(msg){wallPath=[];wallPainting=false;wallLastWorld=null;if(typeof clearWallDraft==='function')clearWallDraft();if(msg)els.message.textContent=msg;updateWallModeButtons();}
function updateWallModeButtons(){const on=wallModeActive();wallCancelModeBtn.classList.toggle('visible',on);wallConfirmPathBtn.classList.toggle('visible',on&&wallPath.length>=2);}
function appendWallPoint(p,force=false){
 if(!wallPath.length){wallPath.push({x:p.x,y:p.y});wallLastWorld={x:p.x,y:p.y};updateWallModeButtons();return;}
 const last=wallPath.at(-1),d=Math.hypot(p.x-last.x,p.y-last.y);if(!force&&d<CONFIG.WALL.PAINT_POINT_SPACING)return;
 if(force&&d<8)return;
 wallPath.push({x:p.x,y:p.y});wallLastWorld={x:p.x,y:p.y};updateWallModeButtons();
}

wallCancelModeBtn.onclick=e=>{e.stopPropagation();resetWallPath('Wall placement cancelled.');};
wallConfirmPathBtn.onclick=e=>{
 e.stopPropagation();const points=normalizeWallPath(wallPath),v=validateWallPath(points);if(!v.ok){els.message.textContent=v.msg;return;}
 if(freeWorkers()<=0){els.message.textContent=`All ${CONFIG.WORKERS.COUNT} workers are busy.`;return;}
 const cost=wallPrice(v.total),time=wallTime(v.total);wallPath=points;
 wallLengthEl.textContent=`${Math.round(v.total)} px`;wallCostEl.textContent=cost;wallBuildTimeEl.textContent=time.toFixed(1);
 wallConfirm.classList.remove('hidden');
};
wallCancel.onclick=()=>{wallConfirm.classList.add('hidden');els.message.textContent='Wall build not confirmed — path is still editable.';};
wallAccept.onclick=()=>{
 const points=normalizeWallPath(wallPath),v=validateWallPath(points);if(!v.ok){wallConfirm.classList.add('hidden');els.message.textContent=v.msg;return;}
 if(freeWorkers()<=0){wallConfirm.classList.add('hidden');els.message.textContent=`All ${CONFIG.WORKERS.COUNT} workers are busy.`;return;}
 const cost=wallPrice(v.total);if((state.metal||0)<cost){wallConfirm.classList.add('hidden');els.message.textContent=`Need ${cost} metal for this wall.`;return;}
 state.metal-=cost;const group='wg'+Date.now()+Math.random(),bt=wallTime(v.total);
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],len=Math.hypot(b.x-a.x,b.y-a.y),hp=Math.max(1,Math.round(CONFIG.WALL.HP_PER_100*len/100));
  state.structures.push({id:'w'+Date.now()+Math.random(),groupId:group,type:'wall',x:(a.x+b.x)/2,y:(a.y+b.y)/2,x1:a.x,y1:a.y,x2:b.x,y2:b.y,length:len,thickness:CONFIG.WALL.THICKNESS,hp,maxHp:hp,built:false,buildTime:bt,buildRemaining:bt,cool:0,protected:false,safeSpotId:null});
 }
 wallConfirm.classList.add('hidden');resetWallPath(`Wall path queued for ${cost} metal.`);updateHud();
};

// One worker builds an entire multi-segment wall path.
activeConstructionCount=function(){
 const keys=new Set();for(const s of state.structures)if(!s.built)keys.add(s.groupId||s.id);return keys.size;
};
updateConstruction=function(dt){
 const groups=new Map();for(const s of state.structures)if(!s.built){const k=s.groupId||s.id;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(s);}
 for(const items of groups.values()){
  const remaining=Math.max(0,items[0].buildRemaining-dt);for(const s of items)s.buildRemaining=remaining;
  if(remaining<=0){for(const s of items)s.built=true;els.message.textContent=items[0].type==='wall'?'Wall construction complete.':`${BUILD[items[0].type]?.label||'Building'} construction complete.`;}
 }
};

// Paint walls by dragging, or add bend points with individual clicks.
canvas.addEventListener('pointerdown',e=>{
 if(!wallModeActive()||state.gameOver||state.choosing)return;
 if(typeof clearWallDraft==='function')clearWallDraft();const p=worldFromEvent(e);appendWallPoint(p,true);wallPainting=true;if(pointer)pointer.type='wallpaint';
});
canvas.addEventListener('pointermove',e=>{if(!wallPainting||!wallModeActive())return;const p=worldFromEvent(e);wallLastWorld=p;appendWallPoint(p,false);});
canvas.addEventListener('pointerup',e=>{if(!wallPainting)return;wallPainting=false;appendWallPoint(worldFromEvent(e),true);});

const v17HandleTapV18=handleTap;
handleTap=function(x,y){
 if(wallModeActive()){
  const p={x,y};if(!wallPath.length)appendWallPoint(p,true);else if(Math.hypot(x-wallPath.at(-1).x,y-wallPath.at(-1).y)>=CONFIG.WALL.MIN_LENGTH)appendWallPoint(p,true);
  els.message.textContent='Wall path: click bends or drag to paint. ✓ reviews cost, ✕ cancels.';return;
 }
 return v17HandleTapV18(x,y);
};
document.querySelectorAll('.buildBtn').forEach(b=>b.addEventListener('click',()=>{if(b.dataset.type!=='wall')resetWallPath();setTimeout(updateWallModeButtons,0);}));

// Draw polyline wall preview after the existing renderer.
const v17DrawV18=draw;
draw=function(){
 v17DrawV18();updateWallModeButtons();if(!wallPath.length)return;
 ctx.save();ctx.translate(-state.camera.x,-state.camera.y);ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='rgba(99,232,137,.62)';ctx.lineWidth=CONFIG.WALL.THICKNESS;ctx.beginPath();ctx.moveTo(wallPath[0].x,wallPath[0].y);for(let i=1;i<wallPath.length;i++)ctx.lineTo(wallPath[i].x,wallPath[i].y);if(wallLastWorld&&wallPainting)ctx.lineTo(wallLastWorld.x,wallLastWorld.y);ctx.stroke();
 const len=wallPathLength();ctx.fillStyle='rgba(5,12,17,.9)';const p=wallPath.at(-1);ctx.fillRect(p.x-74,p.y-34,148,20);ctx.fillStyle='#dff7e5';ctx.font='bold 11px Arial';ctx.textAlign='center';ctx.fillText(`${Math.round(len)}px · ${wallPrice(len)} metal`,p.x,p.y-20);ctx.restore();
};

// Newly recorded truck loops travel to their first point, then immediately begin
// repeating and automatically deselect so the player can keep issuing orders.
els.routeRecord.onclick=()=>{
 const u=state.selectedUnit;if(!u||u.type!=='truck')return;
 if(!state.routeEditing){u.route=[];u.routeLoop=false;u.routeActive=false;u.routePendingStart=false;state.routeEditing=true;els.message.textContent='Route recording: tap points in order, then press FINISH ROUTE.';}
 else{
  state.routeEditing=false;if(u.route.length>=2){u.routePendingStart=true;u.routeLoop=false;u.routeActive=false;u.routeIndex=0;if(setUnitDestination(u,u.route[0].x,u.route[0].y,{preserveRoute:true}))els.message.textContent='Route saved. Truck is moving to the loop start.';}
  else els.message.textContent='Route needs at least 2 points.';
 }updateHud();
};
const v17UpdateUnitMovementV18=updateUnitMovement;
updateUnitMovement=function(dt){
 v17UpdateUnitMovementV18(dt);
 for(const u of state.units){if(u.type!=='truck'||!u.routePendingStart||u.path?.length)continue;if(!u.route?.length)continue;const p=u.route[0];if(Math.hypot(u.x-p.x,u.y-p.y)<=10){u.routePendingStart=false;u.routeLoop=true;u.routeActive=true;u.routeIndex=0;advanceTruckRoute(u);if(state.selectedUnit===u){state.selectedUnit=null;state.routeEditing=false;state.attachMode=false;}els.message.textContent='Truck reached loop start — repeating route started.';updateHud();}}
};

// Enemy navigation: take a reasonable open detour around walls. If the only
// route requires a large detour, enemies attack through the blocking wall.
function wallAtPointForEnemy(x,y,r){let best=null,bd=Infinity;for(const s of state.structures){if(s.type!=='wall'||!s.built)continue;const d=pointSegmentDistance(x,y,s.x1,s.y1,s.x2,s.y2);if(d<r+wallThickness(s)/2&&d<bd){best=s;bd=d;}}return best;}
function nearestPointOnWall(e,w){const vx=w.x2-w.x1,vy=w.y2-w.y1,vv=vx*vx+vy*vy||1,t=Math.max(0,Math.min(1,((e.x-w.x1)*vx+(e.y-w.y1)*vy)/vv));return{x:w.x1+t*vx,y:w.y1+t*vy};}
function enemyStepOpen(e,nx,ny){return !pointBlockedByTerrain(nx,ny,e.r+1)&&!wallAtPointForEnemy(nx,ny,e.r+1);}
function navigateEnemyWithWalls(e,tx,ty,speed,dt){
 const dx=tx-e.x,dy=ty-e.y,d=Math.hypot(dx,dy)||1,base=Math.atan2(dy,dx),step=speed*dt;
 const directX=e.x+dx/d*step,directY=e.y+dy/d*step,directWall=wallAtPointForEnemy(directX,directY,e.r+2);
 const offsets=[0,.32,-.32,.62,-.62,.92,-.92,1.22,-1.22];
 for(const off of offsets){const a=base+off,nx=e.x+Math.cos(a)*step,ny=e.y+Math.sin(a)*step;if(enemyStepOpen(e,nx,ny)){if(directWall&&Math.abs(off)>CONFIG.ENEMY_PATHING.MAX_OPEN_DETOUR_ANGLE)break;e.x=nx;e.y=ny;return null;}}
 if(directWall)return directWall;
 // Terrain-only fallback if boxed by a non-wall feature.
 for(const off of offsets){const a=base+off,nx=e.x+Math.cos(a)*step,ny=e.y+Math.sin(a)*step;if(!pointBlockedByTerrain(nx,ny,e.r+1)){e.x=nx;e.y=ny;return null;}}
 return null;
}
function attackOrApproachWall(e,w,speed,dt){const p=nearestPointOnWall(e,w),dist=Math.hypot(e.x-p.x,e.y-p.y),range=CONFIG.TOWER_DURABILITY.MELEE_ATTACK_RANGE+e.r+wallThickness(w)/2;if(dist<=range){w.hp-=e.damage*CONFIG.TOWER_DURABILITY.MELEE_DAMAGE_MULTIPLIER*dt;return true;}const dx=p.x-e.x,dy=p.y-e.y,d=Math.hypot(dx,dy)||1,step=Math.min(speed*dt,Math.max(0,dist-range*.7));const nx=e.x+dx/d*step,ny=e.y+dy/d*step;if(!pointBlockedByTerrain(nx,ny,e.r+1)){e.x=nx;e.y=ny;}return false;}

updateEnemies=function(dt){
 for(const e of [...state.enemies]){
  if(e.burn>0){e.burn-=dt;e.burnTick-=dt;if(e.burnTick<=0){hitEnemy(e,CONFIG.FLAME.BURN_TICK_DAMAGE*state.mods.flameDamage);e.burnTick=CONFIG.FLAME.BURN_TICK_INTERVAL;if(e.hp<=0)continue;}}
  let speed=e.speed,attacking=false;const lure=e.attractedTo?state.structures.find(s=>s.id===e.attractedTo&&s.type==='landingpad'&&s.built):null;if(e.attractedTo&&!lure)e.attractedTo=null;
  const tx=lure?lure.x:BASE_X,ty=lure?lure.y:BASE_Y;
  if(e.type==='spitter'){
   e.rangeCooldown-=dt;const t=lure||(closestAttackTarget(e,CONFIG.RANGED_ALIEN.ATTACK_RANGE,true));if(t&&Math.hypot(e.x-t.x,e.y-t.y)<=CONFIG.RANGED_ALIEN.ATTACK_RANGE){speed=0;if(e.rangeCooldown<=0){fireEnemyShot(e,t);e.rangeCooldown=CONFIG.RANGED_ALIEN.FIRE_INTERVAL;}}
  }else{
   const t=lure&&Math.hypot(e.x-lure.x,e.y-lure.y)<=CONFIG.TOWER_DURABILITY.MELEE_AGGRO_RANGE?lure:closestAttackTarget(e,CONFIG.TOWER_DURABILITY.MELEE_AGGRO_RANGE,false);
   if(t){const td=t.type==='wall'?pointSegmentDistance(e.x,e.y,t.x1,t.y1,t.x2,t.y2):Math.hypot(e.x-t.x,e.y-t.y);if(td<CONFIG.TOWER_DURABILITY.MELEE_ATTACK_RANGE+e.r+structureOrUnitRadius(t)){t.hp-=e.damage*CONFIG.TOWER_DURABILITY.MELEE_DAMAGE_MULTIPLIER*dt;speed=0;attacking=true;}}
  }
  if(!attacking&&speed>0){const wall=navigateEnemyWithWalls(e,tx,ty,speed,dt);if(wall&&e.type!=='spitter')attackOrApproachWall(e,wall,speed,dt);}
  if(!lure&&Math.hypot(e.x-BASE_X,e.y-BASE_Y)<BASE_RADIUS+e.r){state.enemies.splice(state.enemies.indexOf(e),1);if(!state.debug.unlimitedLives)state.baseHp-=e.damage;}
 }
 cleanupDestroyed();
};

// Restart clears any wall draft state.
const v17ResetV18=reset;
reset=function(){v17ResetV18();wallPath=[];wallPainting=false;wallLastWorld=null;wallConfirm.classList.add('hidden');updateWallModeButtons();};
els.restart.onclick=reset;
reset();
