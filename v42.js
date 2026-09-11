// Alien Planet Defense v42
// Consolidated stability pass: authoritative Rifleman combat, deterministic fog
// anchoring using the renderer's ACTUAL canvas transform, and compatibility guards.
const V42_TITLE='Alien Planet Defense v42';
document.title=V42_TITLE;
window.addEventListener('load',()=>{document.title=V42_TITLE;},{once:true});

(function installV42Stability(){
  const FOG_CELL=96;
  const FOG_COLS=Math.ceil(WORLD_W/FOG_CELL);
  const FOG_ROWS=Math.ceil(WORLD_H/FOG_CELL);
  const fogCanvas=document.createElement('canvas');
  fogCanvas.width=W;fogCanvas.height=H;
  const fogCtx=fogCanvas.getContext('2d');

  const role=u=>{try{return typeof unitRole==='function'?unitRole(u):(u?.role||u?.type);}catch{return u?.role||u?.type;}};
  const activeUnit=u=>!!u&&(Number(u.hp)||0)>0&&!u.transportedIn&&!u.garrisonedIn;
  const isRifleman=u=>!!u&&u.type==='soldier'&&role(u)==='rifleman';

  // ---------------------------------------------------------------------------
  // FOG STATE / LOGICAL VISIBILITY
  // ---------------------------------------------------------------------------
  function unitVision(u){
    let cfg={};try{cfg=typeof roleConfig==='function'?(roleConfig(u)||{}):{};}catch{}
    const r=role(u);
    if(r==='scout')return 460;
    if(r==='spotter')return 440;
    if(r==='sniper')return 520;
    if((typeof isFlyingUnit==='function'&&isFlyingUnit(u))||u.type==='airunit')return 350;
    return Math.max(250,(Number(cfg.RANGE)||0)+65,Number(cfg.DETECT_RANGE)||0,Number(cfg.SPOT_RANGE)||0);
  }
  function structureVision(s){
    if(!s?.built||s.hp<=0||s.type==='bunker')return 0;
    try{if(typeof isUpgradeableTower==='function'&&isUpgradeableTower(s))return Math.max(265,(towerStats(s)?.range||0)+55);}catch{}
    if(s.type==='landingpad')return 330;
    if(s.type==='refinery')return 275;
    if(s.type==='mine'||s.type==='oremine')return 210;
    if(s.type==='wall')return 0;
    return 225;
  }
  function ensureExplored(){
    if(state.v42FogExplored instanceof Uint8Array&&state.v42FogExplored.length===FOG_COLS*FOG_ROWS)return state.v42FogExplored;
    const prior=[state.v41FogExplored,state.v37FogExplored,state.v36FogExplored,state.fogExplored].find(a=>a instanceof Uint8Array&&a.length===FOG_COLS*FOG_ROWS);
    state.v42FogExplored=prior?new Uint8Array(prior):new Uint8Array(FOG_COLS*FOG_ROWS);
    return state.v42FogExplored;
  }
  function refreshVision(){
    if(!state)return;
    const explored=ensureExplored();
    const sources=[{x:BASE_X,y:BASE_Y,r:390,kind:'base',id:'base'}];
    for(const u of state.units||[])if(activeUnit(u))sources.push({x:u.x,y:u.y,r:unitVision(u),kind:'unit',id:u.id,ref:u});
    for(const s of state.structures||[]){const r=structureVision(s);if(r>0)sources.push({x:s.x,y:s.y,r,kind:'structure',id:s.id,ref:s});}
    state.v42VisionSources=sources;
    // Keep every older fog-aware targeting wrapper synchronized with one source list.
    state.v41VisionSources=sources;state.v37VisionSources=sources;state.v36VisionSources=sources;state.v32VisionSources=sources;
    for(const v of sources){
      const c0=Math.max(0,Math.floor((v.x-v.r)/FOG_CELL)),c1=Math.min(FOG_COLS-1,Math.floor((v.x+v.r)/FOG_CELL));
      const r0=Math.max(0,Math.floor((v.y-v.r)/FOG_CELL)),r1=Math.min(FOG_ROWS-1,Math.floor((v.y+v.r)/FOG_CELL));
      for(let gy=r0;gy<=r1;gy++)for(let gx=c0;gx<=c1;gx++){
        const cx=gx*FOG_CELL+FOG_CELL/2,cy=gy*FOG_CELL+FOG_CELL/2;
        if(Math.hypot(cx-v.x,cy-v.y)<=v.r+FOG_CELL*.72)explored[gy*FOG_COLS+gx]=1;
      }
    }
  }
  function pointVisible(x,y){
    for(const v of state.v42VisionSources||[])if(Math.hypot(x-v.x,y-v.y)<=v.r)return true;
    return false;
  }
  try{refreshFogSourcesV32=refreshVision;}catch{}
  try{pointVisibleV32=pointVisible;}catch{}
  try{drawFogOverlayV32=function(){};}catch{}

  // ---------------------------------------------------------------------------
  // RIFLEMAN COMBAT
  // v41 used the inherited cooldown array. Several old combat wrappers also mutate
  // that array, which can leave Riflemen effectively locked at giant cooldowns.
  // v42 gives Riflemen a private cooldown clock and creates their projectile using
  // the engine's known bullet schema, independent of the legacy combat stack.
  // ---------------------------------------------------------------------------
  function rifleTarget(u){
    if(!u||!activeUnit(u))return null;
    const cfg=(typeof roleConfig==='function'?roleConfig(u):CONFIG.SOLDIER)||CONFIG.SOLDIER;
    const range=Number(cfg.RANGE)||CONFIG.SOLDIER.RANGE;
    let best=null,bd=range;
    for(const e of state.enemies||[]){
      if(!e||e.hp<=0)continue;
      if(typeof enemyTargetableFrom==='function'&&!enemyTargetableFrom(e,u.x,u.y))continue;
      if(!pointVisible(e.x,e.y))continue;
      const d=Math.hypot(e.x-u.x,e.y-u.y);
      if(d<=bd){best=e;bd=d;}
    }
    return best;
  }
  function spawnRifleBullet(x,y,target,damage,speed){
    const a=Math.atan2(target.y-y,target.x-x)+(Math.random()-.5)*.02;
    state.bullets.push({x,y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,dmg:damage,life:2.2,type:'soldier'});
  }

  // Call the pre-v41 combat layer if available. Riflemen are parked on huge
  // inherited cooldowns during that call so they are never double-fired, but they
  // remain in state.units so Medics/support logic can still see and heal them.
  const legacyCombat=(typeof v40UpdateUnitCombatV41==='function')?v40UpdateUnitCombatV41:updateUnitCombat;
  updateUnitCombat=function(dt){
    refreshVision();
    const rifles=(state.units||[]).filter(u=>isRifleman(u)&&activeUnit(u));
    const parked=[];
    for(const u of rifles){
      const cfg=(typeof roleConfig==='function'?roleConfig(u):CONFIG.SOLDIER)||CONFIG.SOLDIER;
      const members=Math.max(1,(Number(cfg.MEMBERS)||CONFIG.SOLDIER.MEMBERS||1)+(Number(state.mods?.extraSoldiers)||0));
      parked.push([u,u.cooldowns]);
      u.cooldowns=Array(members).fill(1e9);
    }
    try{legacyCombat(dt);}
    catch(err){
      if(!state.v42LegacyCombatError){state.v42LegacyCombatError=String(err?.stack||err);console.error('v42: legacy non-rifle combat threw; Riflemen continue on the v42 combat path',err);}
    }
    finally{for(const [u,c] of parked)u.cooldowns=c;}

    for(const u of rifles){
      if(!state.units.includes(u)||!activeUnit(u))continue;
      const cfg=(typeof roleConfig==='function'?roleConfig(u):CONFIG.SOLDIER)||CONFIG.SOLDIER;
      const members=Math.max(1,(Number(cfg.MEMBERS)||CONFIG.SOLDIER.MEMBERS||1)+(Number(state.mods?.extraSoldiers)||0));
      if(!Array.isArray(u.v42RifleCooldowns))u.v42RifleCooldowns=Array.from({length:members},()=>Math.random()*.18);
      while(u.v42RifleCooldowns.length<members)u.v42RifleCooldowns.push(Math.random()*.18);
      if(u.v42RifleCooldowns.length>members)u.v42RifleCooldowns.length=members;
      const target=rifleTarget(u);
      for(let i=0;i<members;i++){
        u.v42RifleCooldowns[i]=(Number(u.v42RifleCooldowns[i])||0)-dt;
        if(u.v42RifleCooldowns[i]>0||!target)continue;
        const offsets=(typeof SOLDIER_OFFSETS!=='undefined'&&SOLDIER_OFFSETS?.length)?SOLDIER_OFFSETS:[[0,0]];
        const off=offsets[i%offsets.length]||[0,0];
        const damage=(Number(cfg.DAMAGE)||CONFIG.SOLDIER.DAMAGE)*(Number(state.mods?.soldierDamage)||1);
        const speed=Number(cfg.BULLET_SPEED)||CONFIG.SOLDIER.BULLET_SPEED;
        spawnRifleBullet(u.x+off[0],u.y+off[1],target,damage,speed);
        u.heading=Math.atan2(target.y-u.y,target.x-u.x);
        u.v42FiringUntil=performance.now()+150;
        u.v42RifleCooldowns[i]=(Number(cfg.FIRE_INTERVAL)||CONFIG.SOLDIER.FIRE_INTERVAL)*(Number(state.mods?.soldierRate)||1)*(.94+Math.random()*.12);
      }
    }
  };
  // The sprite's FIRE state now uses the exact same target selector as gameplay.
  try{v35RiflemanTarget=rifleTarget;}catch{}

  // ---------------------------------------------------------------------------
  // FOG DRAW ANCHORS
  // Do not independently re-create the camera transform. Instead, capture the
  // Canvas transform that is literally active when Base/buildings/units are drawn.
  // Fog holes therefore use the exact rendered screen center at every zoom.
  // ---------------------------------------------------------------------------
  let frameAnchors=[];
  let frameWorldMatrix=null;
  function snapshotMatrix(){
    if(typeof ctx.getTransform==='function'){
      const m=ctx.getTransform();return{a:m.a,b:m.b,c:m.c,d:m.d,e:m.e,f:m.f};
    }
    const z=Math.max(Number(CONFIG.WORLD.MIN_ZOOM)||.18,Math.min(Number(CONFIG.WORLD.MAX_ZOOM)||1.35,Number(state.camera?.zoom)||1));
    return{a:z,b:0,c:0,d:z,e:-state.camera.x*z,f:-state.camera.y*z};
  }
  function matrixScale(m){return Math.max(.0001,(Math.hypot(m.a,m.b)+Math.hypot(m.c,m.d))/2);}
  function screenPoint(m,x,y){return{x:m.a*x+m.c*y+m.e,y:m.b*x+m.d*y+m.f};}
  function addAnchor(m,x,y,r,kind,id){
    const p=screenPoint(m,x,y),scale=matrixScale(m);
    frameAnchors.push({x:p.x,y:p.y,r:r*scale,kind,id});
  }

  const drawBase0=drawBase;
  drawBase=function(...args){
    const m=snapshotMatrix();frameWorldMatrix=m;addAnchor(m,BASE_X,BASE_Y,390,'base','base');
    return drawBase0(...args);
  };
  const drawStructure0=drawStructure;
  drawStructure=function(s,...args){
    const r=structureVision(s);if(r>0){const m=snapshotMatrix();addAnchor(m,s.x,s.y,r,'structure',s.id);}
    return drawStructure0(s,...args);
  };
  const drawUnit0=drawUnit;
  drawUnit=function(u,...args){
    if(activeUnit(u)){const m=snapshotMatrix();addAnchor(m,u.x,u.y,unitVision(u),'unit',u.id);}
    return drawUnit0(u,...args);
  };

  function inversePoint(m,sx,sy){
    const det=m.a*m.d-m.b*m.c;
    if(Math.abs(det)<1e-9)return{x:state.camera.x,y:state.camera.y};
    const x=sx-m.e,y=sy-m.f;
    return{x:(m.d*x-m.c*y)/det,y:(-m.b*x+m.a*y)/det};
  }
  function drawFog(){
    const explored=ensureExplored();
    const m=frameWorldMatrix||snapshotMatrix();
    const fc=fogCtx;
    fc.setTransform(1,0,0,1,0,0);fc.globalAlpha=1;fc.globalCompositeOperation='source-over';fc.clearRect(0,0,W,H);

    // Determine the world rectangle actually visible through the captured matrix.
    const corners=[inversePoint(m,0,0),inversePoint(m,W,0),inversePoint(m,0,H),inversePoint(m,W,H)];
    const minX=Math.max(0,Math.min(...corners.map(p=>p.x))),maxX=Math.min(WORLD_W,Math.max(...corners.map(p=>p.x)));
    const minY=Math.max(0,Math.min(...corners.map(p=>p.y))),maxY=Math.min(WORLD_H,Math.max(...corners.map(p=>p.y)));
    const c0=Math.max(0,Math.floor(minX/FOG_CELL)-1),c1=Math.min(FOG_COLS-1,Math.floor(maxX/FOG_CELL)+1);
    const r0=Math.max(0,Math.floor(minY/FOG_CELL)-1),r1=Math.min(FOG_ROWS-1,Math.floor(maxY/FOG_CELL)+1);
    const scale=matrixScale(m);
    fc.setTransform(m.a,m.b,m.c,m.d,m.e,m.f);
    for(let gy=r0;gy<=r1;gy++)for(let gx=c0;gx<=c1;gx++){
      fc.fillStyle=explored[gy*FOG_COLS+gx]?'rgba(1,7,11,.62)':'rgba(0,1,3,.985)';
      fc.fillRect(gx*FOG_CELL,gy*FOG_CELL,FOG_CELL+2/scale,FOG_CELL+2/scale);
    }

    // Punch vision holes in SCREEN coordinates using centers captured from the
    // actual renderer. This is the key v42 alignment fix.
    fc.setTransform(1,0,0,1,0,0);fc.globalCompositeOperation='destination-out';
    for(const a of frameAnchors){
      if(a.x+a.r<0||a.y+a.r<0||a.x-a.r>W||a.y-a.r>H)continue;
      const rr=Math.max(1,a.r),g=fc.createRadialGradient(a.x,a.y,rr*.76,a.x,a.y,rr);
      g.addColorStop(0,'rgba(0,0,0,1)');g.addColorStop(.86,'rgba(0,0,0,.96)');g.addColorStop(1,'rgba(0,0,0,0)');
      fc.fillStyle=g;fc.beginPath();fc.arc(a.x,a.y,rr,0,Math.PI*2);fc.fill();
    }
    fc.globalCompositeOperation='source-over';fc.globalAlpha=1;
    ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.drawImage(fogCanvas,0,0);ctx.restore();
  }

  // v31DrawV32 is the pre-fog scene captured immediately before v32 installed its
  // first fog wrapper. It still calls current drawBackdrop/drawUnit/drawStructure,
  // so later assets, resource caches and unit renderers remain active.
  const sceneDraw=(typeof v31DrawV32==='function')?v31DrawV32:draw;
  draw=function(){
    refreshVision();frameAnchors=[];frameWorldMatrix=null;
    sceneDraw();
    drawFog();
  };

  // ---------------------------------------------------------------------------
  // COMPATIBILITY CLEANUP / SELF-CHECKS
  // ---------------------------------------------------------------------------
  function removeBunkers(){
    document.querySelector('#passiveMenu .buildBtn[data-type="bunker"]')?.remove();
    if(typeof BUILD==='object'&&BUILD)delete BUILD.bunker;
    const ids=new Set((state.structures||[]).filter(s=>s.type==='bunker').map(s=>s.id));
    for(const u of state.units||[])if(u.garrisonedIn&&ids.has(u.garrisonedIn))u.garrisonedIn=null;
    state.structures=(state.structures||[]).filter(s=>s.type!=='bunker');
    if(typeof garrisonBtn!=='undefined'&&garrisonBtn)garrisonBtn.style.display='none';
    if(typeof ungarrisonBtn!=='undefined'&&ungarrisonBtn)ungarrisonBtn.style.display='none';
    for(const box of document.querySelectorAll('#guidePanel .guide-box')){
      const title=box.querySelector('b')?.textContent||'';
      if(/bunker/i.test(title))box.remove();
    }
  }
  removeBunkers();

  const reset0=reset;
  reset=function(){
    reset0();removeBunkers();
    state.v42FogExplored=new Uint8Array(FOG_COLS*FOG_ROWS);
    state.v42VisionSources=[];
    state.v42LegacyCombatError=null;
    for(const u of state.units||[])delete u.v42RifleCooldowns;
    refreshVision();
    if(typeof updateHud==='function')updateHud();
  };
  if(els?.restart)els.restart.onclick=reset;

  // Keep logical visibility current even between camera-only frames and make a
  // compact diagnostics object available if a future browser regression appears.
  refreshVision();
  window.APD_V42_DIAGNOSTICS={
    version:42,
    rifleCombat:'authoritative-v42',
    fogAlignment:'captured-render-transform',
    fogCell:FOG_CELL,
    world:{width:WORLD_W,height:WORLD_H},
    check(){return{
      units:state.units?.length||0,enemies:state.enemies?.length||0,structures:state.structures?.length||0,
      riflemen:(state.units||[]).filter(isRifleman).length,
      visionSources:state.v42VisionSources?.length||0,
      renderAnchors:frameAnchors.length,
      legacyCombatError:state.v42LegacyCombatError||null,
      zoom:Number(state.camera?.zoom)||1
    };}
  };
})();
