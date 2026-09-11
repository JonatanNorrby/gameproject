// Alien Planet Defense v15 patch
// Focused fixes for pointer alignment / placement geometry + variable length walls.

// -----------------------------------------------------------------------------
// 1) BUILD REGISTRY: replace Blockade with Wall in the active UI.
// -----------------------------------------------------------------------------
BUILD.wall={kind:'structure',cost:0,label:'Wall',radius:CONFIG.WALL.THICKNESS/2,buildTime:0};

const wallConfirm=document.getElementById('wallConfirm');
const wallLengthEl=document.getElementById('wallLength');
const wallCostEl=document.getElementById('wallCost');
const wallBuildTimeEl=document.getElementById('wallBuildTime');
const wallAccept=document.getElementById('wallAccept');
const wallCancel=document.getElementById('wallCancel');

let wallDraft=null; // {start:{x,y}, current:{x,y}, pending:{...}}
let cursorWorld=null;

// -----------------------------------------------------------------------------
// 2) EXACT POINTER MAPPING.
// getBoundingClientRect() includes CSS borders while clientWidth/clientHeight do
// not. Using the canvas content box prevents the visual cursor from drifting.
// -----------------------------------------------------------------------------
worldFromEvent=function(e){
 const rect=canvas.getBoundingClientRect();
 const cssW=canvas.clientWidth||rect.width;
 const cssH=canvas.clientHeight||rect.height;
 const localX=e.clientX-rect.left-(canvas.clientLeft||0);
 const localY=e.clientY-rect.top-(canvas.clientTop||0);
 const sx=localX*(W/cssW);
 const sy=localY*(H/cssH);
 return{x:sx+state.camera.x,y:sy+state.camera.y,sx,sy};
};

// Larger click/tap target for units, scaled so mobile selection stays usable.
unitAt=function(x,y){
 const cssScale=W/Math.max(1,canvas.clientWidth||W);
 const hitRadius=Math.max(38,26*cssScale);
 let best=null,bd=hitRadius;
 for(const u of state.units){
  const d=Math.hypot(x-u.x,y-u.y);
  if(d<bd){best=u;bd=d;}
 }
 return best;
};

// -----------------------------------------------------------------------------
// 3) PLACEMENT GEOMETRY.
// v14 had generous invisible margins. v15 blocks only actual visible overlap
// plus a tiny safety margin.
// -----------------------------------------------------------------------------
pointBlockedByTerrain=function(x,y,extra=0){
 return state.terrain.some(o=>Math.hypot(x-o.x,y-o.y)<o.r+extra+CONFIG.TERRAIN.BUILD_CLEARANCE);
};

function pointSegmentDistance(px,py,x1,y1,x2,y2){
 const vx=x2-x1,vy=y2-y1,wx=px-x1,wy=py-y1;
 const vv=vx*vx+vy*vy;
 if(vv<=0.0001)return Math.hypot(px-x1,py-y1);
 const t=Math.max(0,Math.min(1,(wx*vx+wy*vy)/vv));
 const qx=x1+t*vx,qy=y1+t*vy;
 return Math.hypot(px-qx,py-qy);
}
function wallLength(s){return s.length||Math.hypot((s.x2||s.x)-(s.x1||s.x),(s.y2||s.y)-(s.y1||s.y));}
function wallThickness(s){return s.thickness||CONFIG.WALL.THICKNESS;}

const v14StructureRadius=structureRadius;
structureRadius=function(s){
 if(s.type==='wall')return Math.max(10,wallThickness(s)/2);
 return v14StructureRadius(s);
};

placementBlocked=function(x,y,r,type,ignoreId=null){
 if(!isWorldInside(x,y,r))return true;
 if(Math.hypot(x-BASE_X,y-BASE_Y)<BASE_RADIUS+r+CONFIG.WORLD.BASE_BUILD_CLEARANCE)return true;
 if(pointBlockedByTerrain(x,y,r))return true;
 for(const s of state.structures){
  if(s.id===ignoreId)continue;
  if(s.type==='wall'){
   if(pointSegmentDistance(x,y,s.x1,s.y1,s.x2,s.y2)<r+wallThickness(s)/2+3)return true;
  }else if(Math.hypot(x-s.x,y-s.y)<r+structureRadius(s)+4)return true;
 }
 if(type!=='mine')for(const d of state.depots){
  if(Math.hypot(x-d.x,y-d.y)<r+d.r+3)return true;
 }
 return false;
};

// Unit pathfinding also treats walls as line obstacles.
navPointBlocked=function(x,y,r){
 if(!isWorldInside(x,y,r))return true;
 if(Math.hypot(x-BASE_X,y-BASE_Y)<BASE_RADIUS+r+4)return true;
 if(state.terrain.some(o=>Math.hypot(x-o.x,y-o.y)<o.r+r+3))return true;
 for(const d of state.depots)if(Math.hypot(x-d.x,y-d.y)<d.r+r+2)return true;
 for(const s of state.structures){
  if(s.type==='safespot')continue;
  if(s.type==='wall'){
   if(pointSegmentDistance(x,y,s.x1,s.y1,s.x2,s.y2)<wallThickness(s)/2+r+3)return true;
  }else if(Math.hypot(x-s.x,y-s.y)<structureRadius(s)+r+3)return true;
 }
 return false;
};

// -----------------------------------------------------------------------------
// 4) WALL DRAFT / VALIDATION / PRICING.
// -----------------------------------------------------------------------------
function wallPrice(length){return Math.max(1,Math.ceil(length/100*CONFIG.WALL.COST_PER_100));}
function wallTime(length){return CONFIG.WALL.BASE_BUILD_TIME+length/100*CONFIG.WALL.BUILD_TIME_PER_100;}
function wallHp(length){return Math.max(1,Math.round(length/100*CONFIG.WALL.HP_PER_100));}

function wallSegmentValid(a,b){
 const len=Math.hypot(b.x-a.x,b.y-a.y),half=CONFIG.WALL.THICKNESS/2;
 if(len<CONFIG.WALL.MIN_LENGTH)return{ok:false,msg:`Wall must be at least ${CONFIG.WALL.MIN_LENGTH}px long.`};
 if(len>CONFIG.WALL.MAX_LENGTH)return{ok:false,msg:`Wall can be at most ${CONFIG.WALL.MAX_LENGTH}px long.`};
 if(!isWorldInside(a.x,a.y,half)||!isWorldInside(b.x,b.y,half))return{ok:false,msg:'Wall must stay inside the map.'};
 if(pointSegmentDistance(BASE_X,BASE_Y,a.x,a.y,b.x,b.y)<BASE_RADIUS+half+2)return{ok:false,msg:'Wall cannot overlap the base.'};
 for(const o of state.terrain){if(pointSegmentDistance(o.x,o.y,a.x,a.y,b.x,b.y)<o.r+half+2)return{ok:false,msg:'Natural terrain blocks that wall.'};}
 for(const d of state.depots){if(pointSegmentDistance(d.x,d.y,a.x,a.y,b.x,b.y)<d.r+half+2)return{ok:false,msg:'A crystal depot blocks that wall.'};}
 for(const s of state.structures){
  if(s.type==='wall'){
   // Avoid walls crossing or stacking each other.
   const samples=12;
   for(let i=0;i<=samples;i++){
    const t=i/samples,px=a.x+(b.x-a.x)*t,py=a.y+(b.y-a.y)*t;
    if(pointSegmentDistance(px,py,s.x1,s.y1,s.x2,s.y2)<half+wallThickness(s)/2+3)return{ok:false,msg:'That wall overlaps another wall.'};
   }
  }else if(pointSegmentDistance(s.x,s.y,a.x,a.y,b.x,b.y)<structureRadius(s)+half+3)return{ok:false,msg:'A building blocks that wall.'};
 }
 return{ok:true};
}

function clearWallDraft(){wallDraft=null;wallConfirm.classList.add('hidden');}
function openWallConfirm(a,b){
 const length=Math.hypot(b.x-a.x,b.y-a.y),cost=wallPrice(length),buildTime=wallTime(length);
 wallDraft={start:a,current:b,pending:{a,b,length,cost,buildTime}};
 wallLengthEl.textContent=`${Math.round(length)} px`;
 wallCostEl.textContent=cost;
 wallBuildTimeEl.textContent=buildTime.toFixed(1);
 wallAccept.disabled=false;
 wallConfirm.classList.remove('hidden');
}
function handleWallTap(x,y){
 if(!wallDraft||!wallDraft.start){
  wallDraft={start:{x,y},current:{x,y},pending:null};
  els.message.textContent='Wall start set. Move to the end point and click/tap again.';
  return;
 }
 const a=wallDraft.start,b={x,y},valid=wallSegmentValid(a,b);
 if(!valid.ok){els.message.textContent=valid.msg;return;}
 if(freeWorkers()<=0){els.message.textContent=`All ${CONFIG.WORKERS.COUNT} workers are busy.`;return;}
 openWallConfirm(a,b);
}

wallCancel.onclick=()=>{clearWallDraft();els.message.textContent='Wall cancelled.';};
wallAccept.onclick=()=>{
 if(!wallDraft||!wallDraft.pending)return;
 const p=wallDraft.pending,valid=wallSegmentValid(p.a,p.b);
 if(!valid.ok){els.message.textContent=valid.msg;clearWallDraft();return;}
 if(freeWorkers()<=0){els.message.textContent=`All ${CONFIG.WORKERS.COUNT} workers are busy.`;clearWallDraft();return;}
 if(!state.debug.unlimitedCash&&state.credits<p.cost){els.message.textContent=`Need ${p.cost} credits for this wall.`;clearWallDraft();return;}
 if(!state.debug.unlimitedCash)state.credits-=p.cost;
 const x=(p.a.x+p.b.x)/2,y=(p.a.y+p.b.y)/2,hp=wallHp(p.length);
 state.structures.push({
  id:'w'+Date.now()+Math.random(),type:'wall',x,y,x1:p.a.x,y1:p.a.y,x2:p.b.x,y2:p.b.y,
  length:p.length,thickness:CONFIG.WALL.THICKNESS,hp,maxHp:hp,built:false,
  buildTime:p.buildTime,buildRemaining:p.buildTime,cool:0,protected:false,safeSpotId:null
 });
 els.message.textContent=`Wall construction started: ${Math.round(p.length)}px, ${p.cost} credits.`;
 clearWallDraft();updateHud();
};

// Keep the old RTS selection behavior, but intercept empty-map wall clicks.
const v14HandleTap=handleTap;
handleTap=function(x,y){
 if(state.gameOver||state.choosing)return;
 const clicked=unitAt(x,y);
 if(clicked||state.selectedUnit||state.attachMode)return v14HandleTap(x,y);
 if(buildType==='wall')return handleWallTap(x,y);
 return v14HandleTap(x,y);
};

// Switching away from Wall cancels an unfinished draft.
document.querySelectorAll('.buildBtn').forEach(b=>b.addEventListener('click',()=>{
 if(b.dataset.type!=='wall'&&wallDraft)clearWallDraft();
}));
els.restart.addEventListener('click',()=>clearWallDraft());

// Track the actual world position under the pointer for preview + alignment marker.
canvas.addEventListener('pointermove',e=>{
 cursorWorld=worldFromEvent(e);
 if(buildType==='wall'&&wallDraft&&wallDraft.start&&!wallDraft.pending){wallDraft.current={x:cursorWorld.x,y:cursorWorld.y};}
});
canvas.addEventListener('pointerdown',e=>{cursorWorld=worldFromEvent(e);});
canvas.addEventListener('pointerleave',()=>{if(!pointer)cursorWorld=null;});

// -----------------------------------------------------------------------------
// 5) WALL DRAWING.
// -----------------------------------------------------------------------------
const v14DrawStructure=drawStructure;
drawStructure=function(s){
 if(s.type!=='wall')return v14DrawStructure(s);
 const len=wallLength(s),a=Math.atan2(s.y2-s.y1,s.x2-s.x1),ratio=s.built?1:Math.max(0,1-s.buildRemaining/s.buildTime);
 ctx.save();
 ctx.translate(s.x1,s.y1);ctx.rotate(a);
 if(!s.built){
  ctx.strokeStyle='rgba(240,210,105,.95)';ctx.lineWidth=s.thickness;ctx.setLineDash([12,8]);
  ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(len,0);ctx.stroke();ctx.setLineDash([]);
  ctx.strokeStyle='#f3d66e';ctx.lineWidth=Math.max(4,s.thickness-6);ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(len*ratio,0);ctx.stroke();
 }else{
  ctx.strokeStyle='#17242e';ctx.lineWidth=s.thickness+5;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(len,0);ctx.stroke();
  ctx.strokeStyle='#60798b';ctx.lineWidth=s.thickness;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(len,0);ctx.stroke();
  ctx.strokeStyle='#9cb3c1';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,-s.thickness*.32);ctx.lineTo(len,-s.thickness*.32);ctx.stroke();
 }
 ctx.restore();
 // HP/build progress at wall midpoint.
 ctx.save();ctx.translate(s.x,s.y);
 if(!s.built){ctx.fillStyle='#f8e9a8';ctx.font='bold 10px Arial';ctx.textAlign='center';ctx.fillText(`${Math.round(ratio*100)}%`,0,-16);}
 else if(s.hp<s.maxHp){ctx.fillStyle='#111';ctx.fillRect(-30,-18,60,5);ctx.fillStyle='#ef6666';ctx.fillRect(-30,-18,60*Math.max(0,s.hp/s.maxHp),5);}
 ctx.restore();
};

// Walls participate in enemy targeting. Distance is measured to the segment,
// not the wall midpoint.
closestAttackTarget=function(e,maxRange,includeProtected){
 let best=null,bd=Infinity;
 for(const s of state.structures){
  if(!s.built)continue;
  if(!includeProtected&&s.protected)continue;
  const d=s.type==='wall'?pointSegmentDistance(e.x,e.y,s.x1,s.y1,s.x2,s.y2):Math.hypot(e.x-s.x,e.y-s.y);
  if(d<maxRange&&d<bd){best=s;bd=d;}
 }
 for(const u of state.units){const d=Math.hypot(e.x-u.x,e.y-u.y);if(d<maxRange&&d<bd){best=u;bd=d;}}
 return best;
};

const v14StructureOrUnitRadius=structureOrUnitRadius;
structureOrUnitRadius=function(t){
 if(t.type==='wall')return wallLength(t)/2+wallThickness(t)/2;
 return v14StructureOrUnitRadius(t);
};

// -----------------------------------------------------------------------------
// 6) VISIBLE PLACEMENT MARKER + WALL PREVIEW.
// -----------------------------------------------------------------------------

const v14Draw=draw;
draw=function(){
 v14Draw();
 ctx.save();ctx.translate(-state.camera.x,-state.camera.y);

 if(wallDraft&&wallDraft.start){
  const end=wallDraft.pending?wallDraft.pending.b:(wallDraft.current||wallDraft.start),valid=wallSegmentValid(wallDraft.start,end),len=Math.hypot(end.x-wallDraft.start.x,end.y-wallDraft.start.y);
  ctx.strokeStyle=valid.ok?'rgba(104,235,137,.95)':'rgba(255,90,95,.95)';ctx.lineWidth=CONFIG.WALL.THICKNESS;ctx.globalAlpha=.52;
  ctx.beginPath();ctx.moveTo(wallDraft.start.x,wallDraft.start.y);ctx.lineTo(end.x,end.y);ctx.stroke();ctx.globalAlpha=1;
  ctx.fillStyle=valid.ok?'#a9f6b9':'#ffb0b4';ctx.font='bold 12px Arial';ctx.textAlign='center';ctx.fillText(`${Math.round(len)}px · ${wallPrice(len)} credits`,(wallDraft.start.x+end.x)/2,(wallDraft.start.y+end.y)/2-18);
 }

 if(cursorWorld&&!state.selectedUnit&&!state.choosing&&!state.gameOver&&buildType!=='wall'){
  const def=BUILD[buildType],r=def?.radius||22;
  let blocked=false;
  if(def?.kind==='unit')blocked=!isWorldInside(cursorWorld.x,cursorWorld.y,r)||pointBlockedByTerrain(cursorWorld.x,cursorWorld.y,r)||Math.hypot(cursorWorld.x-BASE_X,cursorWorld.y-BASE_Y)<BASE_RADIUS+r+4;
  else if(buildType==='mine')blocked=!findMineDepotForPlacement(cursorWorld.x,cursorWorld.y)||placementBlocked(cursorWorld.x,cursorWorld.y,r,'mine');
  else blocked=placementBlocked(cursorWorld.x,cursorWorld.y,r,buildType);
  ctx.strokeStyle=blocked?'#ff5d63':'#78f19a';ctx.lineWidth=2;ctx.beginPath();ctx.arc(cursorWorld.x,cursorWorld.y,r,0,Math.PI*2);ctx.stroke();
  ctx.fillStyle=blocked?'rgba(255,70,80,.12)':'rgba(90,235,130,.10)';ctx.fill();
 }
 ctx.restore();
};

// Refresh button states now that BUILD.wall exists.
updateHud();
