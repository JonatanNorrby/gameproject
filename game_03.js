function hitEnemy(e,dmg){
 e.hp-=dmg;
 if(e.hp<=0){
  const i=state.enemies.indexOf(e);if(i>=0)state.enemies.splice(i,1);
  const concurrency=Math.max(1,totalActiveWaves());
  const stackMult=1+(concurrency-1)*state.mods.stackBonus;
  state.credits+=Math.max(1,Math.round(e.reward*state.mods.reward*stackMult));
  for(let k=0;k<(e.type==="brute"?10:4);k++)state.particles.push({x:e.x,y:e.y,vx:(Math.random()-.5)*110,vy:(Math.random()-.5)*110,life:.5,kind:"alien"});
 }
}
function steerAroundBlockade(e,b,dt){
 const lg=b.x-b.w/2-e.r-9,rg=b.x+b.w/2+e.r+9,target=Math.abs(e.x-lg)<Math.abs(e.x-rg)?lg:rg;
 e.x+=Math.max(-230,Math.min(230,(target-e.x)*5))*dt;
}
function blockadeCollision(e,b){
 const nx=Math.max(b.x-b.w/2,Math.min(e.x,b.x+b.w/2)),ny=Math.max(b.y-b.h/2,Math.min(e.y,b.y+b.h/2));
 return (e.x-nx)**2+(e.y-ny)**2<e.r**2;
}
function steerAroundTerrain(e,o,dt){
 const dx=e.x-o.x,dy=e.y-o.y,d=Math.hypot(dx,dy)||1;
 const side=(dx>=0?1:-1);
 e.x+=side*CONFIG.TERRAIN.ENEMY_STEER_STRENGTH*dt*(1.1-Math.min(1,Math.abs(dx)/(o.r+35)));
 if(d<o.r+e.r+3){e.x+=dx/d*CONFIG.TERRAIN.ENEMY_STEER_STRENGTH*dt*.7;e.y+=dy/d*CONFIG.TERRAIN.ENEMY_STEER_STRENGTH*dt*.18;}
}
function closestTowerForEnemy(e,maxRange,includeProtected=true){
 let best=null,bestD=Infinity;
 for(const t of state.towers){if(!includeProtected&&t.protected)continue;const d=Math.hypot(e.x-t.x,e.y-t.y);if(d<maxRange&&d<bestD){best=t;bestD=d}}
 return best;
}
function fireEnemyShot(e,t){
 const dx=t.x-e.x,dy=t.y-e.y,d=Math.hypot(dx,dy)||1;
 state.enemyBullets.push({x:e.x,y:e.y,vx:dx/d*CONFIG.RANGED_ALIEN.PROJECTILE_SPEED,vy:dy/d*CONFIG.RANGED_ALIEN.PROJECTILE_SPEED,dmg:CONFIG.RANGED_ALIEN.SHOT_DAMAGE,life:2.2,target:t});
}

function updateFireSquads(dt){
 for(const t of state.towers){
  if(t.type!=="soldier"||!t.moveTarget)continue;
  const dx=t.moveTarget.x-t.x,dy=t.moveTarget.y-t.y,d=Math.hypot(dx,dy);
  if(d<5){
   t.x=t.moveTarget.x;t.y=t.moveTarget.y;t.moveTarget=null;
   const pad=findSafeSpotAt(t.x,t.y);
   if(pad){t.x=pad.x;t.y=pad.y;t.protected=true;t.safeSpotId=pad.id;pad.occupied=true;}
   continue;
  }
  const speed=(t.moveSpeed||CONFIG.SOLDIER.MOVE_SPEED)*state.mods.squadMove;
  const step=Math.min(d,speed*dt),a=Math.atan2(dy,dx);
  let nx=t.x+Math.cos(a)*step,ny=t.y+Math.sin(a)*step;

  // Simple local avoidance around natural terrain.
  if(pointBlockedByTerrain(nx,ny,18)){
   let found=false;
   for(const off of [.45,-.45,.8,-.8,1.15,-1.15]){
    const aa=a+off,tx=t.x+Math.cos(aa)*step,ty=t.y+Math.sin(aa)*step;
    if(!pointBlockedByTerrain(tx,ty,18)){nx=tx;ny=ty;found=true;break;}
   }
   if(!found)continue;
  }
  if(Math.hypot(nx-BASE_X,ny-BASE_Y)<BASE_RADIUS+28)continue;
  t.x=Math.max(25,Math.min(WORLD_W-25,nx));
  t.y=Math.max(25,Math.min(WORLD_H-25,ny));
 }
}

function update(dt){
 if(state.gameOver)return;
 updateCamera(dt);
 if(state.choosing)return;
 updateFireSquads(dt);

 for(const sp of state.waveSpawners){
  sp.timer-=dt;
  if(sp.remaining>0&&sp.timer<=0){
   spawnCluster(sp);
   sp.timer=Math.max(CONFIG.SPAWN.MIN_CLUSTER_DELAY,CONFIG.SPAWN.BASE_CLUSTER_DELAY-sp.absoluteWave*CONFIG.SPAWN.CLUSTER_DELAY_REDUCTION_PER_WAVE);
  }
 }
 const before=state.waveSpawners.length;
 state.waveSpawners=state.waveSpawners.filter(sp=>sp.remaining>0||state.enemies.some(e=>e.sourceWave===sp.localWave));
 const completed=before-state.waveSpawners.length;
 if(completed>0)state.cardsPending+=completed;

 for(const e of [...state.enemies]){
  if(e.burn>0){e.burn-=dt;e.burnTick-=dt;if(e.burnTick<=0){hitEnemy(e,CONFIG.FLAME.BURN_TICK_DAMAGE*state.mods.flameDamage);e.burnTick=CONFIG.FLAME.BURN_TICK_INTERVAL}}
 }

 for(const t of state.towers){
  if(t.type==="blockade")continue;
  if(t.type==="soldier"){
   const desired=CONFIG.SOLDIER.MEMBERS+state.mods.extraSoldiers;
   while(t.memberCooldowns.length<desired)t.memberCooldowns.push(Math.random()*.25);
   for(let i=0;i<t.memberCooldowns.length;i++){
    t.memberCooldowns[i]-=dt;if(t.memberCooldowns[i]>0)continue;
    const base=SOLDIER_OFFSETS[i%6],ring=Math.floor(i/6),ox=base[0]*(1+ring*.65),oy=base[1]*(1+ring*.65);
    const target=findTarget(t.x+ox,t.y+oy,t.range);
    if(target){
     shootFrom(t.x+ox,t.y+oy,target,"soldier",TOWERS.soldier.damage*state.mods.soldierDamage,TOWERS.soldier.bulletSpeed);
     t.memberCooldowns[i]=TOWERS.soldier.memberRate*state.mods.soldierRate*(.86+Math.random()*.28);
    }
   }
   continue;
  }
  t.cool-=dt;if(t.cool>0)continue;
  let range=t.range;if(t.type==="flame")range*=state.mods.flameRange;
  const target=findTarget(t.x,t.y,range);if(!target)continue;
  if(t.type==="laser"){
   shootFrom(t.x,t.y,target,"laser",TOWERS.laser.damage*state.mods.laserDamage,TOWERS.laser.bulletSpeed);
   t.cool=TOWERS.laser.rate*state.mods.laserRate;
  }else{
   target.burn=Math.max(target.burn,CONFIG.FLAME.BURN_DURATION*state.mods.burnDuration);
   target.burnTick=Math.min(target.burnTick,.01);t.cool=TOWERS.flame.rate;
  }
 }

 for(let i=state.enemies.length-1;i>=0;i--){
  const e=state.enemies[i];let speed=e.speed,attacking=false;

  for(const o of state.terrain){if(Math.hypot(e.x-o.x,e.y-o.y)<o.r+e.r+34)steerAroundTerrain(e,o,dt);}

  for(const b of state.towers){
   if(b.type!=="blockade")continue;
   if(Math.hypot(e.x-b.x,e.y-b.y)<Math.max(b.w,b.h)/2+e.r+22){
    const dx=e.x-b.x,dy=e.y-b.y,d=Math.hypot(dx,dy)||1;
    e.x+=dx/d*120*dt;e.y+=dy/d*120*dt;
    if(blockadeCollision(e,b)){speed*=CONFIG.BLOCKADE.COLLISION_SPEED_MULTIPLIER;b.hp-=e.damage*dt*CONFIG.BLOCKADE.ENEMY_DAMAGE_MULTIPLIER;attacking=true;}
   }
  }

  if(e.type==="spitter"){
   e.rangeCooldown-=dt;
   const target=closestTowerForEnemy(e,CONFIG.RANGED_ALIEN.ATTACK_RANGE,true);
   if(target){speed*=.18;if(e.rangeCooldown<=0){fireEnemyShot(e,target);e.rangeCooldown=CONFIG.RANGED_ALIEN.FIRE_INTERVAL}}
  }else{
   const target=closestTowerForEnemy(e,CONFIG.TOWER_DURABILITY.MELEE_ATTACK_RANGE+e.r+25,false);
   if(target&&target.type!=="blockade"){
    const d=Math.hypot(e.x-target.x,e.y-target.y);
    if(d<CONFIG.TOWER_DURABILITY.MELEE_ATTACK_RANGE+e.r){target.hp-=e.damage*CONFIG.TOWER_DURABILITY.MELEE_DAMAGE_MULTIPLIER*dt;speed=0;attacking=true;}
   }
  }

  if(!attacking||speed>0){const dx=BASE_X-e.x,dy=BASE_Y-e.y,d=Math.hypot(dx,dy)||1;e.x+=dx/d*speed*dt;e.y+=dy/d*speed*dt;}

  if(Math.hypot(e.x-BASE_X,e.y-BASE_Y)<=BASE_RADIUS+e.r){
   state.enemies.splice(i,1);
   if(!state.debug.unlimitedLives)state.baseHp-=e.damage;
   if(state.baseHp<=0&&!state.debug.unlimitedLives){state.baseHp=0;state.gameOver=true;els.message.textContent="THE BASE HAS FALLEN — press RESTART."}
  }
 }

 removeDeadTowers();

 for(let i=state.bullets.length-1;i>=0;i--){
  const b=state.bullets[i];b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;
  if(b.life<=0){state.bullets.splice(i,1);continue}
  let hit=false;
  for(const e of [...state.enemies]){if(Math.hypot(b.x-e.x,b.y-e.y)<e.r+5){hitEnemy(e,b.dmg);hit=true;break}}
  if(hit)state.bullets.splice(i,1);
 }

 for(let i=state.enemyBullets.length-1;i>=0;i--){
  const b=state.enemyBullets[i];b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;
  if(b.life<=0||!state.towers.includes(b.target)){state.enemyBullets.splice(i,1);continue}
  if(Math.hypot(b.x-b.target.x,b.y-b.target.y)<towerRadius(b.target)+4){b.target.hp-=b.dmg;state.enemyBullets.splice(i,1);}
 }
 removeDeadTowers();

 for(let i=state.particles.length-1;i>=0;i--){const p=state.particles[i];p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;if(p.life<=0)state.particles.splice(i,1);}

 if(state.cardsPending>0&&state.enemies.length===0&&state.waveSpawners.length===0){state.cardsPending=0;showCards();}
 updateHud();
}
