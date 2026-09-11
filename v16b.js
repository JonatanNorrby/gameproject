// -----------------------------------------------------------------------------
// MINING / TRUCK LOGISTICS / REFINING / LANDING SHIPS
// -----------------------------------------------------------------------------
function mineCfg(s){return s.type==='oremine'?CONFIG.ORE:CONFIG.CRYSTALS;}
function mineCargoType(s){return s.type==='oremine'?'ore':'crystal';}
function updateResourceMines(dt){
 for(const s of state.structures){
  if((s.type!=='mine'&&s.type!=='oremine')||!s.built)continue;
  const depot=state.depots.find(d=>d.id===s.depotId);if(!depot||depot.stock<=0)continue;
  const cfg=mineCfg(s),cap=cfg.MINE_STORAGE*state.mods.mineStorage,amount=Math.min(cfg.MINE_RATE*state.mods.mineRate*dt,depot.stock,cap-s.stored);
  if(amount>0){s.stored+=amount;depot.stock-=amount;}
 }
}
function nearestStructure(u,type,range){let best=null,bd=range;for(const s of state.structures){if(s.type!==type||!s.built)continue;const d=Math.hypot(u.x-s.x,u.y-s.y);if(d<bd){best=s;bd=d;}}return best;}
updateTruckEconomy=function(){
 for(const u of state.units){
  if(u.type!=='truck')continue;
  const cap=Math.round(CONFIG.TRUCK.CAPACITY*state.mods.truckCapacity);
  if(u.cargo<cap){
   let mine=null,bd=CONFIG.TRUCK.PICKUP_RANGE;
   for(const s of state.structures){
    if((s.type!=='mine'&&s.type!=='oremine')||!s.built||s.stored<=0)continue;
    const type=mineCargoType(s);if(u.cargoType&&u.cargoType!==type)continue;
    const d=Math.hypot(u.x-s.x,u.y-s.y);if(d<bd){mine=s;bd=d;}
   }
   if(mine){const type=mineCargoType(mine),take=Math.min(cap-u.cargo,mine.stored);u.cargoType=type;u.cargo+=take;mine.stored-=take;}
  }
  if(u.cargo<=0){u.cargo=0;u.cargoType=null;continue;}
  if(u.cargoType==='crystal'){
   const pad=nearestStructure(u,'landingpad',CONFIG.LANDING_PAD.TRUCK_UNLOAD_RANGE);
   if(pad){pad.crystalStored+=u.cargo;els.message.textContent=`Truck deposited ${Math.floor(u.cargo)} crystal on Landing Pad.`;u.cargo=0;u.cargoType=null;}
  }else if(u.cargoType==='ore'){
   const r=nearestStructure(u,'refinery',CONFIG.REFINERY.UNLOAD_RANGE);
   if(r){const room=Math.max(0,CONFIG.REFINERY.ORE_CAPACITY-r.oreStored),take=Math.min(room,u.cargo);if(take>0){r.oreStored+=take;u.cargo-=take;if(u.cargo<=.001){u.cargo=0;u.cargoType=null;}}}
  }
 }
};
function updateRefineries(dt){
 for(const s of state.structures){if(s.type!=='refinery'||!s.built||s.oreStored<=0)continue;const amount=Math.min(s.oreStored,CONFIG.REFINERY.REFINE_RATE*dt);s.oreStored-=amount;state.metal+=amount*CONFIG.REFINERY.METAL_PER_ORE;}
}
function attractEnemiesToPad(pad){
 let count=0;for(const e of state.enemies){if(Math.hypot(e.x-pad.x,e.y-pad.y)<=CONFIG.LANDING_PAD.ATTRACT_RADIUS){e.attractedTo=pad.id;count++;}}
 pad.landingFlash=2.5;els.message.textContent=`Supply ship landed — ${count} nearby aliens were attracted to the Landing Pad.`;
}
function updateLandingPads(dt){
 for(const s of state.structures){
  if(s.type!=='landingpad'||!s.built)continue;
  if(s.landingFlash>0)s.landingFlash=Math.max(0,s.landingFlash-dt);
  if(s.shipState==='cooldown'){
   s.shipCooldown=Math.max(0,s.shipCooldown-dt);
   if(s.shipCooldown<=0){s.shipState='landed';s.shipCargo=0;attractEnemiesToPad(s);}
  }
  if(s.shipState==='landed'){
   const room=CONFIG.LANDING_PAD.SHIP_CAPACITY-s.shipCargo,take=Math.min(room,s.crystalStored);if(take>0){s.crystalStored-=take;s.shipCargo+=take;}
   if(s.shipCargo>=CONFIG.LANDING_PAD.SHIP_CAPACITY-.001){
    const sold=CONFIG.LANDING_PAD.SHIP_CAPACITY,gold=Math.round(sold*CONFIG.CRYSTALS.GOLD_PER_CRYSTAL);if(!state.debug.unlimitedCash)state.credits+=gold;
    s.shipCargo=0;s.shipState='cooldown';s.shipCooldown=CONFIG.LANDING_PAD.COOLDOWN;els.message.textContent=`Export ship launched full: ${sold} crystal sold for ${gold} gold.`;
   }
  }
 }
}
updateMines=function(dt){updateResourceMines(dt);updateRefineries(dt);updateLandingPads(dt);};

// -----------------------------------------------------------------------------
// ENEMY ATTRACTION + SHAPED TERRAIN MOVEMENT
// -----------------------------------------------------------------------------
function moveEnemyToward(e,tx,ty,speed,dt){
 const dx=tx-e.x,dy=ty-e.y,d=Math.hypot(dx,dy)||1,base=Math.atan2(dy,dx),step=speed*dt;
 const offsets=[0,.42,-.42,.78,-.78,1.12,-1.12,1.48,-1.48];
 for(const off of offsets){const a=base+off,nx=e.x+Math.cos(a)*step,ny=e.y+Math.sin(a)*step;if(!pointBlockedByTerrain(nx,ny,e.r+1)){e.x=nx;e.y=ny;return;}}
}
updateEnemies=function(dt){
 for(const e of [...state.enemies]){
  if(e.burn>0){e.burn-=dt;e.burnTick-=dt;if(e.burnTick<=0){hitEnemy(e,CONFIG.FLAME.BURN_TICK_DAMAGE*state.mods.flameDamage);e.burnTick=CONFIG.FLAME.BURN_TICK_INTERVAL;if(e.hp<=0)continue;}}
  let speed=e.speed,attacking=false;
  const lure=e.attractedTo?state.structures.find(s=>s.id===e.attractedTo&&s.type==='landingpad'&&s.built):null;
  if(e.attractedTo&&!lure)e.attractedTo=null;
  if(lure){
   const d=Math.hypot(e.x-lure.x,e.y-lure.y);
   if(e.type==='spitter'){
    e.rangeCooldown-=dt;if(d<=CONFIG.RANGED_ALIEN.ATTACK_RANGE){speed=0;if(e.rangeCooldown<=0){fireEnemyShot(e,lure);e.rangeCooldown=CONFIG.RANGED_ALIEN.FIRE_INTERVAL;}}
   }else if(d<=CONFIG.TOWER_DURABILITY.MELEE_ATTACK_RANGE+e.r+structureRadius(lure)){
    lure.hp-=e.damage*CONFIG.TOWER_DURABILITY.MELEE_DAMAGE_MULTIPLIER*dt;speed=0;attacking=true;
   }
   if(speed>0&&!attacking)moveEnemyToward(e,lure.x,lure.y,speed,dt);
  }else{
   if(e.type==='spitter'){
    e.rangeCooldown-=dt;const t=closestAttackTarget(e,CONFIG.RANGED_ALIEN.ATTACK_RANGE,true);if(t){speed*=.22;if(e.rangeCooldown<=0){fireEnemyShot(e,t);e.rangeCooldown=CONFIG.RANGED_ALIEN.FIRE_INTERVAL;}}
   }else{
    const t=closestAttackTarget(e,CONFIG.TOWER_DURABILITY.MELEE_AGGRO_RANGE,false);if(t){const d=Math.hypot(e.x-t.x,e.y-t.y);if(d<CONFIG.TOWER_DURABILITY.MELEE_ATTACK_RANGE+e.r+structureOrUnitRadius(t)){t.hp-=e.damage*CONFIG.TOWER_DURABILITY.MELEE_DAMAGE_MULTIPLIER*dt;speed=0;attacking=true;}}
   }
   if(!attacking&&speed>0)moveEnemyToward(e,BASE_X,BASE_Y,speed,dt);
   if(Math.hypot(e.x-BASE_X,e.y-BASE_Y)<BASE_RADIUS+e.r){state.enemies.splice(state.enemies.indexOf(e),1);if(!state.debug.unlimitedLives)state.baseHp-=e.damage;}
  }
 }
 cleanupDestroyed();
};

cleanupDestroyed=function(){
 const deadTrucks=state.units.filter(u=>u.type==='truck'&&u.hp<=0);for(const t of deadTrucks)detachFollowersOfTruck(t);
 state.units=state.units.filter(u=>{if(u.hp>0)return true;if(state.selectedUnit===u)state.selectedUnit=null;return false;});
 state.structures=state.structures.filter(s=>{
  if(s.hp>0)return true;
  if(s.type==='mine'||s.type==='oremine'){const d=state.depots.find(x=>x.id===s.depotId);if(d)d.mineId=null;}
  if(s.safeSpotId){const p=state.structures.find(x=>x.id===s.safeSpotId);if(p)p.occupied=false;}
  if(s.type==='safespot')for(const other of state.structures)if(other.safeSpotId===s.id){other.safeSpotId=null;other.protected=false;}
  return false;
 });
};
