// Alien Planet Defense v38
// Horde pacing pass: slower enemies, large discrete hordes, long recovery gaps,
// and lower per-enemy durability/damage so quantity becomes the main pressure.
document.title='Alien Planet Defense v38';

(function installV38HordePacing(){
  const V38={
    FIRST_HORDE_DELAY:26,
    BASE_GAP:48,
    MIN_GAP:36,
    GAP_DROP_PER_MINUTE:1.2,
    START_SIZE:34,
    SIZE_PER_MINUTE:6,
    MAX_SIZE:100,
    SPAWN_BATCH:5,
    BATCH_INTERVAL:.50,
    START_RADIUS:1500,
    MAX_RADIUS:2350,
    RADIUS_GROWTH_PER_SECOND:.85,
    ARC_WIDTH:.62,
    RADIAL_JITTER:300
  };

  // The old director already halved enemy speed. Reduce it further so the new
  // threat comes from mass and positioning rather than individual sprint speed.
  CONFIG.DIRECTOR.ENEMY_SPEED_MULTIPLIER=.30;

  // Ranged/special attacks bypass e.damage in a few legacy paths, so lower those
  // direct-hit values once as part of the horde rebalance.
  if(!window.__v38DirectDamageTuned){
    window.__v38DirectDamageTuned=true;
    if(CONFIG.ACID_LOBBER?.SHOT_DAMAGE)CONFIG.ACID_LOBBER.SHOT_DAMAGE*=.70;
    if(CONFIG.CRUSHER?.CHARGE_DAMAGE)CONFIG.CRUSHER.CHARGE_DAMAGE*=.72;
  }

  function v38Balance(type){
    if(type==='swarm'||type==='ravager'||type==='runner')return{hp:.58,damage:.55};
    if(type==='climber'||type==='harvesterhunter')return{hp:.62,damage:.58};
    if(type==='spitter'||type==='flyer'||type==='burrower'||type==='saboteur')return{hp:.68,damage:.60};
    if(type==='brute')return{hp:.72,damage:.64};
    if(type==='acidlobber')return{hp:.76,damage:.66};
    if(type==='crusher')return{hp:.80,damage:.68};
    if(type==='siegebeast')return{hp:.86,damage:.72};
    return{hp:.68,damage:.62};
  }

  function v38TuneSpawnedEnemy(e,hordeNo){
    if(!e)return;
    const b=v38Balance(e.type);
    e.maxHp=Math.max(1,e.maxHp*b.hp);
    e.hp=Math.min(e.maxHp,Math.max(1,e.hp*b.hp));
    e.damage=Math.max(.2,(Number(e.damage)||1)*b.damage);
    e.v38DamageMult=b.damage;
    e.v38Horde=true;
    e.v38HordeNo=hordeNo;
  }

  // Preserve the current enemy projectile implementation, but scale bullets fired
  // by horde enemies. Cache guards do not carry v38DamageMult and remain local.
  if(typeof fireEnemyShot==='function'){
    const v37FireEnemyShotV38=fireEnemyShot;
    fireEnemyShot=function(e,t){
      const before=state.enemyBullets?.length||0;
      const result=v37FireEnemyShotV38(e,t);
      if(e?.v38DamageMult&&state.enemyBullets?.length>before){
        const b=state.enemyBullets[state.enemyBullets.length-1];
        if(b&&Number.isFinite(b.dmg))b.dmg*=e.v38DamageMult;
      }
      return result;
    };
  }

  function v38HordeSize(){
    const minute=Math.floor((state.elapsed||0)/60);
    return Math.min(V38.MAX_SIZE,V38.START_SIZE+minute*V38.SIZE_PER_MINUTE);
  }
  function v38Gap(){
    const minute=Math.floor((state.elapsed||0)/60);
    return Math.max(V38.MIN_GAP,V38.BASE_GAP-minute*V38.GAP_DROP_PER_MINUTE);
  }
  function v38SpawnRadius(){
    return Math.min(V38.MAX_RADIUS,V38.START_RADIUS+(state.elapsed||0)*V38.RADIUS_GROWTH_PER_SECOND);
  }

  function v38PointBlocked(x,y,r){
    if(x<r+24||y<r+24||x>WORLD_W-r-24||y>WORLD_H-r-24)return true;
    try{if(typeof pointBlockedByTerrain==='function'&&pointBlockedByTerrain(x,y,r*.65))return true;}catch{}
    return false;
  }

  function v38HordePoint(e,director){
    const radius=director.spawnRadius;
    for(let tries=0;tries<20;tries++){
      const a=director.angle+(Math.random()-.5)*V38.ARC_WIDTH;
      const rr=radius+(Math.random()-.5)*V38.RADIAL_JITTER;
      const x=BASE_X+Math.cos(a)*rr,y=BASE_Y+Math.sin(a)*rr;
      if(!v38PointBlocked(x,y,(e?.r||8)+8))return{x,y};
    }
    const x=Math.max(30,Math.min(WORLD_W-30,BASE_X+Math.cos(director.angle)*radius));
    const y=Math.max(30,Math.min(WORLD_H-30,BASE_Y+Math.sin(director.angle)*radius));
    return{x,y};
  }

  function v38SpawnOne(director){
    const before=state.enemies.length;

    // Hordes are mostly fodder. Specials still appear, but at a lower share than
    // the continuous director used, otherwise 80+ enemy waves become all elites.
    const sp=CONFIG.SPECIAL_ENEMIES,oldBase=sp?.BASE_CHANCE,oldMax=sp?.MAX_CHANCE;
    const oldFlyer=CONFIG.FLYER?.SPAWN_CHANCE,oldSpitter=CONFIG.RANGED_ALIEN?.SPAWN_CHANCE;
    if(sp){sp.BASE_CHANCE=Math.min(Number(oldBase)||.08,.05);sp.MAX_CHANCE=Math.min(Number(oldMax)||.36,.18);}
    if(CONFIG.FLYER)CONFIG.FLYER.SPAWN_CHANCE=Math.min(Number(oldFlyer)||.10,.06);
    if(CONFIG.RANGED_ALIEN)CONFIG.RANGED_ALIEN.SPAWN_CHANCE=Math.min(Number(oldSpitter)||.03,.035);
    try{spawnEnemy();}
    finally{
      if(sp){sp.BASE_CHANCE=oldBase;sp.MAX_CHANCE=oldMax;}
      if(CONFIG.FLYER)CONFIG.FLYER.SPAWN_CHANCE=oldFlyer;
      if(CONFIG.RANGED_ALIEN)CONFIG.RANGED_ALIEN.SPAWN_CHANCE=oldSpitter;
    }

    if(state.enemies.length<=before)return;
    const e=state.enemies[state.enemies.length-1];
    if(!e||e.v37GuardBoxId)return;
    const p=v38HordePoint(e,director);e.x=p.x;e.y=p.y;
    v38TuneSpawnedEnemy(e,director.hordeNo);
  }

  function v38BeginHorde(director){
    director.hordeNo++;
    director.queue=v38HordeSize();
    director.batchTimer=0;
    director.angle=Math.random()*Math.PI*2;
    director.spawnRadius=v38SpawnRadius();
    director.nextHordeIn=Infinity;
  }

  function v38InitDirector(){
    state.v38Director={
      hordeNo:0,
      queue:0,
      batchTimer:0,
      nextHordeIn:V38.FIRST_HORDE_DELAY,
      angle:0,
      spawnRadius:V38.START_RADIUS
    };
    // Disable the legacy continuous timer. v38 updateDirector owns normal spawns.
    state.spawnTimer=999999;
  }

  // Replace continuous trickle spawning with discrete, very large hordes. Each
  // horde itself enters in short batches to avoid a single-frame CPU spike.
  updateDirector=function(dt){
    if(!state.v38Director)v38InitDirector();
    const d=state.v38Director;
    if(d.queue>0){
      d.batchTimer-=dt;
      while(d.queue>0&&d.batchTimer<=0){
        const n=Math.min(V38.SPAWN_BATCH,d.queue);
        for(let i=0;i<n;i++)v38SpawnOne(d);
        d.queue-=n;
        d.batchTimer+=V38.BATCH_INTERVAL;
      }
      if(d.queue<=0)d.nextHordeIn=v38Gap();
      return;
    }
    d.nextHordeIn-=dt;
    if(d.nextHordeIn<=0)v38BeginHorde(d);
  };

  const v37ResetV38=reset;
  reset=function(){
    v37ResetV38();
    v38InitDirector();
    if(typeof updateHud==='function')updateHud();
  };
  if(els?.restart)els.restart.onclick=reset;

  // The title-screen preview is already initialized and paused; prepare its first
  // horde without resetting the map/caches/fog again.
  if(state)v38InitDirector();

  const guide=document.querySelector('#guidePanel .guide-grid');
  if(guide&&!document.getElementById('v38HordeGuide')){
    const d=document.createElement('div');d.className='guide-box';d.id='v38HordeGuide';
    d.innerHTML='<b>Enemy Hordes</b><p>Enemies now attack in large, slow-moving hordes instead of a constant trickle. Early hordes contain roughly 34 aliens and grow toward about 100 later in a run. Expect long recovery gaps between attacks. Individual aliens are slower, have less HP and deal less damage so positioning, area damage and crowd control matter more than fighting a few high-stat enemies.</p>';
    guide.appendChild(d);
  }
})();
