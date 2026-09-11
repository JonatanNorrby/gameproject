// Alien Planet Defense v22
// Backlog batch: Anti-Air, Cryo, Mortar, Minigun, Missile, Drone Bay + Flyers.

const V22_NEW_TOWERS=new Set(['antiair','cryo','mortar','minigun','missile','dronebay']);
for(const t of V22_NEW_TOWERS)UPGRADEABLE_TOWERS.add(t);

BUILD.antiair={kind:'structure',cost:CONFIG.ANTI_AIR.COST,currency:'metal',label:'Anti-Air Cannon',radius:23,buildTime:CONFIG.BUILD_TIME.ANTI_AIR};
BUILD.cryo={kind:'structure',cost:CONFIG.CRYO.COST,currency:'metal',label:'Cryo Tower',radius:23,buildTime:CONFIG.BUILD_TIME.CRYO};
BUILD.mortar={kind:'structure',cost:CONFIG.MORTAR.COST,currency:'metal',label:'Mortar Tower',radius:24,buildTime:CONFIG.BUILD_TIME.MORTAR};
BUILD.minigun={kind:'structure',cost:CONFIG.MINIGUN.COST,currency:'metal',label:'Minigun Tower',radius:23,buildTime:CONFIG.BUILD_TIME.MINIGUN};
BUILD.missile={kind:'structure',cost:CONFIG.MISSILE.COST,currency:'metal',label:'Missile Tower',radius:25,buildTime:CONFIG.BUILD_TIME.MISSILE};
BUILD.dronebay={kind:'structure',cost:CONFIG.DRONE_BAY.COST,currency:'metal',label:'Drone Bay',radius:27,buildTime:CONFIG.BUILD_TIME.DRONE_BAY};

const v21TowerNameV22=towerName;
towerName=function(s){
 if(s.type==='antiair')return 'Anti-Air Cannon';
 if(s.type==='cryo')return 'Cryo Tower';
 if(s.type==='mortar')return 'Mortar Tower';
 if(s.type==='minigun')return 'Minigun Tower';
 if(s.type==='missile')return 'Missile Tower';
 if(s.type==='dronebay')return 'Drone Bay';
 return v21TowerNameV22(s);
};

const v21TowerBaseConfigV22=towerBaseConfig;
towerBaseConfig=function(s){
 if(s.type==='antiair')return CONFIG.ANTI_AIR;
 if(s.type==='cryo')return CONFIG.CRYO;
 if(s.type==='mortar')return CONFIG.MORTAR;
 if(s.type==='minigun')return CONFIG.MINIGUN;
 if(s.type==='missile')return CONFIG.MISSILE;
 if(s.type==='dronebay')return CONFIG.DRONE_BAY;
 return v21TowerBaseConfigV22(s);
};

const v21TowerStatsV22=towerStats;
towerStats=function(s){
 if(!V22_NEW_TOWERS.has(s.type))return v21TowerStatsV22(s);
 const l=towerLevel(s),c=towerBaseConfig(s);
 if(s.type==='antiair')return{range:c.RANGE*[1,1.10,1.18][l-1],damage:c.DAMAGE*[1,1.08,1.22][l-1],interval:c.FIRE_INTERVAL*[1,.95,.88][l-1],shots:[1,2,3][l-1],splash:[0,0,44][l-1]};
 if(s.type==='cryo')return{range:c.RANGE*[1,1.18,1.28][l-1],damage:c.DAMAGE*[1,1.25,1.80][l-1],interval:c.FIRE_INTERVAL*[1,.95,.86][l-1],slow:[c.SLOW_FACTOR,.58,.48][l-1],duration:c.SLOW_DURATION*[1,1.20,1.40][l-1],targets:[1,2,4][l-1]};
 if(s.type==='mortar')return{range:c.RANGE*[1,1.06,1.15][l-1],minRange:c.MIN_RANGE,damage:c.DAMAGE*[1,1.30,1.65][l-1],interval:c.FIRE_INTERVAL*[1,.94,.86][l-1],splash:c.SPLASH_RADIUS*[1,1.28,1.35][l-1],clusters:[0,0,3][l-1]};
 if(s.type==='minigun')return{range:c.RANGE*[1,1.12,1.22][l-1],damage:c.DAMAGE*[1,1.20,1.45][l-1],interval:c.FIRE_INTERVAL*[1,.75,.72][l-1],barrels:[1,1,2][l-1]};
 if(s.type==='missile')return{range:c.RANGE*[1,1.18,1.28][l-1],damage:c.DAMAGE*[1,1.35,1.55][l-1],interval:c.FIRE_INTERVAL*[1,.94,.82][l-1],splash:c.SPLASH_RADIUS*[1,1.25,1.35][l-1],salvo:[1,1,2][l-1]};
 return{range:c.RANGE*[1,1.15,1.28][l-1],damage:c.DAMAGE*[1,1.25,1.45][l-1],interval:c.FIRE_INTERVAL*[1,.94,.82][l-1],drones:[1,2,3][l-1]};
};

const v21TowerStatsTextV22=towerStatsText;
towerStatsText=function(s){
 if(!V22_NEW_TOWERS.has(s.type))return v21TowerStatsTextV22(s);
 const t=towerStats(s);
 if(s.type==='antiair')return `${Math.round(t.damage)} dmg · ${Math.round(t.range)} range · ${t.shots} round${t.shots===1?'':'s'}/burst · AIR ONLY`;
 if(s.type==='cryo')return `${Math.round(t.range)} range · ${t.targets} target${t.targets===1?'':'s'} · ${Math.round((1-t.slow)*100)}% slow`;
 if(s.type==='mortar')return `${Math.round(t.damage)} dmg · ${Math.round(t.range)} range · ${Math.round(t.splash)} blast${t.clusters?` · ${t.clusters} clusters`:''}`;
 if(s.type==='minigun')return `${Math.round(t.damage*10)/10} dmg · ${Math.round(t.range)} range · ${(1/t.interval).toFixed(1)}/s${t.barrels>1?' · DUAL':''}`;
 if(s.type==='missile')return `${Math.round(t.damage)} dmg · ${Math.round(t.range)} range · ${Math.round(t.splash)} blast · ${t.salvo} missile${t.salvo===1?'':'s'}`;
 return `${Math.round(t.damage)} dmg · ${Math.round(t.range)} range · ${t.drones} drone${t.drones===1?'':'s'} · ${(1/t.interval).toFixed(1)}/s`;
};

// -----------------------------------------------------------------------------
// Placement / construction
// -----------------------------------------------------------------------------
const v21PlaceBuildV22=placeBuild;
placeBuild=function(x,y){
 if(!V22_NEW_TOWERS.has(buildType))return v21PlaceBuildV22(x,y);
 const def=BUILD[buildType];
 if(freeWorkers()<=0){els.message.textContent=`All ${CONFIG.WORKERS.COUNT} workers are busy.`;return;}
 if(placementBlocked(x,y,def.radius,buildType)){els.message.textContent='That tower location is blocked.';return;}
 if(!payResource('metal',def.cost)){els.message.textContent=`Need ${def.cost} metal.`;return;}
 const cfg=towerBaseConfig({type:buildType});
 state.structures.push({id:'t'+Date.now()+Math.random(),type:buildType,x,y,hp:cfg.HP,maxHp:cfg.HP,built:false,buildTime:def.buildTime,buildRemaining:def.buildTime,cool:Math.random()*.3,protected:false,safeSpotId:null,level:1});
 els.message.textContent=`${def.label} construction started (${def.buildTime.toFixed(1)}s).`;
 updateHud();
};

// -----------------------------------------------------------------------------
// Target helpers / tower combat
// -----------------------------------------------------------------------------
function findTargetWhere(x,y,range,predicate,minRange=0){
 let best=null,bd=Infinity;
 for(const e of state.enemies){if(!predicate(e))continue;const d=Math.hypot(e.x-x,e.y-y);if(d<=range&&d>=minRange&&d<bd){best=e;bd=d;}}
 return best;
}
function nearestTargetsWhere(x,y,range,predicate,count,minRange=0){
 return [...state.enemies].filter(predicate).map(e=>({e,d:Math.hypot(e.x-x,e.y-y)})).filter(v=>v.d<=range&&v.d>=minRange).sort((a,b)=>a.d-b.d).slice(0,count).map(v=>v.e);
}
function damageArea(x,y,r,damage,predicate=()=>true){
 for(const e of [...state.enemies])if(predicate(e)&&Math.hypot(e.x-x,e.y-y)<=r)hitEnemy(e,damage);
}
function fx22(fx){if(!state.v22Effects)state.v22Effects=[];state.v22Effects.push(fx);}

const v21UpdateTowersV22=updateTowers;
updateTowers=function(dt){
 // Let v21 handle its original four towers, without treating new tower types as Tesla.
 const allStructures=state.structures;
 state.structures=allStructures.filter(s=>!V22_NEW_TOWERS.has(s.type));
 v21UpdateTowersV22(dt);
 state.structures=allStructures;

 for(const s of state.structures){
  if(!s.built||s.hp<=0||!V22_NEW_TOWERS.has(s.type))continue;
  if(!s.level)s.level=1;s.cool=(s.cool||0)-dt;if(s.cool>0)continue;
  const st=towerStats(s);

  if(s.type==='antiair'){
   const target=findTargetWhere(s.x,s.y,st.range,e=>e.type==='flyer');if(!target)continue;
   for(let i=0;i<st.shots;i++)shoot(s.x+(i-(st.shots-1)/2)*5,s.y,target,'antiair',st.damage,CONFIG.ANTI_AIR.BULLET_SPEED,.025);
   if(st.splash>0){for(const e of [...state.enemies])if(e!==target&&e.type==='flyer'&&Math.hypot(e.x-target.x,e.y-target.y)<=st.splash)hitEnemy(e,st.damage*.45);fx22({kind:'flak',x:target.x,y:target.y,r:st.splash,expires:performance.now()+150});}
   s.cool=st.interval;
  }else if(s.type==='cryo'){
   const targets=nearestTargetsWhere(s.x,s.y,st.range,()=>true,st.targets);if(!targets.length)continue;
   for(const e of targets){hitEnemy(e,st.damage);if(e.hp>0){e.slowFactor=Math.min(e.slowFactor??1,st.slow);e.slowTime=Math.max(e.slowTime||0,st.duration);}fx22({kind:'cryo',x1:s.x,y1:s.y,x2:e.x,y2:e.y,expires:performance.now()+135});}
   s.cool=st.interval;
  }else if(s.type==='mortar'){
   const target=findTargetWhere(s.x,s.y,st.range,e=>e.type!=='flyer',st.minRange);if(!target)continue;
   damageArea(target.x,target.y,st.splash,st.damage,e=>e.type!=='flyer');fx22({kind:'blast',x:target.x,y:target.y,r:st.splash,expires:performance.now()+220});
   if(st.clusters){for(let i=0;i<st.clusters;i++){const a=i/st.clusters*Math.PI*2+.35,rr=st.splash*.62,cx=target.x+Math.cos(a)*rr,cy=target.y+Math.sin(a)*rr;damageArea(cx,cy,st.splash*.48,st.damage*.42,e=>e.type!=='flyer');fx22({kind:'cluster',x:cx,y:cy,r:st.splash*.48,expires:performance.now()+250});}}
   s.cool=st.interval;
  }else if(s.type==='minigun'){
   const target=findTargetWhere(s.x,s.y,st.range,()=>true);if(!target)continue;
   for(let i=0;i<st.barrels;i++)shoot(s.x+(i?5:-2),s.y,target,'minigun',st.damage,CONFIG.MINIGUN.BULLET_SPEED,.035);s.cool=st.interval;
  }else if(s.type==='missile'){
   const targets=nearestTargetsWhere(s.x,s.y,st.range,()=>true,st.salvo);if(!targets.length)continue;
   for(const target of targets){damageArea(target.x,target.y,st.splash,st.damage,e=>Math.hypot(e.x-target.x,e.y-target.y)<=st.splash);fx22({kind:'missile',x1:s.x,y1:s.y,x2:target.x,y2:target.y,r:st.splash,expires:performance.now()+210});}
   s.cool=st.interval;
  }else if(s.type==='dronebay'){
   let fired=false;for(let i=0;i<st.drones;i++){const a=performance.now()/850+i/st.drones*Math.PI*2,ox=s.x+Math.cos(a)*CONFIG.DRONE_BAY.ORBIT_RADIUS,oy=s.y+Math.sin(a)*CONFIG.DRONE_BAY.ORBIT_RADIUS,target=findTargetWhere(ox,oy,st.range,()=>true);if(target){shoot(ox,oy,target,'drone',st.damage,CONFIG.DRONE_BAY.BULLET_SPEED,.025);fired=true;}}
   if(!fired)continue;s.cool=st.interval;
  }
 }
};

// -----------------------------------------------------------------------------
// Flyers: ignore terrain and walls, making air coverage strategically useful.
// -----------------------------------------------------------------------------
spawnEnemy=function(){
 const minute=Math.floor(state.elapsed/60),level=minute+1,edge=Math.floor(Math.random()*4),m=28;let x,y;
 if(edge===0){x=m+Math.random()*(WORLD_W-2*m);y=m}else if(edge===1){x=WORLD_W-m;y=m+Math.random()*(WORLD_H-2*m)}else if(edge===2){x=m+Math.random()*(WORLD_W-2*m);y=WORLD_H-m}else{x=m;y=m+Math.random()*(WORLD_H-2*m)}
 const flyerChance=state.elapsed>=CONFIG.FLYER.START_AFTER_SECONDS?CONFIG.FLYER.SPAWN_CHANCE:0,roll=Math.random();let type;
 if(roll<flyerChance)type='flyer';else if(roll<flyerChance+CONFIG.RANGED_ALIEN.SPAWN_CHANCE)type='spitter';else{const ground=(roll-flyerChance-CONFIG.RANGED_ALIEN.SPAWN_CHANCE)/(1-flyerChance-CONFIG.RANGED_ALIEN.SPAWN_CHANCE);type=ground<.68?'swarm':ground<.93?'runner':'brute';}
 const c=type==='swarm'?CONFIG.SWARM:type==='runner'?CONFIG.RUNNER:type==='brute'?CONFIG.BRUTE:type==='spitter'?CONFIG.RANGED_ALIEN:CONFIG.FLYER;
 state.enemies.push({type,x,y,hp:c.BASE_HP+level*c.HP_PER_LEVEL,maxHp:c.BASE_HP+level*c.HP_PER_LEVEL,speed:(c.BASE_SPEED+level*c.SPEED_PER_LEVEL)*CONFIG.DIRECTOR.ENEMY_SPEED_MULTIPLIER,r:c.RADIUS,damage:c.BASE_DAMAGE,burn:0,burnTick:0,slowFactor:1,slowTime:0,animOffset:Math.random()*100,rangeCooldown:Math.random()*(CONFIG.RANGED_ALIEN.FIRE_INTERVAL||1)});
};

const v21UpdateEnemiesV22=updateEnemies;
updateEnemies=function(dt){
 const flyers=state.enemies.filter(e=>e.type==='flyer');
 state.enemies=state.enemies.filter(e=>e.type!=='flyer');
 v21UpdateEnemiesV22(dt);
 const ground=state.enemies;
 state.enemies=ground.concat(flyers.filter(e=>e.hp>0));

 for(const e of [...flyers]){
  if(e.hp<=0||!state.enemies.includes(e))continue;
  if(e.slowTime>0)e.slowTime=Math.max(0,e.slowTime-dt);else e.slowFactor=1;
  const factor=e.slowTime>0?(e.slowFactor||1):1,lure=e.attractedTo?state.structures.find(s=>s.id===e.attractedTo&&s.type==='landingpad'&&s.built):null;
  if(e.attractedTo&&!lure)e.attractedTo=null;
  const tx=lure?lure.x:BASE_X,ty=lure?lure.y:BASE_Y,dx=tx-e.x,dy=ty-e.y,d=Math.hypot(dx,dy)||1;
  if(lure&&d<=e.r+structureRadius(lure)+CONFIG.TOWER_DURABILITY.MELEE_ATTACK_RANGE){lure.hp-=e.damage*dt;}
  else{e.x+=dx/d*e.speed*factor*dt;e.y+=dy/d*e.speed*factor*dt;}
  if(!lure&&Math.hypot(e.x-BASE_X,e.y-BASE_Y)<=BASE_RADIUS+e.r){const i=state.enemies.indexOf(e);if(i>=0)state.enemies.splice(i,1);if(!state.debug.unlimitedLives)state.baseHp-=e.damage;}
 }
 cleanupDestroyed();
};

// -----------------------------------------------------------------------------
// Rendering
// -----------------------------------------------------------------------------
const v21DrawEnemyV22=drawEnemy;
drawEnemy=function(e){
 if(e.type!=='flyer')return v21DrawEnemyV22(e);
 ctx.save();ctx.translate(e.x,e.y);const bob=Math.sin(performance.now()/180+e.animOffset)*2;
 ctx.globalAlpha=.22;ctx.fillStyle='#000';ctx.beginPath();ctx.ellipse(0,10,15,6,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;ctx.translate(0,bob);
 ctx.fillStyle='#a66fe8';ctx.beginPath();ctx.moveTo(0,-12);ctx.lineTo(8,-2);ctx.lineTo(19,3);ctx.lineTo(7,7);ctx.lineTo(0,14);ctx.lineTo(-7,7);ctx.lineTo(-19,3);ctx.lineTo(-8,-2);ctx.closePath();ctx.fill();ctx.fillStyle='#d9b8ff';ctx.beginPath();ctx.arc(0,0,4,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#7b49b2';ctx.lineWidth=2;ctx.stroke();
 if(e.hp<e.maxHp){ctx.fillStyle='#111';ctx.fillRect(-18,-21,36,3);ctx.fillStyle='#ef6666';ctx.fillRect(-18,-21,36*Math.max(0,e.hp/e.maxHp),3);}ctx.restore();
};

function drawV22LevelBadge(s){
 if(!s.level)s.level=1;if(state.selectedTower===s){ctx.strokeStyle='#ffe77c';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,structureRadius(s)+9,0,Math.PI*2);ctx.stroke();}
 ctx.fillStyle='rgba(5,12,18,.92)';ctx.fillRect(-18,-42,36,15);ctx.strokeStyle=towerLevel(s)===3?'#f3c86b':'#65c8e9';ctx.lineWidth=1;ctx.strokeRect(-18,-42,36,15);ctx.fillStyle=towerLevel(s)===3?'#ffe6a0':'#d9f5ff';ctx.font='bold 10px Arial';ctx.textAlign='center';ctx.fillText(`${towerLevel(s)}/3`,0,-31);
}

const v21DrawStructureV22=drawStructure;
drawStructure=function(s){
 if(!V22_NEW_TOWERS.has(s.type))return v21DrawStructureV22(s);
 if(!s.built){drawConstruction(s);return;}
 const st=towerStats(s);ctx.save();ctx.translate(s.x,s.y);
 if(state.showReach){ctx.strokeStyle='rgba(190,230,255,.22)';ctx.lineWidth=1;ctx.beginPath();ctx.arc(0,0,st.range,0,Math.PI*2);ctx.stroke();}
 if(s.type==='antiair'){
  ctx.fillStyle='#26343c';ctx.beginPath();ctx.arc(0,0,19,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#9ec0ce';ctx.lineWidth=2;ctx.stroke();ctx.fillStyle='#b5d7e4';ctx.fillRect(-10,-22,6,25);ctx.fillRect(4,-22,6,25);
 }else if(s.type==='cryo'){
  ctx.fillStyle='#173746';ctx.beginPath();ctx.arc(0,0,19,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#78e5ff';ctx.lineWidth=3;ctx.stroke();ctx.fillStyle='#b8f4ff';ctx.beginPath();ctx.moveTo(0,-24);ctx.lineTo(-9,0);ctx.lineTo(0,12);ctx.lineTo(9,0);ctx.closePath();ctx.fill();
 }else if(s.type==='mortar'){
  ctx.fillStyle='#35382e';ctx.beginPath();ctx.arc(0,0,20,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#9a9e7f';ctx.lineWidth=2;ctx.stroke();ctx.save();ctx.rotate(-.55);ctx.fillStyle='#767a61';ctx.fillRect(-7,-25,14,31);ctx.restore();
 }else if(s.type==='minigun'){
  ctx.fillStyle='#34343a';ctx.beginPath();ctx.arc(0,0,19,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#b0aebc';ctx.stroke();for(let i=-2;i<=2;i++){ctx.strokeStyle='#d1c7a1';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(i*3,-5);ctx.lineTo(i*3,-26);ctx.stroke();}
 }else if(s.type==='missile'){
  ctx.fillStyle='#343b43';ctx.beginPath();ctx.arc(0,0,21,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#c29f74';ctx.lineWidth=2;ctx.stroke();for(let i=-1;i<=1;i++){ctx.fillStyle='#ad6c45';ctx.fillRect(i*9-3,-25,6,27);ctx.fillStyle='#e9c08e';ctx.beginPath();ctx.moveTo(i*9,-31);ctx.lineTo(i*9-4,-23);ctx.lineTo(i*9+4,-23);ctx.closePath();ctx.fill();}
 }else{
  ctx.fillStyle='#253745';ctx.fillRect(-24,-18,48,36);ctx.strokeStyle='#76a9c6';ctx.lineWidth=2;ctx.strokeRect(-24,-18,48,36);ctx.fillStyle='#76d7ff';ctx.beginPath();ctx.arc(0,0,7,0,Math.PI*2);ctx.fill();const n=st.drones,a0=performance.now()/850;for(let i=0;i<n;i++){const a=a0+i/n*Math.PI*2;ctx.save();ctx.translate(Math.cos(a)*CONFIG.DRONE_BAY.ORBIT_RADIUS,Math.sin(a)*CONFIG.DRONE_BAY.ORBIT_RADIUS);ctx.fillStyle='#b9e9ff';ctx.fillRect(-5,-3,10,6);ctx.fillStyle='#4c8199';ctx.fillRect(-8,-1,16,2);ctx.restore();}
 }
 drawV22LevelBadge(s);if(s.hp<s.maxHp){ctx.fillStyle='#111';ctx.fillRect(-22,32,44,4);ctx.fillStyle='#ef6666';ctx.fillRect(-22,32,44*Math.max(0,s.hp/s.maxHp),4);}ctx.restore();
};

const v21DrawV22=draw;
draw=function(){
 v21DrawV22();if(!state.v22Effects)return;const now=performance.now();state.v22Effects=state.v22Effects.filter(f=>f.expires>now);if(!state.v22Effects.length)return;
 ctx.save();ctx.translate(-state.camera.x,-state.camera.y);
 for(const f of state.v22Effects){const alpha=Math.max(.12,(f.expires-now)/250);ctx.globalAlpha=alpha;
  if(f.kind==='cryo'){ctx.strokeStyle='#8cecff';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(f.x1,f.y1);ctx.lineTo(f.x2,f.y2);ctx.stroke();}
  else if(f.kind==='missile'){ctx.strokeStyle='#ffbf79';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(f.x1,f.y1);ctx.lineTo(f.x2,f.y2);ctx.stroke();ctx.fillStyle='rgba(255,120,55,.22)';ctx.beginPath();ctx.arc(f.x2,f.y2,f.r,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#ff8655';ctx.stroke();}
  else{ctx.fillStyle=f.kind==='flak'?'rgba(190,225,255,.18)':'rgba(255,160,70,.20)';ctx.strokeStyle=f.kind==='flak'?'#d5f3ff':'#ff9d55';ctx.lineWidth=3;ctx.beginPath();ctx.arc(f.x,f.y,f.r,0,Math.PI*2);ctx.fill();ctx.stroke();}
 }
 ctx.restore();ctx.globalAlpha=1;
};

// -----------------------------------------------------------------------------
// Reset integration
// -----------------------------------------------------------------------------
state.v22Effects=[];
const v21ResetV22=reset;
reset=function(){v21ResetV22();state.v22Effects=[];for(const s of state.structures)if(V22_NEW_TOWERS.has(s.type))s.level=1;updateTowerPanel();};
els.restart.onclick=reset;
