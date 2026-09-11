// Alien Planet Defense v37
// Fog/zoom alignment repair + guarded exploration resource caches.
document.title='Alien Planet Defense v37';

(function installV37ExplorationAndFogFix(){
  const CACHE_COUNT=6;
  const CACHE_CAPTURE_RADIUS=96;
  const CACHE_CAPTURE_TIME=4.5;
  const CACHE_ACTIVATION_RADIUS=620;
  const CACHE_GUARD_AGGRO=520;
  const CACHE_GUARD_LEASH=680;
  const CACHE_CONTEST_RADIUS=145;
  const CACHE_MIN_BASE_DISTANCE=760;
  const CACHE_MAX_BASE_DISTANCE=Math.min(2850,Math.min(WORLD_W,WORLD_H)*0.38);
  const CACHE_SEPARATION=760;

  // ---------------------------------------------------------------------------
  // FOG OF WAR: use exactly the same world->screen transform as the battlefield.
  // This fixes unit vision holes drifting/scaling incorrectly when zoom changes.
  // ---------------------------------------------------------------------------
  const V37_FOG_CELL=96;
  const V37_FOG_COLS=Math.ceil(WORLD_W/V37_FOG_CELL);
  const V37_FOG_ROWS=Math.ceil(WORLD_H/V37_FOG_CELL);
  const v37FogCanvas=document.createElement('canvas');
  v37FogCanvas.width=W;v37FogCanvas.height=H;
  const v37FogCtx=v37FogCanvas.getContext('2d');

  function v37Zoom(){
    const min=Number(CONFIG.WORLD.MIN_ZOOM)||0.18,max=Number(CONFIG.WORLD.MAX_ZOOM)||1.35;
    return Math.max(min,Math.min(max,Number(state?.camera?.zoom)||1));
  }
  function v37RoleCfg(u){
    try{return typeof roleConfig==='function'?(roleConfig(u)||{}):{};}catch{return {};}
  }
  function v37UnitVision(u){
    const role=typeof unitRole==='function'?unitRole(u):(u.role||u.type),cfg=v37RoleCfg(u);
    if(role==='scout')return 460;
    if(role==='spotter')return 440;
    if(role==='sniper')return 520;
    if((typeof isFlyingUnit==='function'&&isFlyingUnit(u))||u.type==='airunit')return 350;
    return Math.max(250,(Number(cfg.RANGE)||0)+65,Number(cfg.DETECT_RANGE)||0,Number(cfg.SPOT_RANGE)||0);
  }
  function v37StructureVision(s){
    if(!s?.built||s.hp<=0)return 0;
    try{if(typeof isUpgradeableTower==='function'&&isUpgradeableTower(s))return Math.max(265,(towerStats(s)?.range||0)+55);}catch{}
    if(s.type==='landingpad')return 330;
    if(s.type==='refinery'||s.type==='bunker')return 275;
    if(s.type==='mine'||s.type==='oremine')return 210;
    if(s.type==='wall')return 0;
    return 225;
  }
  function v37RefreshFog(){
    if(!state)return;
    if(!(state.v37FogExplored instanceof Uint8Array)||state.v37FogExplored.length!==V37_FOG_COLS*V37_FOG_ROWS){
      state.v37FogExplored=new Uint8Array(V37_FOG_COLS*V37_FOG_ROWS);
    }
    const sources=[{x:BASE_X,y:BASE_Y,r:390}];
    for(const u of state.units||[]){
      if(u.hp<=0||u.transportedIn||u.garrisonedIn)continue;
      sources.push({x:u.x,y:u.y,r:v37UnitVision(u)});
    }
    for(const s of state.structures||[]){
      const r=v37StructureVision(s);if(r>0)sources.push({x:s.x,y:s.y,r});
    }
    state.v37VisionSources=sources;
    // Synchronize older fog-aware targeting and v36 incoming-arrow filtering.
    state.v32VisionSources=sources;
    state.v36VisionSources=sources;

    for(const v of sources){
      const c0=Math.max(0,Math.floor((v.x-v.r)/V37_FOG_CELL));
      const c1=Math.min(V37_FOG_COLS-1,Math.floor((v.x+v.r)/V37_FOG_CELL));
      const r0=Math.max(0,Math.floor((v.y-v.r)/V37_FOG_CELL));
      const r1=Math.min(V37_FOG_ROWS-1,Math.floor((v.y+v.r)/V37_FOG_CELL));
      for(let gy=r0;gy<=r1;gy++)for(let gx=c0;gx<=c1;gx++){
        const cx=gx*V37_FOG_CELL+V37_FOG_CELL/2,cy=gy*V37_FOG_CELL+V37_FOG_CELL/2;
        if(Math.hypot(cx-v.x,cy-v.y)<=v.r+V37_FOG_CELL*.72)state.v37FogExplored[gy*V37_FOG_COLS+gx]=1;
      }
    }
  }
  function v37PointVisible(x,y){
    for(const v of state.v37VisionSources||[])if(Math.hypot(x-v.x,y-v.y)<=v.r)return true;
    return false;
  }
  function v37DrawFog(){
    const z=v37Zoom(),cam=state.camera,fc=v37FogCtx;
    fc.setTransform(1,0,0,1,0,0);fc.globalAlpha=1;fc.globalCompositeOperation='source-over';fc.clearRect(0,0,W,H);

    // IMPORTANT: draw the fog in WORLD coordinates with the identical transform
    // used by the zoomed battlefield. Unit/base vision can therefore never drift
    // relative to the unit sprite when zooming in or out.
    fc.setTransform(z,0,0,z,-cam.x*z,-cam.y*z);
    const wx0=cam.x,wy0=cam.y,wx1=Math.min(WORLD_W,cam.x+W/z),wy1=Math.min(WORLD_H,cam.y+H/z);
    const c0=Math.max(0,Math.floor(wx0/V37_FOG_CELL)),c1=Math.min(V37_FOG_COLS-1,Math.floor(wx1/V37_FOG_CELL));
    const r0=Math.max(0,Math.floor(wy0/V37_FOG_CELL)),r1=Math.min(V37_FOG_ROWS-1,Math.floor(wy1/V37_FOG_CELL));
    for(let gy=r0;gy<=r1;gy++)for(let gx=c0;gx<=c1;gx++){
      const explored=state.v37FogExplored?.[gy*V37_FOG_COLS+gx];
      fc.fillStyle=explored?'rgba(1,7,11,.62)':'rgba(0,1,3,.985)';
      fc.fillRect(gx*V37_FOG_CELL,gy*V37_FOG_CELL,V37_FOG_CELL+2/z,V37_FOG_CELL+2/z);
    }

    fc.globalCompositeOperation='destination-out';
    for(const v of state.v37VisionSources||[]){
      // Two concentric cuts provide a soft-ish edge without screen-space gradients.
      fc.globalAlpha=1;fc.fillStyle='#000';fc.beginPath();fc.arc(v.x,v.y,v.r*.84,0,Math.PI*2);fc.fill();
      fc.globalAlpha=.86;fc.beginPath();fc.arc(v.x,v.y,v.r,0,Math.PI*2);fc.fill();
    }
    fc.globalAlpha=1;fc.globalCompositeOperation='source-over';fc.setTransform(1,0,0,1,0,0);
    ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.drawImage(v37FogCanvas,0,0);ctx.restore();
  }

  try{refreshFogSourcesV32=v37RefreshFog;}catch{}
  try{pointVisibleV32=v37PointVisible;}catch{}
  try{drawFogOverlayV32=function(){};}catch{}

  // ---------------------------------------------------------------------------
  // RESOURCE CACHES: scarce early-game exploration rewards.
  // ---------------------------------------------------------------------------
  function v37CacheSpotBlocked(x,y){
    if(Math.hypot(x-BASE_X,y-BASE_Y)<CACHE_MIN_BASE_DISTANCE)return true;
    try{if(typeof pointBlockedByTerrain==='function'&&pointBlockedByTerrain(x,y,48))return true;}catch{}
    for(const d of state.depots||[])if(Math.hypot(x-d.x,y-d.y)<d.r+100)return true;
    for(const s of state.structures||[]){
      if(Number.isFinite(s.x)&&Number.isFinite(s.y)&&Math.hypot(x-s.x,y-s.y)<150)return true;
    }
    return false;
  }
  function v37GenerateCaches(){
    const out=[];let tries=0;
    while(out.length<CACHE_COUNT&&tries<1600){
      tries++;
      const a=Math.random()*Math.PI*2;
      const dist=CACHE_MIN_BASE_DISTANCE+Math.random()*(CACHE_MAX_BASE_DISTANCE-CACHE_MIN_BASE_DISTANCE);
      const x=BASE_X+Math.cos(a)*dist,y=BASE_Y+Math.sin(a)*dist;
      if(x<120||y<120||x>WORLD_W-120||y>WORLD_H-120)continue;
      if(v37CacheSpotBlocked(x,y))continue;
      if(out.some(c=>Math.hypot(x-c.x,y-c.y)<CACHE_SEPARATION))continue;
      out.push({id:`cache-${out.length}-${Math.random().toString(36).slice(2,7)}`,x,y,r:30,capture:0,captured:false,guardsSpawned:false});
    }
    return out;
  }
  function v37RewardForCache(){
    // Strongest in the opening minutes and deliberately fades into a minor bonus.
    const fade=Math.max(.35,1-Math.min(1,(state.elapsed||0)/900)*.65);
    const gold=Math.round((50+Math.random()*26)*fade);
    const metal=Math.max(1,Math.round((3+Math.random()*3)*fade));
    return{gold,metal};
  }
  function v37MakeGuard(type,box,x,y){
    let cfg;
    try{cfg=typeof enemyCfg==='function'?enemyCfg(type):null;}catch{}
    cfg=cfg||CONFIG.RAVAGER;
    const level=Math.floor((state.elapsed||0)/60)+1;
    const hp=(Number(cfg.BASE_HP)||6)+level*(Number(cfg.HP_PER_LEVEL)||.5);
    return{
      type,x,y,hp,maxHp:hp,
      speed:((Number(cfg.BASE_SPEED)||65)+level*(Number(cfg.SPEED_PER_LEVEL)||.5))*(Number(CONFIG.DIRECTOR.ENEMY_SPEED_MULTIPLIER)||.5),
      r:Number(cfg.RADIUS)||7,damage:Number(cfg.BASE_DAMAGE)||2,
      burn:0,burnTick:0,slowFactor:1,slowTime:0,animOffset:Math.random()*100,rangeCooldown:0,specialCooldown:0,
      v37GuardBoxId:box.id,v37GuardHomeX:x,v37GuardHomeY:y
    };
  }
  function v37GuardSpawnPoint(box,index,count){
    for(let n=0;n<14;n++){
      const a=(index/count)*Math.PI*2+n*.47+Math.random()*.25,dist=155+Math.random()*70;
      const x=box.x+Math.cos(a)*dist,y=box.y+Math.sin(a)*dist;
      if(x<20||y<20||x>WORLD_W-20||y>WORLD_H-20)continue;
      try{if(typeof navPointBlocked==='function'&&navPointBlocked(x,y,12))continue;}catch{}
      return{x,y};
    }
    return{x:box.x+150,y:box.y};
  }
  function v37SpawnCacheGuards(box){
    if(box.guardsSpawned||box.captured)return;
    box.guardsSpawned=true;
    const minute=Math.floor((state.elapsed||0)/60);
    const types=minute>=4?['ravager','runner','brute']:['ravager','ravager','runner'];
    for(let i=0;i<types.length;i++){
      const p=v37GuardSpawnPoint(box,i,types.length);
      state.enemies.push(v37MakeGuard(types[i],box,p.x,p.y));
    }
    if(els?.message)els.message.textContent='Resource cache disturbed — local aliens are defending it.';
  }
  function v37NearestCacheUnit(box,maxDist){
    let best=null,bd=maxDist;
    for(const u of state.units||[]){
      if(u.hp<=0||u.garrisonedIn||u.transportedIn)continue;
      const d=Math.hypot(u.x-box.x,u.y-box.y);if(d<bd){best=u;bd=d;}
    }
    return best;
  }
  function v37GuardBox(e){return (state.v37ResourceCaches||[]).find(b=>b.id===e.v37GuardBoxId);}
  function v37GuardTarget(box){return v37NearestCacheUnit(box,CACHE_GUARD_AGGRO);}
  function v37GuardBlocked(x,y,r){
    if(x<r||y<r||x>WORLD_W-r||y>WORLD_H-r)return true;
    try{if(typeof pointBlockedByTerrain==='function'&&pointBlockedByTerrain(x,y,r*.55))return true;}catch{}
    try{if(typeof wallAtPointForEnemy==='function'&&wallAtPointForEnemy(x,y,r+1))return true;}catch{}
    return false;
  }
  function v37StepGuard(e,tx,ty,speed,dt){
    const dx=tx-e.x,dy=ty-e.y,d=Math.hypot(dx,dy)||1,step=Math.min(d,speed*dt),base=Math.atan2(dy,dx);
    for(const off of [0,.48,-.48,.9,-.9,1.35,-1.35]){
      const a=base+off,nx=e.x+Math.cos(a)*step,ny=e.y+Math.sin(a)*step;
      if(v37GuardBlocked(nx,ny,e.r))continue;e.x=nx;e.y=ny;return true;
    }
    return false;
  }
  function v37UpdateGuards(dt,guards){
    for(const e of guards){
      if(e.hp<=0||!state.enemies.includes(e))continue;
      if(e.burn>0){
        e.burn-=dt;e.burnTick-=dt;
        if(e.burnTick<=0){
          try{hitEnemy(e,CONFIG.FLAME.BURN_TICK_DAMAGE*state.mods.flameDamage);}catch{e.hp-=CONFIG.FLAME.BURN_TICK_DAMAGE;}
          e.burnTick=CONFIG.FLAME.BURN_TICK_INTERVAL;if(e.hp<=0||!state.enemies.includes(e))continue;
        }
      }
      if((e.slowTime||0)>0)e.slowTime=Math.max(0,e.slowTime-dt);else e.slowFactor=1;
      const box=v37GuardBox(e);if(!box||box.captured){state.enemies.splice(state.enemies.indexOf(e),1);continue;}
      const target=v37GuardTarget(box),slow=(e.slowTime||0)>0?(e.slowFactor||1):1;
      let tx=e.v37GuardHomeX,ty=e.v37GuardHomeY;
      if(target){tx=target.x;ty=target.y;}
      else if(Math.hypot(e.x-box.x,e.y-box.y)>CACHE_GUARD_LEASH){tx=box.x;ty=box.y;}
      const d=Math.hypot(tx-e.x,ty-e.y);
      if(target){
        let rr=20;try{if(typeof uRadius==='function')rr=uRadius(target);}catch{}
        if(d<=e.r+rr+CONFIG.TOWER_DURABILITY.MELEE_ATTACK_RANGE){
          target.hp-=e.damage*CONFIG.TOWER_DURABILITY.MELEE_DAMAGE_MULTIPLIER*dt;continue;
        }
      }
      if(d>10){
        let speed=e.speed*slow;
        try{if(typeof pointInRiver==='function'&&pointInRiver(e.x,e.y))speed*=CONFIG.RIVERS.SLOW_FACTOR;}catch{}
        v37StepGuard(e,tx,ty,speed,dt);
      }
    }
  }

  // Keep cache guards completely out of the normal base-seeking enemy AI.
  const v36UpdateEnemiesV37=updateEnemies;
  updateEnemies=function(dt){
    const guards=(state.enemies||[]).filter(e=>e.v37GuardBoxId);
    state.enemies=(state.enemies||[]).filter(e=>!e.v37GuardBoxId);
    v36UpdateEnemiesV37(dt);
    const normal=state.enemies;
    state.enemies=normal.concat(guards.filter(e=>e.hp>0));
    v37UpdateGuards(dt,guards);
  };

  function v37UpdateCaches(dt){
    for(const box of state.v37ResourceCaches||[]){
      if(box.captured)continue;
      const activator=v37NearestCacheUnit(box,CACHE_ACTIVATION_RADIUS);
      if(activator&&!box.guardsSpawned)v37SpawnCacheGuards(box);
      const unit=v37NearestCacheUnit(box,CACHE_CAPTURE_RADIUS);
      const contested=(state.enemies||[]).some(e=>e.v37GuardBoxId===box.id&&e.hp>0&&Math.hypot(e.x-box.x,e.y-box.y)<=CACHE_CONTEST_RADIUS);
      if(unit&&!contested){
        box.capture=Math.min(CACHE_CAPTURE_TIME,box.capture+dt);
        if(box.capture>=CACHE_CAPTURE_TIME){
          box.captured=true;
          const reward=v37RewardForCache();
          if(!state.debug?.unlimitedCash)state.credits=(Number(state.credits)||0)+reward.gold;
          state.metal=(Number(state.metal)||0)+reward.metal;
          // Any surviving local guards disperse when the cache is secured.
          state.enemies=state.enemies.filter(e=>e.v37GuardBoxId!==box.id);
          if(els?.message)els.message.textContent=`Resource cache secured: +${reward.gold} gold, +${reward.metal} metal.`;
          if(typeof updateHud==='function')updateHud();
        }
      }else if(!unit){
        box.capture=Math.max(0,box.capture-dt*.35);
      }
    }
  }

  function v37DrawCache(box){
    ctx.save();ctx.translate(box.x,box.y);
    if(box.captured){
      ctx.globalAlpha=.35;ctx.fillStyle='#39444a';ctx.fillRect(-25,-18,50,36);ctx.strokeStyle='#75838a';ctx.lineWidth=2;ctx.strokeRect(-25,-18,50,36);ctx.globalAlpha=1;ctx.fillStyle='#a7b3b9';ctx.font='bold 9px Arial';ctx.textAlign='center';ctx.fillText('SECURED',0,34);ctx.restore();return;
    }
    ctx.fillStyle='#4b3920';ctx.fillRect(-28,-20,56,40);ctx.strokeStyle='#d7ad57';ctx.lineWidth=3;ctx.strokeRect(-28,-20,56,40);
    ctx.fillStyle='#7a5727';ctx.fillRect(-22,-14,44,9);ctx.fillRect(-22,5,44,9);
    ctx.fillStyle='#f4cf68';ctx.fillRect(-4,-20,8,40);
    ctx.fillStyle='#d7eef5';ctx.fillRect(-19,-5,10,10);ctx.fillStyle='#e4bd4e';ctx.beginPath();ctx.arc(15,0,5,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='rgba(3,9,13,.9)';ctx.fillRect(-34,29,68,15);ctx.strokeStyle='#526d7c';ctx.lineWidth=1;ctx.strokeRect(-34,29,68,15);
    const pct=Math.round((box.capture/CACHE_CAPTURE_TIME)*100);
    ctx.fillStyle='#dff7ff';ctx.font='bold 9px Arial';ctx.textAlign='center';ctx.fillText(box.capture>0?`CAPTURE ${pct}%`:'RESOURCE CACHE',0,40);
    if(box.capture>0){ctx.fillStyle='#172229';ctx.fillRect(-29,48,58,5);ctx.fillStyle='#71e09a';ctx.fillRect(-29,48,58*Math.min(1,box.capture/CACHE_CAPTURE_TIME),5);}
    ctx.restore();
  }

  const v36DrawBackdropV37=drawBackdrop;
  drawBackdrop=function(){
    v36DrawBackdropV37();
    for(const box of state.v37ResourceCaches||[])v37DrawCache(box);
  };

  // Run cache capture only while the simulation is actually advancing.
  const v36UpdateV37=update;
  update=function(dt){
    v36UpdateV37(dt);
    if(!state.paused&&!state.gameOver&&!state.choosing)v37UpdateCaches(dt);
  };

  function v37InitializeRun(){
    state.v37ResourceCaches=v37GenerateCaches();
    state.v37FogExplored=new Uint8Array(V37_FOG_COLS*V37_FOG_ROWS);
    state.v37VisionSources=[];
    v37RefreshFog();
  }

  // Draw the complete pre-v32 battlefield once, then one correctly transformed fog.
  // v33-v35 gameplay/render changes still apply because they override globals such
  // as drawUnit rather than replacing this pre-fog battlefield function.
  const v37SceneDraw=(typeof v31DrawV32==='function')?v31DrawV32:draw;
  draw=function(){v37RefreshFog();v37SceneDraw();v37DrawFog();};

  const v36ResetV37=reset;
  reset=function(){
    v36ResetV37();
    v37InitializeRun();
    if(typeof updateHud==='function')updateHud();
  };
  if(els?.restart)els.restart.onclick=reset;

  // Current title-screen preview already exists; add caches/fog without another reset.
  v37InitializeRun();

  const guide=document.querySelector('#guidePanel .guide-grid');
  if(guide&&!document.getElementById('v37CacheGuide')){
    const d=document.createElement('div');d.className='guide-box';d.id='v37CacheGuide';
    d.innerHTML='<b>Resource Caches</b><p>A few guarded resource crates are scattered around the early exploration ring. Move a unit close and hold the area for several seconds to capture one. Local defenders only fight nearby units and never attack the Base. Caches award a little Metal and modest Gold; their reward fades as the run gets longer, so they are most useful early.</p>';
    guide.appendChild(d);
  }
})();
