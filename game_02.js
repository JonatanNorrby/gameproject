function generateTerrain(){
 const result=[];
 const areaScale=(WORLD_W*WORLD_H)/(1280*800);
 const count=Math.round((CONFIG.TERRAIN.MIN_OBSTACLES+Math.floor(Math.random()*(CONFIG.TERRAIN.EXTRA_OBSTACLES_RANDOM+1)))*areaScale*.55);
 let attempts=0;
 while(result.length<count&&attempts<count*40){
   attempts++;
   const r=CONFIG.TERRAIN.MIN_RADIUS+Math.random()*(CONFIG.TERRAIN.MAX_RADIUS-CONFIG.TERRAIN.MIN_RADIUS);
   const x=r+40+Math.random()*(WORLD_W-2*r-80);
   const y=r+40+Math.random()*(WORLD_H-2*r-80);
   if(Math.hypot(x-BASE_X,y-BASE_Y)<BASE_RADIUS+150)continue;
   if(result.some(o=>Math.hypot(x-o.x,y-o.y)<r+o.r+28))continue;
   result.push({x,y,r,kind:Math.random()<.58?"rock":"crystal"});
 }
 return result;
}
function findSafeSpotAt(x,y){return state.safeSpots.find(s=>!s.occupied&&Math.hypot(x-s.x,y-s.y)<=CONFIG.SAFE_SPOT.RADIUS);}
function releaseSafeSpotForTower(t){if(!t.safeSpotId)return;const s=state.safeSpots.find(v=>v.id===t.safeSpotId);if(s)s.occupied=false;}
function removeDeadTowers(){
 const survivors=[];
 for(const t of state.towers){if(t.hp>0)survivors.push(t);else releaseSafeSpotForTower(t);}
 state.towers=survivors;
}

canvas.addEventListener("click",e=>{
 if(state.gameOver||state.choosing)return;
 const r=canvas.getBoundingClientRect();
 const screenX=(e.clientX-r.left)*W/r.width,screenY=(e.clientY-r.top)*H/r.height;
 const rawX=screenX+state.camera.x,rawY=screenY+state.camera.y;
 if(rawX<25||rawY<25||rawX>WORLD_W-25||rawY>WORLD_H-25)return;
 if(Math.hypot(rawX-BASE_X,rawY-BASE_Y)<BASE_RADIUS+25){els.message.textContent="You cannot build inside the base.";return;}

 const def=TOWERS[selected];
 let cost=selected==="blockade"?Math.max(1,Math.round(def.cost*state.mods.blockadeCost)):def.cost;
 if(!state.debug.unlimitedCash&&state.credits<cost){els.message.textContent=`Need ${cost} credits for ${def.label}.`;return}

 if(selected==="safespot"){
   if(pointBlockedByTerrain(rawX,rawY,CONFIG.SAFE_SPOT.RADIUS)){els.message.textContent="Natural terrain blocks that Safe Spot location.";return}
   if(state.safeSpots.some(s=>Math.hypot(s.x-rawX,s.y-rawY)<CONFIG.SAFE_SPOT.PLACEMENT_CLEARANCE)){els.message.textContent="Safe Spots are too close together.";return}
   if(state.towers.some(t=>Math.hypot(t.x-rawX,t.y-rawY)<40)){els.message.textContent="A tower is already too close to that location.";return}
   state.safeSpots.push({id:crypto.randomUUID?crypto.randomUUID():String(Math.random()),x:rawX,y:rawY,occupied:false});
   if(!state.debug.unlimitedCash)state.credits-=cost;updateHud();return;
 }

 let x=rawX,y=rawY,protectedTower=false,safeSpotId=null;
 const pad=findSafeSpotAt(rawX,rawY);
 if(pad&&selected!=="blockade"){x=pad.x;y=pad.y;protectedTower=true;safeSpotId=pad.id;}
 if(pointBlockedByTerrain(x,y,selected==="blockade"?28:20)){els.message.textContent="Natural terrain blocks tower placement there.";return;}

 if(selected==="blockade"){
   if(state.towers.some(t=>Math.hypot(t.x-x,t.y-y)<52)){els.message.textContent="Defenses cannot overlap.";return}
   const hp=towerBaseHp("blockade");
   state.towers.push({type:"blockade",x,y,hp,maxHp:hp,w:CONFIG.BLOCKADE.WIDTH,h:CONFIG.BLOCKADE.HEIGHT,protected:false});
 }else if(selected==="soldier"){
   if(state.towers.some(t=>Math.hypot(t.x-x,t.y-y)<38)){els.message.textContent="Towers cannot overlap.";return}
   const hp=towerBaseHp("soldier");
   state.towers.push({type:"soldier",x,y,range:def.range,hp,maxHp:hp,protected:protectedTower,safeSpotId,memberCooldowns:Array(CONFIG.SOLDIER.MEMBERS).fill(0).map(()=>Math.random()*.3)});
   if(pad)pad.occupied=true;
 }else{
   if(state.towers.some(t=>Math.hypot(t.x-x,t.y-y)<38)){els.message.textContent="Towers cannot overlap.";return}
   const hp=towerBaseHp(selected);
   state.towers.push({type:selected,x,y,range:def.range,cool:Math.random()*.2,hp,maxHp:hp,protected:protectedTower,safeSpotId});
   if(pad)pad.occupied=true;
 }
 if(!state.debug.unlimitedCash)state.credits-=cost;updateHud();
});

function stageTheme(){
 // One persistent map for the whole run. The terrain/theme only changes after Restart.
 return {ground:"#10221b",patch:"#234a37",path:"#18372d",accent:"#59d49a",sky:"#0b1512"};
}

function launchWave(waveNumber){
 const absoluteWave=waveNumber;
 state.waveSpawners.push({localWave:waveNumber,absoluteWave,remaining:CONFIG.SPAWN.BASE_ENEMIES_PER_WAVE+absoluteWave*CONFIG.SPAWN.EXTRA_ENEMIES_PER_ABSOLUTE_WAVE,timer:.04});
 els.message.textContent=`Wave ${waveNumber} launched. Active waves: ${totalActiveWaves()}`;
 updateHud();
}
function spawnCluster(sp){
 const count=CONFIG.SPAWN.BASE_CLUSTER_SIZE+Math.floor(Math.random()*CONFIG.SPAWN.RANDOM_CLUSTER_SIZE)+Math.min(8,Math.floor(sp.absoluteWave/2)*CONFIG.SPAWN.EXTRA_CLUSTER_SIZE_PER_TWO_WAVES);
 const family=Math.random(),edge=Math.floor(Math.random()*4),margin=35,clusterPos={x:BASE_X,y:BASE_Y};
 if(edge===0){clusterPos.x=margin+Math.random()*(WORLD_W-2*margin);clusterPos.y=margin;}
 if(edge===1){clusterPos.x=WORLD_W-margin;clusterPos.y=margin+Math.random()*(WORLD_H-2*margin);}
 if(edge===2){clusterPos.x=margin+Math.random()*(WORLD_W-2*margin);clusterPos.y=WORLD_H-margin;}
 if(edge===3){clusterPos.x=margin;clusterPos.y=margin+Math.random()*(WORLD_H-2*margin);}
 for(let i=0;i<count&&sp.remaining>0;i++){
  let type;
  if(Math.random()<CONFIG.RANGED_ALIEN.SPAWN_CHANCE)type="spitter";
  else type=family<CONFIG.SPAWN.SWARM_CHANCE?"swarm":family<CONFIG.SPAWN.RUNNER_CHANCE_CUTOFF?"runner":"brute";
  spawnEnemy(type,sp.absoluteWave,sp.localWave,clusterPos);sp.remaining--;
 }
}
function spawnEnemy(type,wave,sourceWave,clusterPos){
 const specs={
  swarm:{hp:CONFIG.SWARM.BASE_HP+wave*CONFIG.SWARM.HP_PER_WAVE,speed:CONFIG.SWARM.BASE_SPEED+wave*CONFIG.SWARM.SPEED_PER_WAVE,r:CONFIG.SWARM.RADIUS,damage:CONFIG.SWARM.BASE_DAMAGE,reward:CONFIG.SWARM.CREDIT_REWARD},
  runner:{hp:CONFIG.RUNNER.BASE_HP+wave*CONFIG.RUNNER.HP_PER_WAVE,speed:CONFIG.RUNNER.BASE_SPEED+wave*CONFIG.RUNNER.SPEED_PER_WAVE,r:CONFIG.RUNNER.RADIUS,damage:CONFIG.RUNNER.BASE_DAMAGE,reward:CONFIG.RUNNER.CREDIT_REWARD},
  brute:{hp:CONFIG.BRUTE.BASE_HP+wave*CONFIG.BRUTE.HP_PER_WAVE,speed:CONFIG.BRUTE.BASE_SPEED+wave*CONFIG.BRUTE.SPEED_PER_WAVE,r:CONFIG.BRUTE.RADIUS,damage:CONFIG.BRUTE.BASE_DAMAGE,reward:CONFIG.BRUTE.CREDIT_REWARD},
  spitter:{hp:CONFIG.RANGED_ALIEN.BASE_HP+wave*CONFIG.RANGED_ALIEN.HP_PER_WAVE,speed:CONFIG.RANGED_ALIEN.BASE_SPEED+wave*CONFIG.RANGED_ALIEN.SPEED_PER_WAVE,r:CONFIG.RANGED_ALIEN.RADIUS,damage:CONFIG.RANGED_ALIEN.BASE_DAMAGE,reward:CONFIG.RANGED_ALIEN.CREDIT_REWARD}
 };
 const s=specs[type];
 state.enemies.push({x:clusterPos.x+(Math.random()-.5)*90,y:clusterPos.y+(Math.random()-.5)*90,hp:s.hp,maxHp:s.hp,speed:s.speed,r:s.r,damage:s.damage,reward:s.reward,type,burn:0,burnTick:0,sourceWave,animOffset:Math.random()*100,rangeCooldown:Math.random()*CONFIG.RANGED_ALIEN.FIRE_INTERVAL});
}
function weightedRarity(){const x=Math.random()*100;let sum=0;for(const r of ["common","uncommon","rare","epic"]){sum+=RARITIES[r].weight;if(x<sum)return r}return "common";}
function pickUpgrade(){for(let tries=0;tries<20;tries++){const rarity=weightedRarity(),pool=UPGRADES.filter(u=>u.rarity===rarity);if(pool.length)return pool[Math.floor(Math.random()*pool.length)];}return UPGRADES[0];}
function showCards(){
 state.choosing=true;const choices=[],used=new Set();
 while(choices.length<3){const up=pickUpgrade();if(!used.has(up.name)){used.add(up.name);choices.push(up)}}
 els.cards.innerHTML="";
 choices.forEach(up=>{
  const c=document.createElement("button");c.className=`upgradeCard ${up.rarity}`;
  c.innerHTML=`<span class="rarity">${up.rarity.toUpperCase()}</span><h3>${up.name}</h3><p>${up.desc}</p><span class="tag">${up.tag}</span>`;
  c.onclick=()=>{up.apply(state);state.choosing=false;els.overlay.classList.add("hidden");els.message.textContent=`${up.rarity.toUpperCase()} upgrade: ${up.name}`;updateHud()};
  els.cards.appendChild(c);
 });
 els.overlay.classList.remove("hidden");updateHud();
}
function advanceIfStageComplete(){/* Stages removed: the same map persists until death/restart. */}
function findTarget(x,y,range){
 let target=null,best=-Infinity;
 for(const e of state.enemies){const d=Math.hypot(e.x-x,e.y-y);if(d<range){const score=-Math.hypot(e.x-BASE_X,e.y-BASE_Y)-d*.15;if(score>best){best=score;target=e}}}
 return target;
}
function shootFrom(x,y,e,type,damage,speed,angleJitter=0){const a=Math.atan2(e.y-y,e.x-x)+(Math.random()-.5)*angleJitter;state.bullets.push({x,y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,dmg:damage,life:1.8,type});}
