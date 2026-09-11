// Alien Planet Defense v36
// Stability repair: guaranteed battlefield zoom controls, reliable base unit
// deployment, restored fog of war, and large-map support.
document.title='Alien Planet Defense v36';

(function installV36StabilityRepair(){
  // ---------------------------------------------------------------------------
  // ZOOM: repair/create always-visible controls regardless of older UI state.
  // ---------------------------------------------------------------------------
  CONFIG.WORLD.MIN_ZOOM=Math.min(Number(CONFIG.WORLD.MIN_ZOOM)||0.42,0.18);
  CONFIG.WORLD.MAX_ZOOM=Math.max(Number(CONFIG.WORLD.MAX_ZOOM)||1.35,1.35);
  CONFIG.WORLD.ZOOM_STEP=Number(CONFIG.WORLD.ZOOM_STEP)||0.10;

  function v36Zoom(){
    const min=CONFIG.WORLD.MIN_ZOOM,max=CONFIG.WORLD.MAX_ZOOM;
    return Math.max(min,Math.min(max,Number(state?.camera?.zoom)||1));
  }
  function v36ClampCamera(){
    if(!state?.camera)return;
    const z=v36Zoom(),vw=W/z,vh=H/z;
    state.camera.x=Math.max(0,Math.min(Math.max(0,WORLD_W-vw),Number(state.camera.x)||0));
    state.camera.y=Math.max(0,Math.min(Math.max(0,WORLD_H-vh),Number(state.camera.y)||0));
  }
  function v36SetZoom(next,sx=W/2,sy=H/2){
    if(!state?.camera)return;
    const old=v36Zoom(),z=Math.max(CONFIG.WORLD.MIN_ZOOM,Math.min(CONFIG.WORLD.MAX_ZOOM,Number(next)||old));
    const wx=state.camera.x+sx/old,wy=state.camera.y+sy/old;
    state.camera.zoom=z;
    state.camera.x=wx-sx/z;state.camera.y=wy-sy/z;
    v36ClampCamera();
    v36UpdateZoomLabel();
    if(typeof updateCancelButtonPosition==='function')updateCancelButtonPosition();
  }
  function v36UpdateZoomLabel(){
    const controls=document.getElementById('mapZoomControls');
    if(!controls)return;
    const label=controls.querySelector('#mapZoomLabel'),out=controls.querySelector('#mapZoomOutBtn'),inn=controls.querySelector('#mapZoomInBtn'),z=v36Zoom();
    if(label)label.textContent=`${Math.round(z*100)}%`;
    if(out)out.disabled=z<=CONFIG.WORLD.MIN_ZOOM+.0001;
    if(inn)inn.disabled=z>=CONFIG.WORLD.MAX_ZOOM-.0001;
  }
  function v36InstallZoomControls(){
    let controls=document.getElementById('mapZoomControls');
    if(!controls){
      controls=document.createElement('div');controls.id='mapZoomControls';controls.setAttribute('aria-label','Map zoom controls');
      controls.innerHTML='<button id="mapZoomOutBtn" type="button" aria-label="Zoom out">−</button><span id="mapZoomLabel">100%</span><button id="mapZoomInBtn" type="button" aria-label="Zoom in">+</button>';
      (document.getElementById('canvasShell')||document.body).appendChild(controls);
    }
    Object.assign(controls.style,{position:'fixed',right:'14px',bottom:'14px',zIndex:'116',display:'flex',alignItems:'center',gap:'6px',padding:'7px',border:'2px solid rgba(112,214,255,.92)',borderRadius:'11px',background:'rgba(4,14,22,.94)',boxShadow:'0 5px 22px rgba(0,0,0,.55)',pointerEvents:'auto'});
    const label=controls.querySelector('#mapZoomLabel'),out=controls.querySelector('#mapZoomOutBtn'),inn=controls.querySelector('#mapZoomInBtn');
    if(label)Object.assign(label.style,{minWidth:'54px',height:'46px',display:'flex',alignItems:'center',justifyContent:'center',font:'900 12px Arial',color:'#effaff',pointerEvents:'none'});
    for(const btn of [out,inn])if(btn){Object.assign(btn.style,{width:'48px',height:'48px',minWidth:'48px',padding:'0',border:'1px solid #7db7d5',borderRadius:'8px',background:'#123247',color:'#fff',font:'900 30px/1 Arial',cursor:'pointer',touchAction:'manipulation'});btn.onpointerdown=e=>e.stopPropagation();btn.onpointerup=e=>e.stopPropagation();}
    if(out)out.onclick=e=>{e.preventDefault();e.stopPropagation();v36SetZoom(v36Zoom()-CONFIG.WORLD.ZOOM_STEP);};
    if(inn)inn.onclick=e=>{e.preventDefault();e.stopPropagation();v36SetZoom(v36Zoom()+CONFIG.WORLD.ZOOM_STEP);};
    v36UpdateZoomLabel();
  }
  v36InstallZoomControls();
  window.addEventListener('resize',()=>{v36ClampCamera();v36UpdateZoomLabel();},{passive:true});
  window.addEventListener('orientationchange',()=>setTimeout(()=>{v36InstallZoomControls();v36ClampCamera();},80),{passive:true});

  // Keep the existing engine zoom API coherent with the repaired controls.
  try{setZoom=function(next,sx=W/2,sy=H/2){v36SetZoom(next,sx,sy);return v36Zoom();};}catch{}
  try{updateZoomLabel=v36UpdateZoomLabel;}catch{}
  try{clampCamera=v36ClampCamera;}catch{}

  // ---------------------------------------------------------------------------
  // UNIT DEPLOYMENT: one deterministic purchase handler per movable-unit button.
  // This does not use placement mode and does not depend on legacy payResource().
  // ---------------------------------------------------------------------------
  function v36UnitIsAir(type){return type==='combatdrone'||type==='combatship';}
  function v36SpawnPoint(radius,air=false){
    const r=Math.max(12,Number(radius)||22);
    for(let ring=0;ring<9;ring++){
      const dist=BASE_RADIUS+r+26+ring*34;
      for(let i=0;i<40;i++){
        const a=i/40*Math.PI*2+ring*.23,x=BASE_X+Math.cos(a)*dist,y=BASE_Y+Math.sin(a)*dist;
        if(x<r+8||y<r+8||x>WORLD_W-r-8||y>WORLD_H-r-8)continue;
        if(!air){
          if(typeof pointBlockedByTerrain==='function'&&pointBlockedByTerrain(x,y,r*.45))continue;
          let blocked=false;
          for(const s of state.structures||[]){
            if(s.type==='wall'&&typeof pointSegmentDistance==='function'){
              const thick=typeof wallThickness==='function'?wallThickness(s):12;
              if(pointSegmentDistance(x,y,s.x1,s.y1,s.x2,s.y2)<r+thick/2+5){blocked=true;break;}
            }else if(Number.isFinite(s.x)&&Number.isFinite(s.y)){
              const sr=typeof structureRadius==='function'?structureRadius(s):28;
              if(Math.hypot(x-s.x,y-s.y)<r+sr+6){blocked=true;break;}
            }
          }
          if(blocked)continue;
        }
        return{x,y};
      }
    }
    return{x:Math.min(WORLD_W-r-8,BASE_X+BASE_RADIUS+r+38),y:BASE_Y};
  }
  function v36CreateGround(role,p){
    if(typeof makeGroundUnit==='function')return makeGroundUnit(role,p.x,p.y);
    const cfg=typeof roleConfig==='function'?(roleConfig({type:'soldier',role})||CONFIG.SOLDIER):CONFIG.SOLDIER;
    const members=Math.max(1,Number(cfg.MEMBERS)||Number(cfg.BARRELS)||1);
    return{id:'u'+Date.now()+Math.random(),type:'soldier',role,x:p.x,y:p.y,hp:cfg.HP||CONFIG.SOLDIER.HP,maxHp:cfg.HP||CONFIG.SOLDIER.HP,moveTarget:null,path:[],heading:0,attachedTo:null,attachSlot:0,garrisonedIn:null,cooldowns:Array.from({length:members},()=>Math.random()*.25),platoonId:null,platoonSlot:0};
  }
  function v36CreateAir(role,p){
    if(typeof makeAirUnit==='function')return makeAirUnit(role,p.x,p.y);
    const cfg=typeof roleConfig==='function'?(roleConfig({type:'airunit',role})||CONFIG.COMBAT_DRONE):CONFIG.COMBAT_DRONE;
    return{id:'u'+Date.now()+Math.random(),type:'airunit',role,x:p.x,y:p.y,hp:cfg.HP,maxHp:cfg.HP,moveTarget:null,path:[],heading:0,cooldowns:[Math.random()*.25],garrisonedIn:null,platoonId:null,platoonSlot:0};
  }
  function v36CreateTruck(p){
    const hp=CONFIG.TRUCK.HP*(state.mods?.truckHp||1);
    return{id:'u'+Date.now()+Math.random(),type:'truck',x:p.x,y:p.y,hp,maxHp:hp,moveTarget:null,path:[],heading:0,cargo:0,cargoType:null,route:[],routeIndex:0,routeLoop:false,routeActive:false,routeWaiting:false,routePendingStart:false,platoonId:null,platoonSlot:0};
  }
  function v36PurchaseUnit(type){
    const def=BUILD?.[type];
    if(!def||def.kind!=='unit')return false;
    if(type==='combatship'&&state.units.some(u=>(u.role==='combatship')&&u.hp>0)){
      if(els?.message)els.message.textContent='Only one Combat Ship can be active at a time.';return false;
    }
    const cost=Math.max(0,Number(def.cost)||0),free=!!state.debug?.unlimitedCash;
    if(!free&&(Number(state.credits)||0)<cost){if(els?.message)els.message.textContent=`Need ${cost} gold for ${def.label}.`;if(typeof updateHud==='function')updateHud();return false;}
    if(!free)state.credits-=cost;
    const air=v36UnitIsAir(type),p=v36SpawnPoint(def.radius,air);let u;
    try{
      if(type==='truck')u=v36CreateTruck(p);
      else if(air)u=v36CreateAir(type,p);
      else u=v36CreateGround(type==='soldier'?'rifleman':type,p);
      if(!u)throw new Error('unit factory returned no unit');
      u.platoonId=null;u.platoonSlot=0;
      state.units.push(u);
    }catch(err){
      if(!free)state.credits+=cost;
      console.error('v36 unit deployment failed',type,err);
      if(els?.message)els.message.textContent=`Could not deploy ${def.label}. Purchase refunded.`;
      if(typeof updateHud==='function')updateHud();return false;
    }
    buildType=null;state.routeEditing=false;state.attachMode=false;state.platoonAttachMode=false;
    state.selectedUnit=u;if('selectedTower'in state)state.selectedTower=null;if('selectedStorageBuilding'in state)state.selectedStorageBuilding=null;
    if(typeof updateTowerPanel==='function')updateTowerPanel();
    if(els?.message){let name=def.label;try{if(typeof unitDisplayName==='function')name=unitDisplayName(u)||name;}catch{}els.message.textContent=`${name} deployed from the base.`;}
    if(typeof updateHud==='function')updateHud();
    return true;
  }
  function v36InstallUnitButtons(){
    for(const oldBtn of [...document.querySelectorAll('#unitsMenu .buildBtn[data-type]')]){
      const type=oldBtn.dataset.type,def=BUILD?.[type];if(!def||def.kind!=='unit')continue;
      const btn=oldBtn.cloneNode(true);btn.type='button';btn.disabled=false;btn.classList.remove('selected');
      btn.onclick=e=>{e.preventDefault();e.stopPropagation();const ok=v36PurchaseUnit(type);if(ok&&typeof closeCommandMenu==='function')setTimeout(closeCommandMenu,0);};
      btn.onpointerdown=e=>e.stopPropagation();btn.onpointerup=e=>e.stopPropagation();oldBtn.replaceWith(btn);
    }
  }
  v36InstallUnitButtons();
  try{spawnUnitAtBase=v36PurchaseUnit;}catch{}

  // ---------------------------------------------------------------------------
  // FOG OF WAR: replace the old fog wrapper with a self-contained renderer.
  // If v32 loaded, use its pre-fog draw function so fog is applied exactly once.
  // ---------------------------------------------------------------------------
  const V36_FOG_CELL=96,V36_FOG_COLS=Math.ceil(WORLD_W/V36_FOG_CELL),V36_FOG_ROWS=Math.ceil(WORLD_H/V36_FOG_CELL);
  const v36FogCanvas=document.createElement('canvas');v36FogCanvas.width=W;v36FogCanvas.height=H;
  const v36FogCtx=v36FogCanvas.getContext('2d');
  // Keep every later draw wrapper intact. If v32's fog function exists, replace
  // only that overlay with a no-op so the v36 fog below is applied exactly once.
  if(typeof window.drawFogOverlayV32==='function')window.drawFogOverlayV32=function(){};
  const v36BaseDraw=draw;

  function v36RoleCfg(u){try{return typeof roleConfig==='function'?(roleConfig(u)||{}):{};}catch{return {};}}
  function v36VisionForUnit(u){
    const role=typeof unitRole==='function'?unitRole(u):(u.role||u.type),cfg=v36RoleCfg(u);
    if(role==='scout')return 460;if(role==='spotter')return 440;if(role==='sniper')return 520;
    if((typeof isFlyingUnit==='function'&&isFlyingUnit(u))||u.type==='airunit')return 350;
    return Math.max(250,(Number(cfg.RANGE)||0)+65,Number(cfg.DETECT_RANGE)||0,Number(cfg.SPOT_RANGE)||0);
  }
  function v36VisionForStructure(s){
    if(!s?.built||s.hp<=0)return 0;
    try{if(typeof isUpgradeableTower==='function'&&isUpgradeableTower(s))return Math.max(265,(towerStats(s)?.range||0)+55);}catch{}
    if(s.type==='landingpad')return 330;if(s.type==='refinery'||s.type==='bunker')return 275;if(s.type==='mine'||s.type==='oremine')return 210;if(s.type==='wall')return 0;return 225;
  }
  function v36RefreshFog(){
    if(!state)return;
    if(!(state.v36FogExplored instanceof Uint8Array)||state.v36FogExplored.length!==V36_FOG_COLS*V36_FOG_ROWS)state.v36FogExplored=new Uint8Array(V36_FOG_COLS*V36_FOG_ROWS);
    const sources=[{x:BASE_X,y:BASE_Y,r:390}];
    for(const u of state.units||[]){if(u.hp<=0||u.transportedIn||u.garrisonedIn)continue;sources.push({x:u.x,y:u.y,r:v36VisionForUnit(u)});}
    for(const s of state.structures||[]){const r=v36VisionForStructure(s);if(r>0)sources.push({x:s.x,y:s.y,r});}
    state.v36VisionSources=sources;
    // Keep v32 enemy visibility/targeting wrappers synchronized if they exist.
    state.v32VisionSources=sources;
    for(const v of sources){
      const c0=Math.max(0,Math.floor((v.x-v.r)/V36_FOG_CELL)),c1=Math.min(V36_FOG_COLS-1,Math.floor((v.x+v.r)/V36_FOG_CELL));
      const r0=Math.max(0,Math.floor((v.y-v.r)/V36_FOG_CELL)),r1=Math.min(V36_FOG_ROWS-1,Math.floor((v.y+v.r)/V36_FOG_CELL));
      for(let gy=r0;gy<=r1;gy++)for(let gx=c0;gx<=c1;gx++){
        const cx=gx*V36_FOG_CELL+V36_FOG_CELL/2,cy=gy*V36_FOG_CELL+V36_FOG_CELL/2;
        if(Math.hypot(cx-v.x,cy-v.y)<=v.r+V36_FOG_CELL*.72)state.v36FogExplored[gy*V36_FOG_COLS+gx]=1;
      }
    }
  }
  function v36PointVisible(x,y){for(const v of state.v36VisionSources||[])if(Math.hypot(x-v.x,y-v.y)<=v.r)return true;return false;}
  // Reuse v36 visibility everywhere the older fog layer is referenced.
  if(typeof window.refreshFogSourcesV32==='function')window.refreshFogSourcesV32=v36RefreshFog;
  if(typeof window.pointVisibleV32==='function')window.pointVisibleV32=v36PointVisible;
  function v36DrawFog(){
    const z=v36Zoom(),cam=state.camera,fc=v36FogCtx;
    fc.setTransform(1,0,0,1,0,0);fc.clearRect(0,0,W,H);
    const wx0=cam.x,wy0=cam.y,wx1=Math.min(WORLD_W,cam.x+W/z),wy1=Math.min(WORLD_H,cam.y+H/z);
    const c0=Math.max(0,Math.floor(wx0/V36_FOG_CELL)),c1=Math.min(V36_FOG_COLS-1,Math.floor(wx1/V36_FOG_CELL));
    const r0=Math.max(0,Math.floor(wy0/V36_FOG_CELL)),r1=Math.min(V36_FOG_ROWS-1,Math.floor(wy1/V36_FOG_CELL));
    for(let gy=r0;gy<=r1;gy++)for(let gx=c0;gx<=c1;gx++){
      const explored=state.v36FogExplored?.[gy*V36_FOG_COLS+gx],sx=(gx*V36_FOG_CELL-cam.x)*z,sy=(gy*V36_FOG_CELL-cam.y)*z,sz=V36_FOG_CELL*z+1;
      fc.fillStyle=explored?'rgba(1,7,11,.62)':'rgba(0,1,3,.985)';fc.fillRect(sx,sy,sz,sz);
    }
    fc.globalCompositeOperation='destination-out';
    for(const v of state.v36VisionSources||[]){
      const sx=(v.x-cam.x)*z,sy=(v.y-cam.y)*z,rr=v.r*z;if(sx+rr<0||sy+rr<0||sx-rr>W||sy-rr>H)continue;
      const g=fc.createRadialGradient(sx,sy,rr*.74,sx,sy,rr);g.addColorStop(0,'rgba(0,0,0,1)');g.addColorStop(.84,'rgba(0,0,0,.95)');g.addColorStop(1,'rgba(0,0,0,0)');
      fc.fillStyle=g;fc.beginPath();fc.arc(sx,sy,rr,0,Math.PI*2);fc.fill();
    }
    fc.globalCompositeOperation='source-over';ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.drawImage(v36FogCanvas,0,0);ctx.restore();
  }
  draw=function(){v36RefreshFog();v36BaseDraw();v36DrawFog();};

  // Hide off-screen enemy arrows unless that enemy is currently revealed.
  if(typeof drawIncomingEnemyArrows==='function'){
    const v36IncomingBase=drawIncomingEnemyArrows;
    drawIncomingEnemyArrows=function(){const all=state.enemies;state.enemies=all.filter(e=>v36PointVisible(e.x,e.y));try{return v36IncomingBase();}finally{state.enemies=all;}};
  }

  // ---------------------------------------------------------------------------
  // LARGE MAP SUPPORT: rivers should remain spread around the central base, and
  // resets must recreate fog using the enlarged world rather than stale state.
  // ---------------------------------------------------------------------------
  if(typeof makeHorizontalRiver==='function'){
    generateRivers=function(){return[makeHorizontalRiver(WORLD_H*.27+Math.random()*WORLD_H*.035,1),makeHorizontalRiver(WORLD_H*.73+Math.random()*WORLD_H*.035,2)];};
  }
  if(state){
    if(typeof generateRivers==='function')state.rivers=generateRivers();
    state.v36FogExplored=new Uint8Array(V36_FOG_COLS*V36_FOG_ROWS);v36RefreshFog();
    v36ClampCamera();v36UpdateZoomLabel();
  }

  const v36ResetBase=reset;
  reset=function(){
    v36ResetBase();
    if(typeof generateRivers==='function')state.rivers=generateRivers();
    state.v36FogExplored=new Uint8Array(V36_FOG_COLS*V36_FOG_ROWS);state.v36VisionSources=[];v36RefreshFog();
    v36InstallZoomControls();v36InstallUnitButtons();v36ClampCamera();v36UpdateZoomLabel();
    if(typeof updateHud==='function')updateHud();
  };
  if(els?.restart)els.restart.onclick=reset;
})();
