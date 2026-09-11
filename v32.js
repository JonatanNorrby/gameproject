// Alien Planet Defense v32
// Crystal-first Gold economy, traversable slow rivers, and fog of war.
document.title='Alien Planet Defense v32';

// -----------------------------------------------------------------------------
// ECONOMY: CRYSTAL EXPORTS SHOULD DOMINATE GOLD INCOME
// -----------------------------------------------------------------------------
CONFIG.CRYSTALS.GOLD_PER_CRYSTAL=4.0;
CONFIG.CRYSTALS.MONEY_PER_CRYSTAL=4.0;
const V32_KILL_GOLD={
 swarm:.20,ravager:.30,runner:.35,brute:1.25,spitter:.65,flyer:.75,
 siegebeast:4.0,burrower:1.0,climber:.55,acidlobber:1.4,crusher:2.4,
 harvesterhunter:.85,saboteur:1.25
};
const v31EnemyGoldRewardV32=enemyGoldReward;
enemyGoldReward=function(e){return V32_KILL_GOLD[e?.type]??Math.min(1,v31EnemyGoldRewardV32(e)*.15);};

// -----------------------------------------------------------------------------
// RIVERS
// Ground units/enemies may cross, but move at 50% speed while actually in water.
// Rivers are deliberately NOT part of pointBlockedByTerrain/navPointBlocked.
// -----------------------------------------------------------------------------
CONFIG.RIVERS={COUNT:2,MIN_WIDTH:72,MAX_WIDTH:105,SLOW_FACTOR:.50};

function riverSegmentDistance(x,y,a,b){return pointSegmentDistance(x,y,a.x,a.y,b.x,b.y);}
function riverDistanceToPoint(river,x,y){let best=Infinity;for(let i=1;i<river.points.length;i++)best=Math.min(best,riverSegmentDistance(x,y,river.points[i-1],river.points[i]));return best;}
function pointInRiver(x,y){for(const r of state.rivers||[])if(riverDistanceToPoint(r,x,y)<=r.width/2)return true;return false;}

function riverConflictsWithAssets(points,width){
 for(const d of state.depots||[])for(let i=1;i<points.length;i++)if(riverSegmentDistance(d.x,d.y,points[i-1],points[i])<d.r+width/2+34)return true;
 for(let i=1;i<points.length;i++)if(riverSegmentDistance(BASE_X,BASE_Y,points[i-1],points[i])<BASE_RADIUS+width/2+170)return true;
 return false;
}
function makeHorizontalRiver(baseY,index){
 for(let attempt=0;attempt<80;attempt++){
  const width=CONFIG.RIVERS.MIN_WIDTH+Math.random()*(CONFIG.RIVERS.MAX_WIDTH-CONFIG.RIVERS.MIN_WIDTH),pts=[],count=9,phase=Math.random()*Math.PI*2,amp=95+Math.random()*85;
  for(let i=0;i<count;i++){
   const t=i/(count-1),x=-80+t*(WORLD_W+160),jitter=(Math.random()-.5)*70,y=baseY+Math.sin(t*Math.PI*2.1+phase)*amp+jitter;
   pts.push({x,y:Math.max(width,Math.min(WORLD_H-width,y))});
  }
  if(!riverConflictsWithAssets(pts,width))return{id:`river-${index}-${Math.random()}`,points:pts,width};
 }
 return{id:`river-${index}`,points:[{x:-50,y:baseY},{x:WORLD_W+50,y:baseY}],width:82};
}
function generateRivers(){
 const top=makeHorizontalRiver(430+Math.random()*250,1),bottom=makeHorizontalRiver(1740+Math.random()*260,2);
 return[top,bottom];
}

const v31DrawBackdropV32=drawBackdrop;
drawBackdrop=function(){
 v31DrawBackdropV32();
 if(!state.rivers?.length)return;
 ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
 for(const r of state.rivers){
  ctx.strokeStyle='rgba(8,27,43,.95)';ctx.lineWidth=r.width+18;ctx.beginPath();ctx.moveTo(r.points[0].x,r.points[0].y);for(let i=1;i<r.points.length;i++)ctx.lineTo(r.points[i].x,r.points[i].y);ctx.stroke();
  ctx.strokeStyle='#1d5570';ctx.lineWidth=r.width;ctx.beginPath();ctx.moveTo(r.points[0].x,r.points[0].y);for(let i=1;i<r.points.length;i++)ctx.lineTo(r.points[i].x,r.points[i].y);ctx.stroke();
  ctx.strokeStyle='rgba(111,202,227,.20)';ctx.lineWidth=Math.max(4,r.width*.17);ctx.setLineDash([32,38]);ctx.beginPath();ctx.moveTo(r.points[0].x,r.points[0].y);for(let i=1;i<r.points.length;i++)ctx.lineTo(r.points[i].x,r.points[i].y);ctx.stroke();ctx.setLineDash([]);
 }
 ctx.restore();
};

const v31UnitSpeedV32=unitSpeed;
unitSpeed=function(u){const base=v31UnitSpeedV32(u);if(!u||isFlyingUnit(u))return base;return pointInRiver(u.x,u.y)?base*CONFIG.RIVERS.SLOW_FACTOR:base;};

const v31UpdateEnemiesV32=updateEnemies;
updateEnemies=function(dt){
 const slowed=[];
 for(const e of state.enemies){if(e.type==='flyer'||e.burrowed)continue;if(pointInRiver(e.x,e.y)){slowed.push([e,e.speed]);e.speed*=CONFIG.RIVERS.SLOW_FACTOR;}}
 try{v31UpdateEnemiesV32(dt);}finally{for(const [e,speed] of slowed)if(state.enemies.includes(e))e.speed=speed;}
};

// Keep the platoon movement rule coherent through rivers: if any member's adjusted
// speed becomes the slowest, every member receives that effective speed.
const v32RiverUnitSpeedBase=unitSpeed;
unitSpeed=function(u){
 if(u?.platoonId&&typeof platoonMembers==='function'&&typeof canUsePlatoon==='function'){
  const members=platoonMembers(u.platoonId).filter(canUsePlatoon);
  if(members.length>=2){
   return Math.min(...members.map(m=>{
    const own=typeof v28UnitSpeedV29==='function'?v28UnitSpeedV29(m):v31UnitSpeedV32(m);
    return (!isFlyingUnit(m)&&pointInRiver(m.x,m.y))?own*CONFIG.RIVERS.SLOW_FACTOR:own;
   }));
  }
 }
 return v32RiverUnitSpeedBase(u);
};

// -----------------------------------------------------------------------------
// FOG OF WAR
// Black = unexplored. Dim = explored but not currently visible.
// Enemies are not rendered (or shown in incoming arrows) outside current vision.
// -----------------------------------------------------------------------------
const FOG_CELL=80,FOG_COLS=Math.ceil(WORLD_W/FOG_CELL),FOG_ROWS=Math.ceil(WORLD_H/FOG_CELL);
const fogCanvasV32=document.createElement('canvas');fogCanvasV32.width=W;fogCanvasV32.height=H;const fogCtxV32=fogCanvasV32.getContext('2d');

function v32UnitVision(u){
 const r=unitRole(u),cfg=roleConfig(u)||{};
 if(r==='scout')return 440;if(r==='spotter')return 420;if(r==='sniper')return 500;
 if(isFlyingUnit(u))return 330;
 return Math.max(235,(cfg.RANGE||0)+55,cfg.DETECT_RANGE||0,cfg.SPOT_RANGE||0);
}
function v32StructureVision(s){
 if(!s.built)return 0;
 if(typeof isUpgradeableTower==='function'&&isUpgradeableTower(s)){try{return Math.max(250,(towerStats(s)?.range||0)+45);}catch{} }
 if(s.type==='landingpad')return 300;if(s.type==='refinery'||s.type==='bunker')return 250;if(s.type==='mine'||s.type==='oremine')return 185;
 return s.type==='wall'?0:210;
}
function refreshFogSourcesV32(){
 const src=[{x:BASE_X,y:BASE_Y,r:360}];
 for(const u of state.units){if(u.hp<=0||u.transportedIn)continue;if(u.garrisonedIn)continue;src.push({x:u.x,y:u.y,r:v32UnitVision(u)});}
 for(const s of state.structures){const r=v32StructureVision(s);if(r>0&&s.hp>0)src.push({x:s.x,y:s.y,r});}
 state.v32VisionSources=src;
 if(!state.fogExplored||state.fogExplored.length!==FOG_COLS*FOG_ROWS)state.fogExplored=new Uint8Array(FOG_COLS*FOG_ROWS);
 for(const v of src){
  const c0=Math.max(0,Math.floor((v.x-v.r)/FOG_CELL)),c1=Math.min(FOG_COLS-1,Math.floor((v.x+v.r)/FOG_CELL)),r0=Math.max(0,Math.floor((v.y-v.r)/FOG_CELL)),r1=Math.min(FOG_ROWS-1,Math.floor((v.y+v.r)/FOG_CELL));
  for(let gy=r0;gy<=r1;gy++)for(let gx=c0;gx<=c1;gx++){const cx=gx*FOG_CELL+FOG_CELL/2,cy=gy*FOG_CELL+FOG_CELL/2;if(Math.hypot(cx-v.x,cy-v.y)<=v.r+FOG_CELL*.72)state.fogExplored[gy*FOG_COLS+gx]=1;}
 }
}
function pointVisibleV32(x,y){for(const v of state.v32VisionSources||[])if(Math.hypot(x-v.x,y-v.y)<=v.r)return true;return false;}

const v31DrawEnemyV32=drawEnemy;
drawEnemy=function(e){if(!pointVisibleV32(e.x,e.y))return;return v31DrawEnemyV32(e);};

const v31IncomingV32=drawIncomingEnemyArrows;
drawIncomingEnemyArrows=function(){const all=state.enemies;state.enemies=all.filter(e=>pointVisibleV32(e.x,e.y));try{return v31IncomingV32();}finally{state.enemies=all;}};

function drawFogOverlayV32(){
 const z=typeof v31ZoomValue==='function'?v31ZoomValue():(state.camera.zoom||1),cam=state.camera,fc=fogCtxV32;
 fc.setTransform(1,0,0,1,0,0);fc.clearRect(0,0,W,H);
 const wx0=cam.x,wy0=cam.y,wx1=cam.x+W/z,wy1=cam.y+H/z,c0=Math.max(0,Math.floor(wx0/FOG_CELL)),c1=Math.min(FOG_COLS-1,Math.floor(wx1/FOG_CELL)),r0=Math.max(0,Math.floor(wy0/FOG_CELL)),r1=Math.min(FOG_ROWS-1,Math.floor(wy1/FOG_CELL));
 for(let gy=r0;gy<=r1;gy++)for(let gx=c0;gx<=c1;gx++){
  const explored=state.fogExplored?.[gy*FOG_COLS+gx],sx=(gx*FOG_CELL-cam.x)*z,sy=(gy*FOG_CELL-cam.y)*z,sz=FOG_CELL*z+1;
  fc.fillStyle=explored?'rgba(1,7,11,.58)':'rgba(0,2,4,.96)';fc.fillRect(sx,sy,sz,sz);
 }
 fc.globalCompositeOperation='destination-out';
 for(const v of state.v32VisionSources||[]){
  const sx=(v.x-cam.x)*z,sy=(v.y-cam.y)*z,rr=v.r*z;if(sx+rr<0||sy+rr<0||sx-rr>W||sy-rr>H)continue;
  const g=fc.createRadialGradient(sx,sy,rr*.72,sx,sy,rr);g.addColorStop(0,'rgba(0,0,0,1)');g.addColorStop(.82,'rgba(0,0,0,.92)');g.addColorStop(1,'rgba(0,0,0,0)');fc.fillStyle=g;fc.beginPath();fc.arc(sx,sy,rr,0,Math.PI*2);fc.fill();
 }
 fc.globalCompositeOperation='source-over';ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.drawImage(fogCanvasV32,0,0);ctx.restore();
}

const v31DrawV32=draw;
draw=function(){refreshFogSourcesV32();v31DrawV32();drawFogOverlayV32();};

// -----------------------------------------------------------------------------
// RESET / GUIDE
// -----------------------------------------------------------------------------
const v31ResetV32=reset;
reset=function(){v31ResetV32();state.rivers=generateRivers();state.fogExplored=new Uint8Array(FOG_COLS*FOG_ROWS);state.v32VisionSources=[];refreshFogSourcesV32();updateHud();};
els.restart.onclick=reset;

if(typeof guideBoxByTitle==='function'){
 const gold=guideBoxByTitle('Gold & Metal');if(gold)gold.querySelector('p').textContent='Enemy kills now give only small combat bounties. Crystal export is the main Gold economy: each exported Crystal is worth 4 Gold, so a full 220-Crystal ship pays 880 Gold. Ore logistics still create Metal for defenses and Crystal Mines.';
 const terrain=guideBoxByTitle('Resource Depots');if(terrain)terrain.querySelector('p').textContent+=' Rivers also cross the map: ground units and ground enemies can cross them but move at 50% speed while in the water; flying units and Flyers are unaffected.';
}
const guideGridV32=document.querySelector('#guidePanel .guide-grid');
if(guideGridV32){
 const river=document.createElement('div');river.className='guide-box';river.innerHTML='<b>Rivers</b><p>Rivers are traversable terrain rather than hard blockers. Ground units and enemies move at half speed while crossing. Combat Drones, Combat Ships and flying aliens ignore the slowdown.</p>';guideGridV32.appendChild(river);
 const fog=document.createElement('div');fog.className='guide-box';fog.innerHTML='<b>Fog of War</b><p>Unexplored territory is black. Previously explored territory remains dim until one of your units, the Base or a built structure provides vision again. Enemies outside current vision are hidden and do not create incoming-enemy arrows.</p>';guideGridV32.appendChild(fog);
}
const hintV32=document.getElementById('hint');if(hintV32)hintV32.textContent='Crystal exports are the main Gold source · rivers slow ground movement 50% · expand units/buildings to reveal fog of war.';

// Rebuild the preview/run state with rivers and fog initialized.
reset();
