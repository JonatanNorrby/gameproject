// Alien Planet Defense v41
// Rifleman combat repair, Bunker removal, and zoom-stable fog-of-war alignment.
const V41_TITLE='Alien Planet Defense v41';
document.title=V41_TITLE;
window.addEventListener('load',()=>{document.title=V41_TITLE;},{once:true});

(function installV41Fixes(){
  const role=u=>{try{return typeof unitRole==='function'?unitRole(u):(u?.role||u?.type);}catch{return u?.role||u?.type;}};
  const active=u=>!!u&&(Number(u.hp)||0)>0&&!u.transportedIn&&!u.garrisonedIn;
  const isRifleman=u=>!!u&&u.type==='soldier'&&role(u)==='rifleman';

  // ---------------------------------------------------------------------------
  // RIFLEMAN COMBAT: guarantee the squad has one authoritative firing pass.
  // Temporarily park inherited rifleman cooldowns so older stacked combat wrappers
  // can still heal/support Riflemen without also double-firing them.
  // ---------------------------------------------------------------------------
  const v40UpdateUnitCombatV41=updateUnitCombat;
  updateUnitCombat=function(dt){
    const rifles=(state.units||[]).filter(u=>isRifleman(u)&&active(u));
    const parked=[];
    for(const u of rifles){
      const cfg=(typeof roleConfig==='function'?roleConfig(u):CONFIG.SOLDIER)||CONFIG.SOLDIER;
      const members=Math.max(1,Number(cfg.MEMBERS)||CONFIG.SOLDIER.MEMBERS||1);
      const original=Array.isArray(u.cooldowns)?u.cooldowns:Array(members).fill(0);
      parked.push([u,original]);
      u.cooldowns=Array(members).fill(999999);
    }
    try{v40UpdateUnitCombatV41(dt);}finally{for(const [u,cooldowns] of parked)u.cooldowns=cooldowns;}

    for(const u of rifles){
      if(!state.units.includes(u)||u.hp<=0||u.transportedIn||u.garrisonedIn)continue;
      const cfg=(typeof roleConfig==='function'?roleConfig(u):CONFIG.SOLDIER)||CONFIG.SOLDIER;
      const members=Math.max(1,Number(cfg.MEMBERS)||CONFIG.SOLDIER.MEMBERS||1);
      if(!Array.isArray(u.cooldowns))u.cooldowns=[];
      while(u.cooldowns.length<members)u.cooldowns.push(Math.random()*.18);
      if(u.cooldowns.length>members)u.cooldowns.length=members;
      const target=typeof findTarget==='function'?findTarget(u.x,u.y,Number(cfg.RANGE)||CONFIG.SOLDIER.RANGE):null;
      for(let i=0;i<members;i++){
        u.cooldowns[i]=(Number(u.cooldowns[i])||0)-dt;
        if(u.cooldowns[i]>0||!target)continue;
        const offsets=typeof SOLDIER_OFFSETS!=='undefined'?SOLDIER_OFFSETS:[[0,0]];
        const off=offsets[i%offsets.length]||[0,0];
        const damage=(Number(cfg.DAMAGE)||CONFIG.SOLDIER.DAMAGE)*(Number(state.mods?.soldierDamage)||1);
        const speed=Number(cfg.BULLET_SPEED)||CONFIG.SOLDIER.BULLET_SPEED;
        if(typeof shoot==='function')shoot(u.x+off[0],u.y+off[1],target,'soldier',damage,speed);
        u.heading=Math.atan2(target.y-u.y,target.x-u.x);
        u.cooldowns[i]=(Number(cfg.FIRE_INTERVAL)||CONFIG.SOLDIER.FIRE_INTERVAL)*(Number(state.mods?.soldierRate)||1);
      }
    }
  };

  // ---------------------------------------------------------------------------
  // BUNKER REMOVAL: remove purchase UI and all live/legacy Bunker instances.
  // CONFIG.BUNKER stays defined only so dormant legacy helper functions cannot
  // throw if another old wrapper calls them; the building itself is unavailable.
  // ---------------------------------------------------------------------------
  document.querySelector('#passiveMenu .buildBtn[data-type="bunker"]')?.remove();
  if(typeof BUILD==='object'&&BUILD)delete BUILD.bunker;
  function v41RemoveBunkers(){
    const ids=new Set((state.structures||[]).filter(s=>s.type==='bunker').map(s=>s.id));
    for(const u of state.units||[]){
      if(u.garrisonedIn&&ids.has(u.garrisonedIn)){u.garrisonedIn=null;u.path=[];u.moveTarget=null;}
    }
    state.structures=(state.structures||[]).filter(s=>s.type!=='bunker');
    if(state.selectedStorageBuilding?.type==='bunker')state.selectedStorageBuilding=null;
    if(state.selectedTower?.type==='bunker')state.selectedTower=null;
  }
  v41RemoveBunkers();
  const v40PlaceBuildV41=placeBuild;
  placeBuild=function(x,y){
    if(buildType==='bunker'){buildType=null;if(els?.message)els.message.textContent='Bunkers have been removed from this build.';return;}
    return v40PlaceBuildV41(x,y);
  };
  const v40UpdateUnitActionsV41=updateUnitActions;
  updateUnitActions=function(){
    v40UpdateUnitActionsV41();
    if(typeof garrisonBtn!=='undefined'&&garrisonBtn)garrisonBtn.style.display='none';
    if(typeof ungarrisonBtn!=='undefined'&&ungarrisonBtn)ungarrisonBtn.style.display='none';
  };
  for(const box of document.querySelectorAll('#guidePanel .guide-box')){
    const title=box.querySelector('b')?.textContent||'';
    if(/bunker/i.test(title))box.remove();
  }

  // ---------------------------------------------------------------------------
  // FOG OF WAR: render all fog/reveal geometry directly in SCREEN coordinates.
  // Every reveal center is calculated as (world - camera) * zoom, exactly like the
  // building's screen position, eliminating drift when zoomed far out.
  // ---------------------------------------------------------------------------
  const CELL=96,COLS=Math.ceil(WORLD_W/CELL),ROWS=Math.ceil(WORLD_H/CELL);
  const fog=document.createElement('canvas');fog.width=W;fog.height=H;
  const fc=fog.getContext('2d');
  function v41Zoom(){
    const min=Number(CONFIG.WORLD.MIN_ZOOM)||.18,max=Number(CONFIG.WORLD.MAX_ZOOM)||1.35;
    return Math.max(min,Math.min(max,Number(state.camera?.zoom)||1));
  }
  function v41UnitVision(u){
    let cfg={};try{cfg=typeof roleConfig==='function'?(roleConfig(u)||{}):{};}catch{}
    const r=role(u);
    if(r==='scout')return 460;if(r==='spotter')return 440;if(r==='sniper')return 520;
    if((typeof isFlyingUnit==='function'&&isFlyingUnit(u))||u.type==='airunit')return 350;
    return Math.max(250,(Number(cfg.RANGE)||0)+65,Number(cfg.DETECT_RANGE)||0,Number(cfg.SPOT_RANGE)||0);
  }
  function v41StructureVision(s){
    if(!s?.built||s.hp<=0||s.type==='bunker')return 0;
    try{if(typeof isUpgradeableTower==='function'&&isUpgradeableTower(s))return Math.max(265,(towerStats(s)?.range||0)+55);}catch{}
    if(s.type==='landingpad')return 330;
    if(s.type==='refinery')return 275;
    if(s.type==='mine'||s.type==='oremine')return 210;
    if(s.type==='wall')return 0;
    return 225;
  }
  function v41Explored(){
    if(state.v41FogExplored instanceof Uint8Array&&state.v41FogExplored.length===COLS*ROWS)return state.v41FogExplored;
    if(state.v37FogExplored instanceof Uint8Array&&state.v37FogExplored.length===COLS*ROWS)state.v41FogExplored=state.v37FogExplored;
    else state.v41FogExplored=new Uint8Array(COLS*ROWS);
    return state.v41FogExplored;
  }
  function v41RefreshFog(){
    const explored=v41Explored(),sources=[{x:BASE_X,y:BASE_Y,r:390,kind:'base'}];
    for(const u of state.units||[])if(active(u))sources.push({x:u.x,y:u.y,r:v41UnitVision(u),kind:'unit',id:u.id});
    for(const s of state.structures||[]){const r=v41StructureVision(s);if(r>0)sources.push({x:s.x,y:s.y,r,kind:'structure',id:s.id});}
    state.v41VisionSources=sources;
    state.v37VisionSources=sources;state.v36VisionSources=sources;state.v32VisionSources=sources;
    for(const v of sources){
      const c0=Math.max(0,Math.floor((v.x-v.r)/CELL)),c1=Math.min(COLS-1,Math.floor((v.x+v.r)/CELL));
      const r0=Math.max(0,Math.floor((v.y-v.r)/CELL)),r1=Math.min(ROWS-1,Math.floor((v.y+v.r)/CELL));
      for(let gy=r0;gy<=r1;gy++)for(let gx=c0;gx<=c1;gx++){
        const cx=gx*CELL+CELL/2,cy=gy*CELL+CELL/2;
        if(Math.hypot(cx-v.x,cy-v.y)<=v.r+CELL*.72)explored[gy*COLS+gx]=1;
      }
    }
  }
  function v41PointVisible(x,y){for(const v of state.v41VisionSources||[])if(Math.hypot(x-v.x,y-v.y)<=v.r)return true;return false;}
  try{refreshFogSourcesV32=v41RefreshFog;}catch{}
  try{pointVisibleV32=v41PointVisible;}catch{}

  function v41DrawFog(){
    const z=v41Zoom(),cam=state.camera,explored=v41Explored();
    fc.setTransform(1,0,0,1,0,0);fc.globalAlpha=1;fc.globalCompositeOperation='source-over';fc.clearRect(0,0,W,H);
    const wx0=cam.x,wy0=cam.y,wx1=cam.x+W/z,wy1=cam.y+H/z;
    const c0=Math.max(0,Math.floor(wx0/CELL)),c1=Math.min(COLS-1,Math.floor(wx1/CELL));
    const r0=Math.max(0,Math.floor(wy0/CELL)),r1=Math.min(ROWS-1,Math.floor(wy1/CELL));
    for(let gy=r0;gy<=r1;gy++)for(let gx=c0;gx<=c1;gx++){
      const sx=(gx*CELL-cam.x)*z,sy=(gy*CELL-cam.y)*z,sz=CELL*z+1.25;
      fc.fillStyle=explored[gy*COLS+gx]?'rgba(1,7,11,.62)':'rgba(0,1,3,.985)';
      fc.fillRect(sx,sy,sz,sz);
    }
    fc.globalCompositeOperation='destination-out';
    for(const v of state.v41VisionSources||[]){
      const sx=(v.x-cam.x)*z,sy=(v.y-cam.y)*z,rr=v.r*z;
      if(sx+rr<0||sy+rr<0||sx-rr>W||sy-rr>H)continue;
      const g=fc.createRadialGradient(sx,sy,rr*.76,sx,sy,rr);
      g.addColorStop(0,'rgba(0,0,0,1)');g.addColorStop(.86,'rgba(0,0,0,.96)');g.addColorStop(1,'rgba(0,0,0,0)');
      fc.fillStyle=g;fc.beginPath();fc.arc(sx,sy,rr,0,Math.PI*2);fc.fill();
    }
    fc.globalCompositeOperation='source-over';
    ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.drawImage(fog,0,0);ctx.restore();
  }

  // v31DrawV32 is the established pre-fog scene draw used by v37 as well. Using
  // it prevents the old misaligned fog layer from being painted underneath v41.
  const v41SceneDraw=(typeof v31DrawV32==='function')?v31DrawV32:draw;
  draw=function(){v41RefreshFog();v41SceneDraw();v41DrawFog();};

  const v40ResetV41=reset;
  reset=function(){
    v40ResetV41();v41RemoveBunkers();
    state.v41FogExplored=(state.v37FogExplored instanceof Uint8Array&&state.v37FogExplored.length===COLS*ROWS)?state.v37FogExplored:new Uint8Array(COLS*ROWS);
    state.v41VisionSources=[];v41RefreshFog();
    if(typeof updateHud==='function')updateHud();
  };
  if(els?.restart)els.restart.onclick=reset;
  v41RefreshFog();
})();
