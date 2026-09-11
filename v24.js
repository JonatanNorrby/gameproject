// Alien Planet Defense v24
// Backlog enemy batch: Ravager, Siege Beast, Burrower, Climber, Acid Lobber,
// Crusher, Harvester Hunter and Saboteur.

state.v24Effects=[];

const SPECIAL_ENEMY_TYPES=['siegebeast','burrower','climber','acidlobber','crusher','harvesterhunter','saboteur'];
function enemyCfg(type){
 if(type==='ravager')return CONFIG.RAVAGER;
 if(type==='runner')return CONFIG.RUNNER;
 if(type==='brute')return CONFIG.BRUTE;
 if(type==='spitter')return CONFIG.RANGED_ALIEN;
 if(type==='flyer')return CONFIG.FLYER;
 if(type==='siegebeast')return CONFIG.SIEGE_BEAST;
 if(type==='burrower')return CONFIG.BURROWER;
 if(type==='climber')return CONFIG.CLIMBER;
 if(type==='acidlobber')return CONFIG.ACID_LOBBER;
 if(type==='crusher')return CONFIG.CRUSHER;
 if(type==='harvesterhunter')return CONFIG.HARVESTER_HUNTER;
 if(type==='saboteur')return CONFIG.SABOTEUR;
 return CONFIG.RAVAGER;
}
function eligibleSpecials(){return SPECIAL_ENEMY_TYPES.filter(t=>state.elapsed>=enemyCfg(t).START_AFTER_SECONDS);}
function weightedSpecial(types){
 let total=0;for(const t of types)total+=enemyCfg(t).WEIGHT||1;
 let r=Math.random()*total;for(const t of types){r-=enemyCfg(t).WEIGHT||1;if(r<=0)return t;}return types[0];
}

// -----------------------------------------------------------------------------
// Target visibility: Burrowers cannot be targeted while underground. Saboteurs
// are targetable only after entering detection range of a player asset.
// -----------------------------------------------------------------------------
function saboteurDetected(e){
 const r=CONFIG.SABOTEUR.REVEAL_RANGE;
 if(Math.hypot(e.x-BASE_X,e.y-BASE_Y)<=BASE_RADIUS+r)return true;
 for(const u of state.units)if(Math.hypot(e.x-u.x,e.y-u.y)<=r)return true;
 for(const s of state.structures)if(s.built&&Math.hypot(e.x-s.x,e.y-s.y)<=r)return true;
 return false;
}
function enemyTargetableFrom(e,x,y){
 if(e.burrowed)return false;
 if(e.type==='saboteur'&&e.cloaked&&Math.hypot(e.x-x,e.y-y)>CONFIG.SABOTEUR.REVEAL_RANGE)return false;
 return true;
}
findTarget=function(x,y,range){let best=null,bd=Infinity;for(const e of state.enemies){if(!enemyTargetableFrom(e,x,y))continue;const d=Math.hypot(e.x-x,e.y-y);if(d<range&&d<bd){best=e;bd=d;}}return best;};
findTargetWhere=function(x,y,range,predicate,minRange=0){let best=null,bd=Infinity;for(const e of state.enemies){if(!enemyTargetableFrom(e,x,y)||!predicate(e))continue;const d=Math.hypot(e.x-x,e.y-y);if(d<=range&&d>=minRange&&d<bd){best=e;bd=d;}}return best;};
nearestTargetsWhere=function(x,y,range,predicate,count,minRange=0){return [...state.enemies].filter(e=>enemyTargetableFrom(e,x,y)&&predicate(e)).map(e=>({e,d:Math.hypot(e.x-x,e.y-y)})).filter(v=>v.d<=range&&v.d>=minRange).sort((a,b)=>a.d-b.d).slice(0,count).map(v=>v.e);};
nearestEnemyExcept=function(x,y,range,used){let best=null,bd=range;for(const e of state.enemies){if(used.has(e)||!enemyTargetableFrom(e,x,y))continue;const d=Math.hypot(e.x-x,e.y-y);if(d<bd){best=e;bd=d;}}return best;};

// Climbers become deliberately easier to kill while physically scaling a Wall.
const v23HitEnemyV24=hitEnemy;
hitEnemy=function(e,dmg){
 if(e.type==='climber'&&e.climbing)dmg*=CONFIG.CLIMBER.VULNERABILITY;
 if(e.burrowed)dmg*=0.2;
 return v23HitEnemyV24(e,dmg);
};

const v23EnemyGoldRewardV24=enemyGoldReward;
enemyGoldReward=function(e){const c=enemyCfg(e.type);return c?.GOLD_REWARD??v23EnemyGoldRewardV24(e);};

// -----------------------------------------------------------------------------
// Spawning: common Ravagers remain the predictable backbone, while special
// enemies gradually occupy more of the director's spawn budget over time.
// -----------------------------------------------------------------------------
spawnEnemy=function(){
 const minute=Math.floor(state.elapsed/60),level=minute+1,edge=Math.floor(Math.random()*4),m=28;let x,y;
 if(edge===0){x=m+Math.random()*(WORLD_W-2*m);y=m}else if(edge===1){x=WORLD_W-m;y=m+Math.random()*(WORLD_H-2*m)}else if(edge===2){x=m+Math.random()*(WORLD_W-2*m);y=WORLD_H-m}else{x=m;y=m+Math.random()*(WORLD_H-2*m)}
 let type;
 if(state.elapsed>=CONFIG.FLYER.START_AFTER_SECONDS&&Math.random()<CONFIG.FLYER.SPAWN_CHANCE)type='flyer';
 else if(Math.random()<CONFIG.RANGED_ALIEN.SPAWN_CHANCE)type='spitter';
 else{
  const specials=eligibleSpecials(),chance=Math.min(CONFIG.SPECIAL_ENEMIES.MAX_CHANCE,CONFIG.SPECIAL_ENEMIES.BASE_CHANCE+state.elapsed/CONFIG.SPECIAL_ENEMIES.RAMP_SECONDS*(CONFIG.SPECIAL_ENEMIES.MAX_CHANCE-CONFIG.SPECIAL_ENEMIES.BASE_CHANCE));
  if(specials.length&&Math.random()<chance)type=weightedSpecial(specials);
  else{const r=Math.random();type=r<.60?'ravager':r<.87?'runner':'brute';}
 }
 const c=enemyCfg(type),hp=c.BASE_HP+level*c.HP_PER_LEVEL;
 state.enemies.push({
  type,x,y,hp,maxHp:hp,speed:(c.BASE_SPEED+level*c.SPEED_PER_LEVEL)*CONFIG.DIRECTOR.ENEMY_SPEED_MULTIPLIER,r:c.RADIUS,damage:c.BASE_DAMAGE,
  burn:0,burnTick:0,slowFactor:1,slowTime:0,animOffset:Math.random()*100,rangeCooldown:Math.random()*(CONFIG.RANGED_ALIEN.FIRE_INTERVAL||1),
  specialCooldown:Math.random()*1.2,burrowCooldown:Math.random()*3,burrowed:false,burrowTimer:0,climbing:false,chargeCooldown:2+Math.random()*3,chargeWindup:0,charging:false,chargeWallId:null,cloaked:type==='saboteur'
 });
};

// -----------------------------------------------------------------------------
// Damage / target helpers.
// -----------------------------------------------------------------------------
function isStructureTarget(t){return !!t&&state.structures.includes(t);}
function damageTarget(t,amount){if(!t)return;const mult=isStructureTarget(t)&&(t.acidTime||0)>0?CONFIG.ACID_LOBBER.ARMOR_DAMAGE_MULTIPLIER:1;t.hp-=amount*mult;}
function targetDistance(e,t){if(!t)return Infinity;if(t.type==='wall')return pointSegmentDistance(e.x,e.y,t.x1,t.y1,t.x2,t.y2);return Math.hypot(e.x-t.x,e.y-t.y);}
function nearestOf(list,e){let best=null,bd=Infinity;for(const t of list){if(!t||t.hp<=0)continue;const d=targetDistance(e,t);if(d<bd){best=t;bd=d;}}return best;}
function nearestWall(e){return nearestOf(state.structures.filter(s=>s.type==='wall'&&s.built),e);}
function economyStructures(){return state.structures.filter(s=>s.built&&['mine','oremine','refinery','landingpad'].includes(s.type));}
function combatStructures(){return state.structures.filter(s=>s.built&&isUpgradeableTower(s));}
function hunterTarget(e){
 const truck=nearestOf(state.units.filter(u=>u.type==='truck'),e);if(truck)return truck;
 return nearestOf(economyStructures(),e);
}
function saboteurTarget(e){return nearestOf(economyStructures(),e)||nearestOf(combatStructures(),e);}
function acidTarget(e){return nearestOf([...state.structures.filter(s=>s.built&&s.type==='wall'),...combatStructures(),...economyStructures()],e);}
function lureFor(e){const p=e.attractedTo?state.structures.find(s=>s.id===e.attractedTo&&s.type==='landingpad'&&s.built):null;if(e.attractedTo&&!p)e.attractedTo=null;return p;}
function playerMeleeRange(e,t){return CONFIG.TOWER_DURABILITY.MELEE_ATTACK_RANGE+e.r+(t.type==='wall'?wallThickness(t)/2:structureOrUnitRadius(t));}
function wallBlockingDirect(e,tx,ty,lookAhead){
 const dx=tx-e.x,dy=ty-e.y,d=Math.hypot(dx,dy)||1,len=Math.min(lookAhead,d),ex=e.x+dx/d*len,ey=e.y+dy/d*len;let best=null,bd=Infinity;
 for(const w of state.structures){if(w.type!=='wall'||!w.built)continue;if(segmentSegmentDistance(e.x,e.y,ex,ey,w.x1,w.y1,w.x2,w.y2)<=e.r+wallThickness(w)/2+3){const dist=pointSegmentDistance(e.x,e.y,w.x1,w.y1,w.x2,w.y2);if(dist<bd){best=w;bd=dist;}}}
 return best;
}
function moveDirectIgnoringWalls(e,tx,ty,speed,dt){const dx=tx-e.x,dy=ty-e.y,d=Math.hypot(dx,dy)||1,step=Math.min(d,speed*dt),nx=e.x+dx/d*step,ny=e.y+dy/d*step;if(!pointBlockedByTerrain(nx,ny,e.r+1)){e.x=nx;e.y=ny;return true;}return false;}
function moveWithWalls(e,tx,ty,speed,dt,wallDamageMult=1){const wall=navigateEnemyWithWalls(e,tx,ty,speed,dt);if(wall){const before=wall.hp;attackOrApproachWall(e,wall,speed,dt);if(wall.hp<before&&wallDamageMult!==1)wall.hp-=Math.max(0,before-wall.hp)*(wallDamageMult-1);}return wall;}
function applyAcid(t){if(isStructureTarget(t))t.acidTime=Math.max(t.acidTime||0,CONFIG.ACID_LOBBER.ACID_DURATION);}
function fx24(fx){state.v24Effects.push(fx);}

// -----------------------------------------------------------------------------
// Specialized behaviors.
// -----------------------------------------------------------------------------
function updateBurrower(e,tx,ty,speed,dt){
 e.burrowCooldown=Math.max(0,(e.burrowCooldown||0)-dt);
 if(e.burrowed){e.burrowTimer-=dt;if(e.burrowTimer<=0){e.x=e.burrowExit.x;e.y=e.burrowExit.y;e.burrowed=false;e.burrowCooldown=CONFIG.BURROWER.BURROW_COOLDOWN;fx24({kind:'emerge',x:e.x,y:e.y,expires:performance.now()+260});}return;}
 const wall=wallBlockingDirect(e,tx,ty,CONFIG.BURROWER.BURROW_DISTANCE);
 if(wall&&e.burrowCooldown<=0){
  const dx=tx-e.x,dy=ty-e.y,d=Math.hypot(dx,dy)||1,p=nearestPointOnWall(e,wall),push=wallThickness(wall)/2+e.r+48,ex=p.x+dx/d*push,ey=p.y+dy/d*push;
  if(Math.hypot(ex-e.x,ey-e.y)<=CONFIG.BURROWER.BURROW_DISTANCE&&!pointBlockedByTerrain(ex,ey,e.r+2)){
   e.burrowed=true;e.burrowTimer=CONFIG.BURROWER.BURROW_TIME;e.burrowExit={x:Math.max(e.r,Math.min(WORLD_W-e.r,ex)),y:Math.max(e.r,Math.min(WORLD_H-e.r,ey))};fx24({kind:'burrow',x:e.x,y:e.y,expires:performance.now()+320});return;
  }
 }
 moveWithWalls(e,tx,ty,speed,dt);
}
function updateClimber(e,tx,ty,speed,dt){
 const dx=tx-e.x,dy=ty-e.y,d=Math.hypot(dx,dy)||1,step=speed*dt,nx=e.x+dx/d*step,ny=e.y+dy/d*step,wall=wallAtPointForEnemy(nx,ny,e.r+2);
 if(wall){e.climbing=true;moveDirectIgnoringWalls(e,tx,ty,speed*CONFIG.CLIMBER.CLIMB_SPEED_FACTOR,dt);}else{e.climbing=false;moveWithWalls(e,tx,ty,speed,dt);}
}
function updateCrusher(e,tx,ty,speed,dt){
 e.chargeCooldown=Math.max(0,(e.chargeCooldown||0)-dt);
 if(e.chargeWindup>0){e.chargeWindup=Math.max(0,e.chargeWindup-dt);if(e.chargeWindup<=0)e.charging=true;return;}
 if(e.charging){
  const wall=state.structures.find(s=>s.id===e.chargeWallId&&s.type==='wall'&&s.built);if(!wall){e.charging=false;e.chargeCooldown=CONFIG.CRUSHER.CHARGE_COOLDOWN;return;}
  const p=nearestPointOnWall(e,wall),d=Math.hypot(e.x-p.x,e.y-p.y);if(d<=e.r+wallThickness(wall)/2+7){damageTarget(wall,CONFIG.CRUSHER.CHARGE_DAMAGE);e.charging=false;e.chargeCooldown=CONFIG.CRUSHER.CHARGE_COOLDOWN;fx24({kind:'impact',x:p.x,y:p.y,r:46,expires:performance.now()+250});return;}
  moveDirectIgnoringWalls(e,p.x,p.y,speed*CONFIG.CRUSHER.CHARGE_SPEED_MULTIPLIER,dt);return;
 }
 const wall=wallBlockingDirect(e,tx,ty,CONFIG.CRUSHER.CHARGE_SCAN_RANGE);if(wall&&e.chargeCooldown<=0){e.chargeWallId=wall.id;e.chargeWindup=CONFIG.CRUSHER.CHARGE_WINDUP;fx24({kind:'charge',x:e.x,y:e.y,expires:performance.now()+CONFIG.CRUSHER.CHARGE_WINDUP*1000});return;}
 moveWithWalls(e,tx,ty,speed,dt);
}
function acidAttack(e,t,dt){
 e.specialCooldown=(e.specialCooldown||0)-dt;if(e.specialCooldown>0)return;
 damageTarget(t,CONFIG.ACID_LOBBER.SHOT_DAMAGE);applyAcid(t);e.specialCooldown=CONFIG.ACID_LOBBER.FIRE_INTERVAL;const x=t.type==='wall'?(t.x1+t.x2)/2:t.x,y=t.type==='wall'?(t.y1+t.y2)/2:t.y;fx24({kind:'acid',x1:e.x,y1:e.y,x2:x,y2:y,expires:performance.now()+260});
}

// -----------------------------------------------------------------------------
// Full enemy update. This replaces the older generic movement pass so all special
// behaviors, Landing Pad attraction, Walls, Cryo slow and armor corrosion agree.
// -----------------------------------------------------------------------------
updateEnemies=function(dt){
 for(const s of state.structures)if((s.acidTime||0)>0)s.acidTime=Math.max(0,s.acidTime-dt);
 for(const e of [...state.enemies]){
  if(e.hp<=0)continue;
  if(e.burn>0){e.burn-=dt;e.burnTick-=dt;if(e.burnTick<=0){hitEnemy(e,CONFIG.FLAME.BURN_TICK_DAMAGE*state.mods.flameDamage);e.burnTick=CONFIG.FLAME.BURN_TICK_INTERVAL;if(e.hp<=0)continue;}}
  if((e.slowTime||0)>0)e.slowTime=Math.max(0,e.slowTime-dt);else e.slowFactor=1;
  if(e.type==='saboteur')e.cloaked=!saboteurDetected(e);
  const slow=(e.slowTime||0)>0?(e.slowFactor||1):1,speed=e.speed*slow,lure=lureFor(e);
  let tx=lure?lure.x:BASE_X,ty=lure?lure.y:BASE_Y,target=lure,attacked=false;

  if(!lure){
   if(e.type==='siegebeast')target=nearestWall(e)||nearestOf([...combatStructures(),...economyStructures()],e);
   else if(e.type==='harvesterhunter')target=hunterTarget(e);
   else if(e.type==='saboteur')target=saboteurTarget(e);
   else if(e.type==='acidlobber')target=acidTarget(e);
   if(target){tx=target.type==='wall'?nearestPointOnWall(e,target).x:target.x;ty=target.type==='wall'?nearestPointOnWall(e,target).y:target.y;}
  }

  if(e.type==='flyer'){
   const d=Math.hypot(e.x-tx,e.y-ty);if(target&&target!==lure&&d<=playerMeleeRange(e,target)){damageTarget(target,e.damage*dt);attacked=true;}else if(lure&&d<=playerMeleeRange(e,lure)){damageTarget(lure,e.damage*dt);attacked=true;}else moveDirectIgnoringWalls(e,tx,ty,speed,dt);
  }else if(e.type==='spitter'){
   e.rangeCooldown-=dt;const t=lure||closestAttackTarget(e,CONFIG.RANGED_ALIEN.ATTACK_RANGE,true);if(t&&targetDistance(e,t)<=CONFIG.RANGED_ALIEN.ATTACK_RANGE){if(e.rangeCooldown<=0){fireEnemyShot(e,t);e.rangeCooldown=CONFIG.RANGED_ALIEN.FIRE_INTERVAL;}attacked=true;}else moveWithWalls(e,tx,ty,speed*.78,dt);
  }else if(e.type==='acidlobber'){
   const t=target;if(t&&targetDistance(e,t)<=CONFIG.ACID_LOBBER.ATTACK_RANGE){acidAttack(e,t,dt);attacked=true;}else if(t)moveWithWalls(e,tx,ty,speed,dt);else moveWithWalls(e,BASE_X,BASE_Y,speed,dt);
  }else if(e.type==='siegebeast'){
   if(target&&targetDistance(e,target)<=playerMeleeRange(e,target)){damageTarget(target,e.damage*CONFIG.SIEGE_BEAST.WALL_DAMAGE_MULTIPLIER*dt);attacked=true;}else if(target)moveWithWalls(e,tx,ty,speed,dt,CONFIG.SIEGE_BEAST.WALL_DAMAGE_MULTIPLIER);else moveWithWalls(e,BASE_X,BASE_Y,speed,dt,CONFIG.SIEGE_BEAST.WALL_DAMAGE_MULTIPLIER);
  }else if(e.type==='burrower'){
   if(target&&targetDistance(e,target)<=playerMeleeRange(e,target)){damageTarget(target,e.damage*dt);attacked=true;}else updateBurrower(e,tx,ty,speed,dt);
  }else if(e.type==='climber'){
   const localTarget=target||closestAttackTarget(e,CONFIG.TOWER_DURABILITY.MELEE_AGGRO_RANGE,false);if(localTarget&&targetDistance(e,localTarget)<=playerMeleeRange(e,localTarget)){damageTarget(localTarget,e.damage*dt);attacked=true;}else updateClimber(e,tx,ty,speed,dt);
  }else if(e.type==='crusher'){
   const localTarget=target||closestAttackTarget(e,CONFIG.TOWER_DURABILITY.MELEE_AGGRO_RANGE,false);if(localTarget&&localTarget.type!=='wall'&&targetDistance(e,localTarget)<=playerMeleeRange(e,localTarget)){damageTarget(localTarget,e.damage*dt);attacked=true;}else updateCrusher(e,tx,ty,speed,dt);
  }else if(e.type==='harvesterhunter'||e.type==='saboteur'){
   if(target&&targetDistance(e,target)<=playerMeleeRange(e,target)){damageTarget(target,e.damage*dt);attacked=true;}else if(target)moveWithWalls(e,tx,ty,speed,dt);else moveWithWalls(e,BASE_X,BASE_Y,speed,dt);
  }else{
   const localTarget=lure||closestAttackTarget(e,CONFIG.TOWER_DURABILITY.MELEE_AGGRO_RANGE,false);if(localTarget&&targetDistance(e,localTarget)<=playerMeleeRange(e,localTarget)){damageTarget(localTarget,e.damage*dt);attacked=true;}else moveWithWalls(e,tx,ty,speed,dt);
  }

  if(!lure&&!attacked&&Math.hypot(e.x-BASE_X,e.y-BASE_Y)<BASE_RADIUS+e.r){const i=state.enemies.indexOf(e);if(i>=0)state.enemies.splice(i,1);if(!state.debug.unlimitedLives)state.baseHp-=e.damage;}
 }
 cleanupDestroyed();
};

// Enemy projectiles also respect Acid corrosion on structures.
updateProjectiles=function(dt){
 for(let i=state.bullets.length-1;i>=0;i--){const b=state.bullets[i];b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;if(b.life<=0){state.bullets.splice(i,1);continue;}let hit=false;for(const e of state.enemies){if(!enemyTargetableFrom(e,b.x,b.y))continue;if(Math.hypot(b.x-e.x,b.y-e.y)<e.r+5){hitEnemy(e,b.dmg);hit=true;break;}}if(hit)state.bullets.splice(i,1);}
 for(let i=state.enemyBullets.length-1;i>=0;i--){const b=state.enemyBullets[i];b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;const valid=state.units.includes(b.target)||state.structures.includes(b.target);if(!valid||b.life<=0){state.enemyBullets.splice(i,1);continue;}if(Math.hypot(b.x-b.target.x,b.y-b.target.y)<structureOrUnitRadius(b.target)+5){damageTarget(b.target,b.dmg);state.enemyBullets.splice(i,1);}}
 cleanupDestroyed();
};

// -----------------------------------------------------------------------------
// Visual readability for the expanded enemy roster.
// -----------------------------------------------------------------------------
const v23DrawEnemyV24=drawEnemy;
drawEnemy=function(e){
 if(!['ravager','siegebeast','burrower','climber','acidlobber','crusher','harvesterhunter','saboteur'].includes(e.type))return v23DrawEnemyV24(e);
 ctx.save();ctx.translate(e.x,e.y);
 if(e.type==='ravager'){
  ctx.fillStyle='#78b95f';ctx.beginPath();ctx.moveTo(0,-9);ctx.lineTo(8,-2);ctx.lineTo(6,8);ctx.lineTo(-6,8);ctx.lineTo(-8,-2);ctx.closePath();ctx.fill();ctx.fillStyle='#d7ef98';ctx.beginPath();ctx.arc(0,-2,2.5,0,Math.PI*2);ctx.fill();
 }else if(e.type==='siegebeast'){
  ctx.fillStyle='#75523d';ctx.beginPath();ctx.ellipse(0,0,24,18,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#b98254';for(const x of [-15,-5,5,15])ctx.fillRect(x-3,-17,6,13);ctx.fillStyle='#f0c078';ctx.beginPath();ctx.moveTo(-22,-8);ctx.lineTo(-34,-18);ctx.lineTo(-26,2);ctx.fill();ctx.beginPath();ctx.moveTo(22,-8);ctx.lineTo(34,-18);ctx.lineTo(26,2);ctx.fill();
 }else if(e.type==='burrower'){
  if(e.burrowed){ctx.globalAlpha=.65;ctx.fillStyle='#6e5a38';ctx.beginPath();ctx.ellipse(0,0,18,7,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#b99a61';ctx.setLineDash([4,4]);ctx.beginPath();ctx.arc(0,0,16,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);}else{ctx.fillStyle='#7a6b45';ctx.beginPath();ctx.ellipse(0,0,13,8,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#d2b66f';ctx.beginPath();ctx.moveTo(-12,0);ctx.lineTo(-21,-7);ctx.lineTo(-18,5);ctx.fill();ctx.beginPath();ctx.moveTo(12,0);ctx.lineTo(21,-7);ctx.lineTo(18,5);ctx.fill();}
 }else if(e.type==='climber'){
  ctx.fillStyle=e.climbing?'#d7ff72':'#9bd34f';ctx.beginPath();ctx.arc(0,0,8,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#eaffaa';ctx.lineWidth=2;for(let i=0;i<4;i++){const a=i*Math.PI/2+.35;ctx.beginPath();ctx.moveTo(Math.cos(a)*6,Math.sin(a)*6);ctx.lineTo(Math.cos(a)*15,Math.sin(a)*15);ctx.stroke();}
 }else if(e.type==='acidlobber'){
  ctx.fillStyle='#3f6c38';ctx.beginPath();ctx.arc(0,0,12,0,Math.PI*2);ctx.fill();ctx.fillStyle='#98ff5b';ctx.beginPath();ctx.arc(3,-3,7,0,Math.PI*2);ctx.fill();ctx.fillStyle='#d9ff9b';ctx.beginPath();ctx.arc(5,-5,2,0,Math.PI*2);ctx.fill();
 }else if(e.type==='crusher'){
  ctx.fillStyle='#9c4835';ctx.beginPath();ctx.ellipse(0,0,18,13,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#f08d55';ctx.beginPath();ctx.moveTo(-15,-7);ctx.lineTo(-27,-14);ctx.lineTo(-20,1);ctx.fill();ctx.beginPath();ctx.moveTo(15,-7);ctx.lineTo(27,-14);ctx.lineTo(20,1);ctx.fill();if(e.chargeWindup>0){ctx.strokeStyle='#ffdb64';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,25+Math.sin(performance.now()/70)*3,0,Math.PI*2);ctx.stroke();}
 }else if(e.type==='harvesterhunter'){
  ctx.fillStyle='#d05290';ctx.beginPath();ctx.moveTo(0,-12);ctx.lineTo(14,0);ctx.lineTo(0,12);ctx.lineTo(-14,0);ctx.closePath();ctx.fill();ctx.fillStyle='#7be8ff';ctx.fillRect(-3,-5,6,10);
 }else{
  ctx.globalAlpha=e.cloaked?.35:1;ctx.fillStyle='#3b7f84';ctx.beginPath();ctx.moveTo(0,-11);ctx.lineTo(9,-3);ctx.lineTo(6,10);ctx.lineTo(-6,10);ctx.lineTo(-9,-3);ctx.closePath();ctx.fill();ctx.strokeStyle='#85eef1';ctx.lineWidth=1.5;ctx.stroke();ctx.globalAlpha=1;
 }
 if(e.hp<e.maxHp&&!e.burrowed){const w=e.type==='siegebeast'?58:e.type==='crusher'?42:28;ctx.fillStyle='#111';ctx.fillRect(-w/2,-e.r-10,w,3);ctx.fillStyle='#ef6666';ctx.fillRect(-w/2,-e.r-10,w*Math.max(0,e.hp/e.maxHp),3);}ctx.restore();
};

const v23DrawStructureV24=drawStructure;
drawStructure=function(s){v23DrawStructureV24(s);if((s.acidTime||0)<=0||!s.built)return;ctx.save();ctx.translate(s.x,s.y);ctx.strokeStyle='rgba(155,255,70,.85)';ctx.lineWidth=3;ctx.setLineDash([5,4]);ctx.beginPath();ctx.arc(0,0,structureRadius(s)+7,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#b8ff72';ctx.font='bold 9px Arial';ctx.textAlign='center';ctx.fillText('CORRODED',0,structureRadius(s)+20);ctx.restore();};

const v23DrawV24=draw;
draw=function(){
 v23DrawV24();const now=performance.now();state.v24Effects=state.v24Effects.filter(f=>f.expires>now);if(!state.v24Effects.length)return;ctx.save();ctx.translate(-state.camera.x,-state.camera.y);
 for(const f of state.v24Effects){const a=Math.max(.12,(f.expires-now)/1000);ctx.globalAlpha=Math.min(1,a*2.5);
  if(f.kind==='acid'){ctx.strokeStyle='#9dff4f';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(f.x1,f.y1);ctx.quadraticCurveTo((f.x1+f.x2)/2,(f.y1+f.y2)/2-45,f.x2,f.y2);ctx.stroke();ctx.fillStyle='rgba(130,255,60,.28)';ctx.beginPath();ctx.arc(f.x2,f.y2,18,0,Math.PI*2);ctx.fill();}
  else if(f.kind==='charge'){ctx.strokeStyle='#ffd35e';ctx.lineWidth=3;ctx.beginPath();ctx.arc(f.x,f.y,34,0,Math.PI*2);ctx.stroke();}
  else if(f.kind==='impact'){ctx.fillStyle='rgba(255,120,65,.28)';ctx.strokeStyle='#ff8658';ctx.lineWidth=4;ctx.beginPath();ctx.arc(f.x,f.y,f.r,0,Math.PI*2);ctx.fill();ctx.stroke();}
  else{ctx.strokeStyle=f.kind==='emerge'?'#d7bd78':'#987443';ctx.lineWidth=3;ctx.setLineDash([5,4]);ctx.beginPath();ctx.arc(f.x,f.y,24,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);}
 }
 ctx.restore();ctx.globalAlpha=1;
};

const v23ResetV24=reset;
reset=function(){v23ResetV24();state.v24Effects=[];};
els.restart.onclick=reset;
