// Alien Planet Defense v17 - Backlog batch 1
// Rifleman rebalance + Heavy Gunner, Rocketeer, Medic, Railgun and Tesla.
// This patch deliberately keeps all combat squads internally as type:'soldier'
// so the existing RTS selection, pathfinding, truck escort and enemy-targeting
// systems continue to work without special cases.

BUILD.soldier.label='Rifleman Squad';
BUILD.soldier.cost=CONFIG.SOLDIER.COST;
BUILD.heavygunner={kind:'unit',cost:CONFIG.HEAVY_GUNNER.COST,currency:'gold',label:'Heavy Gunner',radius:24};
BUILD.rocketeer={kind:'unit',cost:CONFIG.ROCKETEER.COST,currency:'gold',label:'Rocketeer Squad',radius:23};
BUILD.medic={kind:'unit',cost:CONFIG.MEDIC.COST,currency:'gold',label:'Medic Squad',radius:22};
BUILD.railgun={kind:'structure',cost:CONFIG.RAILGUN.COST,currency:'metal',label:'Railgun Tower',radius:25,buildTime:CONFIG.BUILD_TIME.RAILGUN};
BUILD.tesla={kind:'structure',cost:CONFIG.TESLA.COST,currency:'metal',label:'Tesla Tower',radius:24,buildTime:CONFIG.BUILD_TIME.TESLA};

function unitRole(u){return u.type==='soldier'?(u.role||'rifleman'):u.type;}
function unitDisplayName(u){
 if(u.type==='truck')return 'Logistics Truck';
 const r=unitRole(u);
 if(r==='heavygunner')return 'Heavy Gunner';
 if(r==='rocketeer')return 'Rocketeer Squad';
 if(r==='medic')return 'Medic Squad';
 return 'Rifleman Squad';
}
function roleConfig(u){
 const r=unitRole(u);
 if(r==='heavygunner')return CONFIG.HEAVY_GUNNER;
 if(r==='rocketeer')return CONFIG.ROCKETEER;
 if(r==='medic')return CONFIG.MEDIC;
 return CONFIG.SOLDIER;
}

// -----------------------------------------------------------------------------
// BUILDING / UNIT PLACEMENT
// -----------------------------------------------------------------------------
const v16PlaceBuildV17=placeBuild;
placeBuild=function(x,y){
 const unitTypes=['heavygunner','rocketeer','medic'];
 if(unitTypes.includes(buildType)){
  const def=BUILD[buildType],cfg=buildType==='heavygunner'?CONFIG.HEAVY_GUNNER:buildType==='rocketeer'?CONFIG.ROCKETEER:CONFIG.MEDIC;
  if(!isWorldInside(x,y,def.radius)||navPointBlocked(x,y,def.radius)){
   els.message.textContent='Unit deployment point is blocked.';return;
  }
  if(!payResource('gold',def.cost)){els.message.textContent=`Need ${def.cost} gold.`;return;}
  const members=cfg.MEMBERS||1;
  state.units.push({
   id:'u'+Date.now()+Math.random(),type:'soldier',role:buildType,x,y,hp:cfg.HP,maxHp:cfg.HP,
   moveTarget:null,path:[],heading:0,attachedTo:null,attachSlot:0,
   cooldowns:Array(members).fill(0).map(()=>Math.random()*.35),healFxCooldown:0
  });
  els.message.textContent=`${def.label} deployed.`;updateHud();return;
 }
 if(buildType==='railgun'||buildType==='tesla'){
  const def=BUILD[buildType];
  if(freeWorkers()<=0){els.message.textContent=`All ${CONFIG.WORKERS.COUNT} workers are busy.`;return;}
  let px=x,py=y,pad=null;
  if(typeof findSafeSpotAt==='function')pad=findSafeSpotAt(x,y);
  if(pad){px=pad.x;py=pad.y;}
  if(placementBlocked(px,py,def.radius,buildType,pad?pad.id:null)){
   els.message.textContent='That tower location is blocked.';return;
  }
  if(!payResource('metal',def.cost)){els.message.textContent=`Need ${def.cost} metal.`;return;}
  const cfg=buildType==='railgun'?CONFIG.RAILGUN:CONFIG.TESLA;
  const s={
   id:'t'+Date.now()+Math.random(),type:buildType,x:px,y:py,hp:cfg.HP,maxHp:cfg.HP,
   built:false,buildTime:def.buildTime,buildRemaining:def.buildTime,cool:Math.random()*.4,
   protected:!!pad,safeSpotId:pad?pad.id:null
  };
  if(pad)pad.occupied=true;
  state.structures.push(s);
  els.message.textContent=`${def.label} construction started (${def.buildTime.toFixed(1)}s).`;
  updateHud();return;
 }
 return v16PlaceBuildV17(x,y);
};

// Correct the old selection message for the new squad roles.
const v16HandleTapV17=handleTap;
handleTap=function(x,y){
 const clicked=unitAt(x,y);
 v16HandleTapV17(x,y);
 if(clicked&&state.selectedUnit===clicked&&!state.attachMode){
  els.message.textContent=`${unitDisplayName(clicked)} selected.`;
 }
};

// -----------------------------------------------------------------------------
// COMBAT EFFECTS
// -----------------------------------------------------------------------------
function fxPush(fx){if(!state.v17Effects)state.v17Effects=[];state.v17Effects.push(fx);}
function linePointDistance(px,py,x1,y1,x2,y2){return pointSegmentDistance(px,py,x1,y1,x2,y2);}
function nearestEnemyExcept(x,y,range,used){
 let best=null,bd=range;
 for(const e of state.enemies){if(used.has(e))continue;const d=Math.hypot(e.x-x,e.y-y);if(d<bd){best=e;bd=d;}}
 return best;
}

// Replace the generic soldier combat because all new squad classes intentionally
// share the legacy type:'soldier' for RTS compatibility.
updateUnitCombat=function(dt){
 for(const u of state.units){
  if(u.type!=='soldier'||u.hp<=0)continue;
  const role=unitRole(u),cfg=roleConfig(u);

  if(role==='medic'){
   u.healFxCooldown=Math.max(0,(u.healFxCooldown||0)-dt);
   let target=null,best=1;
   const friendlies=[...state.units,...state.structures.filter(s=>s.built)];
   for(const f of friendlies){
    if(f===u||!f.maxHp||f.hp>=f.maxHp)continue;
    const d=Math.hypot(f.x-u.x,f.y-u.y);if(d>cfg.HEAL_RANGE)continue;
    const ratio=f.hp/f.maxHp;if(ratio<best){best=ratio;target=f;}
   }
   if(target){
    target.hp=Math.min(target.maxHp,target.hp+cfg.HEAL_PER_SECOND*dt);
    if(u.healFxCooldown<=0){fxPush({kind:'heal',x1:u.x,y1:u.y,x2:target.x,y2:target.y,expires:performance.now()+150});u.healFxCooldown=.28;}
   }
   continue;
  }

  const members=cfg.MEMBERS||1;
  while(u.cooldowns.length<members)u.cooldowns.push(Math.random()*.2);
  if(u.cooldowns.length>members)u.cooldowns.length=members;
  for(let i=0;i<members;i++){
   u.cooldowns[i]-=dt;if(u.cooldowns[i]>0)continue;
   const target=findTarget(u.x,u.y,cfg.RANGE);if(!target)continue;
   const off=SOLDIER_OFFSETS[i%SOLDIER_OFFSETS.length]||[0,0];
   if(role==='rocketeer'){
    const victims=[...state.enemies].filter(e=>Math.hypot(e.x-target.x,e.y-target.y)<=cfg.SPLASH_RADIUS);
    for(const e of victims){const falloff=.55+.45*(1-Math.min(1,Math.hypot(e.x-target.x,e.y-target.y)/cfg.SPLASH_RADIUS));hitEnemy(e,cfg.DAMAGE*falloff);}
    fxPush({kind:'rocket',x1:u.x+off[0],y1:u.y+off[1],x2:target.x,y2:target.y,r:cfg.SPLASH_RADIUS,expires:performance.now()+190});
   }else{
    shoot(u.x+off[0],u.y+off[1],target,role==='heavygunner'?'heavy':'soldier',cfg.DAMAGE,CONFIG.SOLDIER.BULLET_SPEED);
   }
   u.cooldowns[i]=cfg.FIRE_INTERVAL*(.9+Math.random()*.2);
  }
 }
};

// Existing Laser/Flame behavior remains untouched; add backlog towers after it.
const v16UpdateTowersV17=updateTowers;
updateTowers=function(dt){
 v16UpdateTowersV17(dt);
 for(const s of state.structures){
  if(!s.built||s.hp<=0||(s.type!=='railgun'&&s.type!=='tesla'))continue;
  s.cool-=dt;if(s.cool>0)continue;
  if(s.type==='railgun'){
   const cfg=CONFIG.RAILGUN,target=findTarget(s.x,s.y,cfg.RANGE);if(!target)continue;
   const dx=target.x-s.x,dy=target.y-s.y,d=Math.hypot(dx,dy)||1,ex=s.x+dx/d*cfg.RANGE,ey=s.y+dy/d*cfg.RANGE;
   const candidates=[...state.enemies].filter(e=>{
    const along=((e.x-s.x)*dx+(e.y-s.y)*dy)/d;
    return along>=0&&along<=cfg.RANGE&&linePointDistance(e.x,e.y,s.x,s.y,ex,ey)<=cfg.PIERCE_WIDTH;
   }).sort((a,b)=>Math.hypot(a.x-s.x,a.y-s.y)-Math.hypot(b.x-s.x,b.y-s.y)).slice(0,cfg.MAX_TARGETS);
   for(const e of candidates)hitEnemy(e,cfg.DAMAGE);
   fxPush({kind:'rail',x1:s.x,y1:s.y,x2:ex,y2:ey,expires:performance.now()+120});
   s.cool=cfg.FIRE_INTERVAL;
  }else{
   const cfg=CONFIG.TESLA,first=findTarget(s.x,s.y,cfg.RANGE);if(!first)continue;
   const used=new Set(),points=[{x:s.x,y:s.y}];let cur=first,damage=cfg.DAMAGE;
   for(let i=0;i<cfg.CHAINS&&cur;i++){
    used.add(cur);points.push({x:cur.x,y:cur.y});hitEnemy(cur,damage);damage*=cfg.CHAIN_DAMAGE_MULTIPLIER;
    cur=nearestEnemyExcept(points[points.length-1].x,points[points.length-1].y,cfg.CHAIN_RANGE,used);
   }
   fxPush({kind:'tesla',points,expires:performance.now()+145});s.cool=cfg.FIRE_INTERVAL;
  }
 }
};

// -----------------------------------------------------------------------------
// DRAWING
// -----------------------------------------------------------------------------
const v16DrawUnitV17=drawUnit;
drawUnit=function(u){
 const role=unitRole(u);
 if(u.type!=='soldier'||role==='rifleman')return v16DrawUnitV17(u);
 const cfg=roleConfig(u);
 ctx.save();ctx.translate(u.x,u.y);
 if(u.path&&u.path.length){ctx.setLineDash([8,6]);ctx.strokeStyle='rgba(96,225,255,.8)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,0);for(const p of u.path)ctx.lineTo(p.x-u.x,p.y-u.y);ctx.stroke();ctx.setLineDash([]);}
 if(role==='heavygunner'){
  ctx.fillStyle='#2c3440';ctx.beginPath();ctx.arc(0,0,24,0,Math.PI*2);ctx.fill();
  for(let i=0;i<cfg.MEMBERS;i++){const a=i/cfg.MEMBERS*Math.PI*2,sx=Math.cos(a)*10,sy=Math.sin(a)*10;ctx.fillStyle='#d1b48a';ctx.beginPath();ctx.arc(sx,sy-3,3.4,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#ffcf70';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(sx+2,sy);ctx.lineTo(sx+12,sy-2);ctx.stroke();}
 }else if(role==='rocketeer'){
  ctx.fillStyle='#34412c';ctx.beginPath();ctx.arc(0,0,23,0,Math.PI*2);ctx.fill();
  for(let i=0;i<cfg.MEMBERS;i++){const a=i/cfg.MEMBERS*Math.PI*2,sx=Math.cos(a)*11,sy=Math.sin(a)*9;ctx.fillStyle='#d8d0b8';ctx.beginPath();ctx.arc(sx,sy-3,3.2,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#ff8b4a';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(sx+1,sy);ctx.lineTo(sx+10,sy-7);ctx.stroke();}
 }else{
  ctx.fillStyle='#24434a';ctx.beginPath();ctx.arc(0,0,22,0,Math.PI*2);ctx.fill();ctx.fillStyle='#dff8f2';ctx.fillRect(-5,-14,10,28);ctx.fillRect(-14,-5,28,10);ctx.strokeStyle='#76e8d4';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,17,0,Math.PI*2);ctx.stroke();
 }
 if(u.attachedTo){ctx.strokeStyle='#d2a8ff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,28,0,Math.PI*2);ctx.stroke();}
 if(state.selectedUnit===u){ctx.strokeStyle='#ffe47b';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,31,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#f7eaa5';ctx.font='bold 9px Arial';ctx.textAlign='center';ctx.fillText(unitDisplayName(u).toUpperCase(),0,-35);}
 if(u.hp<u.maxHp){ctx.fillStyle='#111';ctx.fillRect(-22,31,44,4);ctx.fillStyle='#ef6666';ctx.fillRect(-22,31,44*Math.max(0,u.hp/u.maxHp),4);}
 ctx.restore();
};

const v16DrawStructureV17=drawStructure;
drawStructure=function(s){
 if(s.type!=='railgun'&&s.type!=='tesla')return v16DrawStructureV17(s);
 if(!s.built){drawConstruction(s);return;}
 const cfg=s.type==='railgun'?CONFIG.RAILGUN:CONFIG.TESLA;
 ctx.save();ctx.translate(s.x,s.y);
 if(state.showReach){ctx.strokeStyle='rgba(170,225,255,.25)';ctx.lineWidth=1;ctx.beginPath();ctx.arc(0,0,cfg.RANGE,0,Math.PI*2);ctx.stroke();}
 if(s.protected){ctx.strokeStyle='#72e6ff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,31,0,Math.PI*2);ctx.stroke();}
 if(s.type==='railgun'){
  ctx.fillStyle='#202e39';ctx.beginPath();ctx.arc(0,0,22,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#83dfff';ctx.lineWidth=3;ctx.stroke();ctx.fillStyle='#b7ecff';ctx.fillRect(-5,-29,10,34);ctx.fillStyle='#425c6e';ctx.fillRect(-10,-7,20,10);
 }else{
  ctx.fillStyle='#26313a';ctx.beginPath();ctx.arc(0,0,21,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#a688ff';ctx.lineWidth=3;ctx.stroke();for(let i=0;i<4;i++){const a=i*Math.PI/2;ctx.fillStyle='#8e72eb';ctx.beginPath();ctx.arc(Math.cos(a)*12,Math.sin(a)*12,5,0,Math.PI*2);ctx.fill();}ctx.fillStyle='#d8cbff';ctx.beginPath();ctx.arc(0,0,6,0,Math.PI*2);ctx.fill();
 }
 if(s.hp<s.maxHp){ctx.fillStyle='#111';ctx.fillRect(-24,32,48,4);ctx.fillStyle='#ef6666';ctx.fillRect(-24,32,48*Math.max(0,s.hp/s.maxHp),4);}
 ctx.restore();
};

function drawV17Effects(){
 if(!state.v17Effects)return;const now=performance.now();state.v17Effects=state.v17Effects.filter(f=>f.expires>now);
 ctx.save();ctx.translate(-state.camera.x,-state.camera.y);
 for(const f of state.v17Effects){
  const alpha=Math.max(.15,(f.expires-now)/190);ctx.globalAlpha=alpha;
  if(f.kind==='rail'){
   ctx.strokeStyle='#bdefff';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(f.x1,f.y1);ctx.lineTo(f.x2,f.y2);ctx.stroke();ctx.strokeStyle='#ffffff';ctx.lineWidth=1.5;ctx.stroke();
  }else if(f.kind==='tesla'){
   ctx.strokeStyle='#b59cff';ctx.lineWidth=3;for(let i=1;i<f.points.length;i++){const a=f.points[i-1],b=f.points[i],steps=6;ctx.beginPath();ctx.moveTo(a.x,a.y);for(let j=1;j<steps;j++){const t=j/steps,x=a.x+(b.x-a.x)*t+(Math.random()-.5)*13,y=a.y+(b.y-a.y)*t+(Math.random()-.5)*13;ctx.lineTo(x,y);}ctx.lineTo(b.x,b.y);ctx.stroke();}
  }else if(f.kind==='rocket'){
   ctx.strokeStyle='#ffad58';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(f.x1,f.y1);ctx.lineTo(f.x2,f.y2);ctx.stroke();ctx.fillStyle='rgba(255,125,50,.25)';ctx.beginPath();ctx.arc(f.x2,f.y2,f.r,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#ff7045';ctx.stroke();
  }else if(f.kind==='heal'){
   ctx.strokeStyle='#80f2d3';ctx.lineWidth=3;ctx.setLineDash([5,5]);ctx.beginPath();ctx.moveTo(f.x1,f.y1);ctx.lineTo(f.x2,f.y2);ctx.stroke();ctx.setLineDash([]);
  }
 }
 ctx.restore();ctx.globalAlpha=1;
}
const v16DrawV17=draw;
draw=function(){v16DrawV17();drawV17Effects();};

// -----------------------------------------------------------------------------
// RESET / INITIALIZATION
// -----------------------------------------------------------------------------
const v16ResetV17=reset;
reset=function(){v16ResetV17();state.v17Effects=[];BUILD.soldier.label='Rifleman Squad';updateHud();};
els.restart.onclick=reset;

// Rebuild once so the active run definitely uses the v17 state shape.
reset();
