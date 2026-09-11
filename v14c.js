function findTarget(x,y,range){let best=null,bd=Infinity;for(const e of state.enemies){const d=Math.hypot(e.x-x,e.y-y);if(d<range&&d<bd){best=e;bd=d;}}return best;}
function shoot(x,y,e,type,dmg,speed,jitter=0){const a=Math.atan2(e.y-y,e.x-x)+(Math.random()-.5)*jitter;state.bullets.push({x,y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,dmg,life:2.2,type});}
function updateUnitCombat(dt){for(const u of state.units){if(u.type!=='soldier')continue;const count=CONFIG.SOLDIER.MEMBERS+state.mods.extraSoldiers;while(u.cooldowns.length<count)u.cooldowns.push(Math.random()*.2);for(let i=0;i<u.cooldowns.length;i++){u.cooldowns[i]-=dt;if(u.cooldowns[i]>0)continue;const target=findTarget(u.x,u.y,CONFIG.SOLDIER.RANGE);if(target){const off=SOLDIER_OFFSETS[i%6];shoot(u.x+off[0],u.y+off[1],target,'soldier',CONFIG.SOLDIER.DAMAGE*state.mods.soldierDamage,CONFIG.SOLDIER.BULLET_SPEED);u.cooldowns[i]=CONFIG.SOLDIER.FIRE_INTERVAL*state.mods.soldierRate;}}}}
function structureRange(s){return s.type==='laser'?CONFIG.LASER.RANGE:s.type==='flame'?CONFIG.FLAME.RANGE:0;}
function updateTowers(dt){for(const s of state.structures){if(!s.built||(s.type!=='laser'&&s.type!=='flame'))continue;s.cool-=dt;if(s.cool>0)continue;const target=findTarget(s.x,s.y,structureRange(s));if(!target)continue;if(s.type==='laser'){shoot(s.x,s.y,target,'laser',CONFIG.LASER.DAMAGE*state.mods.laserDamage,CONFIG.LASER.BULLET_SPEED);s.cool=CONFIG.LASER.FIRE_INTERVAL*state.mods.laserRate;}else{target.burn=Math.max(target.burn,CONFIG.FLAME.BURN_DURATION*state.mods.burnDuration);target.burnTick=Math.min(target.burnTick,.01);s.cool=CONFIG.FLAME.FIRE_INTERVAL;}}}

function spawnEnemy(){
 const minute=Math.floor(state.elapsed/60),level=minute+1,edge=Math.floor(Math.random()*4),m=28;let x,y;
 if(edge===0){x=m+Math.random()*(WORLD_W-2*m);y=m}else if(edge===1){x=WORLD_W-m;y=m+Math.random()*(WORLD_H-2*m)}else if(edge===2){x=m+Math.random()*(WORLD_W-2*m);y=WORLD_H-m}else{x=m;y=m+Math.random()*(WORLD_H-2*m)}
 const roll=Math.random();let type=roll<CONFIG.RANGED_ALIEN.SPAWN_CHANCE?'spitter':roll<.68?'swarm':roll<.93?'runner':'brute';
 const c=type==='swarm'?CONFIG.SWARM:type==='runner'?CONFIG.RUNNER:type==='brute'?CONFIG.BRUTE:CONFIG.RANGED_ALIEN;
 state.enemies.push({type,x,y,hp:c.BASE_HP+level*c.HP_PER_LEVEL,maxHp:c.BASE_HP+level*c.HP_PER_LEVEL,speed:(c.BASE_SPEED+level*c.SPEED_PER_LEVEL)*CONFIG.DIRECTOR.ENEMY_SPEED_MULTIPLIER,r:c.RADIUS,damage:c.BASE_DAMAGE,xp:c.XP,burn:0,burnTick:0,animOffset:Math.random()*100,rangeCooldown:Math.random()*(CONFIG.RANGED_ALIEN.FIRE_INTERVAL||1)});
}
function updateDirector(dt){state.spawnTimer-=dt;if(state.spawnTimer>0)return;const minute=Math.floor(state.elapsed/60),count=CONFIG.DIRECTOR.BASE_CLUSTER+Math.min(CONFIG.DIRECTOR.MAX_EXTRA_CLUSTER,minute*CONFIG.DIRECTOR.EXTRA_CLUSTER_PER_MIN);for(let i=0;i<count;i++)spawnEnemy();state.spawnTimer=Math.max(CONFIG.DIRECTOR.MIN_INTERVAL,CONFIG.DIRECTOR.START_INTERVAL-minute*CONFIG.DIRECTOR.INTERVAL_DROP_PER_MIN);}
function gainXp(amount){state.xp+=amount;if(!state.choosing&&state.xp>=state.nextXp){state.xp-=state.nextXp;state.xpLevel++;state.nextXp=Math.round(state.nextXp*CONFIG.XP.GROWTH);showCards();}}
function hitEnemy(e,dmg){e.hp-=dmg;if(e.hp<=0){const i=state.enemies.indexOf(e);if(i>=0)state.enemies.splice(i,1);gainXp(e.xp);for(let k=0;k<(e.type==='brute'?9:4);k++)state.particles.push({x:e.x,y:e.y,vx:(Math.random()-.5)*100,vy:(Math.random()-.5)*100,life:.45});}}
function weightedRarity(){const x=Math.random()*100;let sum=0;for(const n of ['common','uncommon','rare','epic']){sum+=RARITIES[n];if(x<sum)return n;}return 'common';}
function showCards(){state.choosing=true;const choices=[],used=new Set();while(choices.length<3){const rar=weightedRarity(),pool=UPGRADES.filter(u=>u.rarity===rar),u=pool[Math.floor(Math.random()*pool.length)]||UPGRADES[0];if(!used.has(u.name)){used.add(u.name);choices.push(u);}}els.cards.innerHTML='';for(const u of choices){const b=document.createElement('button');b.className=`upgradeCard ${u.rarity}`;b.innerHTML=`<span class="rarity">${u.rarity.toUpperCase()}</span><h3>${u.name}</h3><p>${u.desc}</p><span class="tag">${u.tag}</span>`;b.onclick=()=>{u.apply(state);state.choosing=false;els.overlay.classList.add('hidden');els.message.textContent=`Upgrade acquired: ${u.name}`;if(state.xp>=state.nextXp)gainXp(0);updateHud();};els.cards.appendChild(b);}els.overlay.classList.remove('hidden');}

function closestAttackTarget(e,maxRange,includeProtected){let best=null,bd=Infinity;for(const s of state.structures){if(!includeProtected&&s.protected)continue;const d=Math.hypot(e.x-s.x,e.y-s.y);if(d<maxRange&&d<bd){best=s;bd=d;}}for(const u of state.units){const d=Math.hypot(e.x-u.x,e.y-u.y);if(d<maxRange&&d<bd){best=u;bd=d;}}return best;}
function steerEnemyAroundTerrain(e,dt){for(const o of state.terrain){const d=Math.hypot(e.x-o.x,e.y-o.y);if(d<o.r+e.r+38){const dx=e.x-o.x||1,dy=e.y-o.y||0,l=Math.hypot(dx,dy)||1,tx=BASE_X-e.x,ty=BASE_Y-e.y,tl=Math.hypot(tx,ty)||1;const cross=Math.sign(dx*ty-dy*tx)||1;e.x+=(-dy/l)*cross*CONFIG.TERRAIN.ENEMY_STEER_STRENGTH*dt*.45;e.y+=(dx/l)*cross*CONFIG.TERRAIN.ENEMY_STEER_STRENGTH*dt*.45;if(d<o.r+e.r+5){e.x+=dx/l*CONFIG.TERRAIN.ENEMY_STEER_STRENGTH*dt*.45;e.y+=dy/l*CONFIG.TERRAIN.ENEMY_STEER_STRENGTH*dt*.45;}}}}
function fireEnemyShot(e,t){const dx=t.x-e.x,dy=t.y-e.y,d=Math.hypot(dx,dy)||1;state.enemyBullets.push({x:e.x,y:e.y,vx:dx/d*CONFIG.RANGED_ALIEN.PROJECTILE_SPEED,vy:dy/d*CONFIG.RANGED_ALIEN.PROJECTILE_SPEED,dmg:CONFIG.RANGED_ALIEN.SHOT_DAMAGE,life:3,target:t});}
function updateEnemies(dt){
 for(const e of [...state.enemies]){
  if(e.burn>0){e.burn-=dt;e.burnTick-=dt;if(e.burnTick<=0){hitEnemy(e,CONFIG.FLAME.BURN_TICK_DAMAGE*state.mods.flameDamage);e.burnTick=CONFIG.FLAME.BURN_TICK_INTERVAL;if(e.hp<=0)continue;}}
  let speed=e.speed,attacking=false;steerEnemyAroundTerrain(e,dt);
  if(e.type==='spitter'){
   e.rangeCooldown-=dt;const t=closestAttackTarget(e,CONFIG.RANGED_ALIEN.ATTACK_RANGE,true);if(t){speed*=.22;if(e.rangeCooldown<=0){fireEnemyShot(e,t);e.rangeCooldown=CONFIG.RANGED_ALIEN.FIRE_INTERVAL;}}
  }else{
   const t=closestAttackTarget(e,CONFIG.TOWER_DURABILITY.MELEE_AGGRO_RANGE,false);if(t){const d=Math.hypot(e.x-t.x,e.y-t.y);if(d<CONFIG.TOWER_DURABILITY.MELEE_ATTACK_RANGE+e.r+structureOrUnitRadius(t)){t.hp-=e.damage*CONFIG.TOWER_DURABILITY.MELEE_DAMAGE_MULTIPLIER*dt;speed=0;attacking=true;}}
  }
  if(!attacking&&speed>0){const dx=BASE_X-e.x,dy=BASE_Y-e.y,d=Math.hypot(dx,dy)||1;e.x+=dx/d*speed*dt;e.y+=dy/d*speed*dt;}
  if(Math.hypot(e.x-BASE_X,e.y-BASE_Y)<BASE_RADIUS+e.r){state.enemies.splice(state.enemies.indexOf(e),1);if(!state.debug.unlimitedLives)state.baseHp-=e.damage;}
 }
 cleanupDestroyed();
}
function structureOrUnitRadius(t){if(t.type==='truck')return 22;if(t.type==='soldier')return 20;return structureRadius(t);}
function cleanupDestroyed(){
 const deadTrucks=state.units.filter(u=>u.type==='truck'&&u.hp<=0);for(const t of deadTrucks)detachFollowersOfTruck(t);
 state.units=state.units.filter(u=>{if(u.hp>0)return true;if(state.selectedUnit===u)state.selectedUnit=null;return false;});
 state.structures=state.structures.filter(s=>{if(s.hp>0)return true;if(s.type==='mine'){const d=state.depots.find(x=>x.id===s.depotId);if(d)d.mineId=null;}if(s.safeSpotId){const p=state.structures.find(x=>x.id===s.safeSpotId);if(p)p.occupied=false;}if(s.type==='safespot'){for(const other of state.structures)if(other.safeSpotId===s.id){other.safeSpotId=null;other.protected=false;}}return false;});
}
function updateProjectiles(dt){
 for(let i=state.bullets.length-1;i>=0;i--){const b=state.bullets[i];b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;if(b.life<=0){state.bullets.splice(i,1);continue;}let hit=false;for(const e of state.enemies){if(Math.hypot(b.x-e.x,b.y-e.y)<e.r+5){hitEnemy(e,b.dmg);hit=true;break;}}if(hit)state.bullets.splice(i,1);}
 for(let i=state.enemyBullets.length-1;i>=0;i--){const b=state.enemyBullets[i];b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;const valid=state.units.includes(b.target)||state.structures.includes(b.target);if(!valid||b.life<=0){state.enemyBullets.splice(i,1);continue;}if(Math.hypot(b.x-b.target.x,b.y-b.target.y)<structureOrUnitRadius(b.target)+5){b.target.hp-=b.dmg;state.enemyBullets.splice(i,1);}}
 cleanupDestroyed();
}
function update(dt){
 updateCamera(dt);
 if(state.gameOver){updateHud();return;}
 if(state.choosing){updateHud();return;}
 if(state.paused){updateHud();return;}
 state.elapsed+=dt;updateDirector(dt);updateConstruction(dt);updateMines(dt);updateUnitMovement(dt);updateTruckEconomy();updateUnitCombat(dt);updateTowers(dt);updateEnemies(dt);updateProjectiles(dt);
 for(let i=state.particles.length-1;i>=0;i--){const p=state.particles[i];p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;if(p.life<=0)state.particles.splice(i,1);}
 if(state.debug.unlimitedLives)state.baseHp=state.maxBaseHp;if(state.baseHp<=0&&!state.debug.unlimitedLives){state.baseHp=0;state.gameOver=true;els.message.textContent='THE BASE HAS FALLEN — press RESTART.';}updateHud();
}
