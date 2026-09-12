// Alien Planet Defense v51
// Clean zoom rebuild: direct world renderer, no legacy draw-wrapper zoom chain.
// Also preserves v49 captured-cache cleanup and rapid move-order reliability.
const V51_TITLE='Alien Planet Defense v51';
document.title=V51_TITLE;
window.addEventListener('load',()=>{document.title=V51_TITLE;},{once:true});

(function installV51CleanCameraRuntime(){
  if(window.__apdV51Installed)return;
  window.__apdV51Installed=true;

  CONFIG.WORLD.MIN_ZOOM=.18;
  CONFIG.WORLD.MAX_ZOOM=Math.max(1.35,Number(CONFIG.WORLD.MAX_ZOOM)||1.35);
  CONFIG.WORLD.ZOOM_STEP=Math.max(.05,Number(CONFIG.WORLD.ZOOM_STEP)||.10);

  function zoomV51(){
    let z=Number(state?.camera?.zoom);
    if(!Number.isFinite(z)||z<=0)z=1;
    return Math.max(CONFIG.WORLD.MIN_ZOOM,Math.min(CONFIG.WORLD.MAX_ZOOM,z));
  }
  function clampCameraV51(){
    if(!state?.camera)return;
    const z=zoomV51(),vw=W/z,vh=H/z;
    state.camera.x=Math.max(0,Math.min(Math.max(0,WORLD_W-vw),Number(state.camera.x)||0));
    state.camera.y=Math.max(0,Math.min(Math.max(0,WORLD_H-vh),Number(state.camera.y)||0));
  }
  function refreshZoomUiV51(){
    const z=zoomV51(),min=CONFIG.WORLD.MIN_ZOOM,max=CONFIG.WORLD.MAX_ZOOM;
    for(const [id,kind] of [['mapZoomLabel','label'],['mapZoomOutBtn','out'],['mapZoomInBtn','in']]){
      const el=document.getElementById(id);if(!el)continue;
      if(kind==='label')el.textContent=`${Math.round(z*100)}%`;
      else el.disabled=kind==='out'?z<=min+.0001:z>=max-.0001;
    }
    try{
      if(typeof zoomLabel!=='undefined'&&zoomLabel)zoomLabel.textContent=`${Math.round(z*100)}%`;
      if(typeof zoomOutBtn!=='undefined'&&zoomOutBtn)zoomOutBtn.disabled=z<=min+.0001;
      if(typeof zoomInBtn!=='undefined'&&zoomInBtn)zoomInBtn.disabled=z>=max-.0001;
    }catch{}
  }
  function setZoomV51(next,sx=W/2,sy=H/2){
    if(!state?.camera)return 1;
    const old=zoomV51();
    let z=Number(next);if(!Number.isFinite(z))z=old;
    z=Math.max(CONFIG.WORLD.MIN_ZOOM,Math.min(CONFIG.WORLD.MAX_ZOOM,z));
    sx=Math.max(0,Math.min(W,Number(sx)||W/2));
    sy=Math.max(0,Math.min(H,Number(sy)||H/2));
    const worldX=state.camera.x+sx/old,worldY=state.camera.y+sy/old;
    state.camera.zoom=z;
    state.camera.x=worldX-sx/z;
    state.camera.y=worldY-sy/z;
    clampCameraV51();refreshZoomUiV51();
    try{if(typeof updateCancelButtonPosition==='function')updateCancelButtonPosition();}catch{}
    return z;
  }
  try{zoomValue=zoomV51;}catch{}
  try{v31ZoomValue=zoomV51;}catch{}
  try{clampCamera=clampCameraV51;}catch{}
  try{setZoom=setZoomV51;}catch{}
  try{updateZoomLabel=refreshZoomUiV51;}catch{}

  // Pointer conversion uses the exact same camera transform as rendering.
  worldFromEvent=function(e){
    const rect=canvas.getBoundingClientRect(),cssW=canvas.clientWidth||rect.width||W,cssH=canvas.clientHeight||rect.height||H;
    const localX=e.clientX-rect.left-(canvas.clientLeft||0),localY=e.clientY-rect.top-(canvas.clientTop||0);
    const sx=localX*(W/cssW),sy=localY*(H/cssH),z=zoomV51();
    return{x:state.camera.x+sx/z,y:state.camera.y+sy/z,sx,sy};
  };

  function bindZoomButton(btn,dir){
    if(!btn)return;
    btn.type='button';btn.disabled=false;
    btn.onclick=e=>{e?.preventDefault?.();e?.stopPropagation?.();setZoomV51(zoomV51()+dir*CONFIG.WORLD.ZOOM_STEP,W/2,H/2);};
  }
  bindZoomButton(document.getElementById('mapZoomOutBtn'),-1);
  bindZoomButton(document.getElementById('mapZoomInBtn'),1);
  try{if(typeof zoomOutBtn!=='undefined')bindZoomButton(zoomOutBtn,-1);if(typeof zoomInBtn!=='undefined')bindZoomButton(zoomInBtn,1);}catch{}

  // One capture-phase wheel owner. v49 is no longer loaded, so this runs before
  // the old v26 bubble listener and prevents it from applying a second camera move.
  canvas.addEventListener('wheel',e=>{
    try{if(typeof commandMenuOpen==='function'&&commandMenuOpen())return;}catch{}
    e.preventDefault();e.stopImmediatePropagation();
    const rect=canvas.getBoundingClientRect();
    const sx=(e.clientX-rect.left)*W/(rect.width||W),sy=(e.clientY-rect.top)*H/(rect.height||H);
    setZoomV51(zoomV51()+(e.deltaY<0?CONFIG.WORLD.ZOOM_STEP:-CONFIG.WORLD.ZOOM_STEP),sx,sy);
  },{capture:true,passive:false});

  // -------------------------------------------------------------------------
  // DIRECT WORLD RENDERER
  // Do not call any old draw() wrapper. Every world primitive is drawn exactly
  // once beneath one matrix: screen = (world - camera) * zoom.
  // -------------------------------------------------------------------------
  const FOG_CELL=96,FOG_COLS=Math.ceil(WORLD_W/FOG_CELL),FOG_ROWS=Math.ceil(WORLD_H/FOG_CELL);
  const fogCanvasV51=document.createElement('canvas');fogCanvasV51.width=W;fogCanvasV51.height=H;
  const fogCtxV51=fogCanvasV51.getContext('2d');

  function refreshVisionV51(){try{if(typeof refreshFogSourcesV32==='function')refreshFogSourcesV32();}catch{}}

  function drawProjectilesV51(){
    for(const b of state.bullets||[]){
      if(!Number.isFinite(b.x)||!Number.isFinite(b.y))continue;
      ctx.strokeStyle=b.type==='laser'?'#ff5967':b.type==='antiair'?'#cceeff':b.type==='minigun'?'#ffe28a':b.type==='drone'?'#9fe8ff':'#fff0a0';
      ctx.lineWidth=b.type==='laser'?4:1.6;ctx.beginPath();ctx.moveTo(b.x-(Number(b.vx)||0)*.016,b.y-(Number(b.vy)||0)*.016);ctx.lineTo(b.x,b.y);ctx.stroke();
    }
    for(const b of state.enemyBullets||[]){if(!Number.isFinite(b.x)||!Number.isFinite(b.y))continue;ctx.fillStyle='#9cff55';ctx.beginPath();ctx.arc(b.x,b.y,4,0,Math.PI*2);ctx.fill();}
    for(const p of state.particles||[]){if(!Number.isFinite(p.x)||!Number.isFinite(p.y))continue;ctx.globalAlpha=Math.max(0,Math.min(1,(Number(p.life)||0)/.45));ctx.fillStyle='#b9ff8a';ctx.fillRect(p.x,p.y,3,3);}ctx.globalAlpha=1;
  }

  function drawPlayerMinesV51(){
    for(const m of state.playerMines||[]){ctx.fillStyle='#71653b';ctx.beginPath();ctx.arc(m.x,m.y,7,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#d8c474';ctx.lineWidth=1.5;for(let i=0;i<6;i++){const a=i/6*Math.PI*2;ctx.beginPath();ctx.moveTo(m.x+Math.cos(a)*6,m.y+Math.sin(a)*6);ctx.lineTo(m.x+Math.cos(a)*11,m.y+Math.sin(a)*11);ctx.stroke();}}
  }

  function pruneEffects(name,now){const a=state[name];if(!Array.isArray(a))return[];state[name]=a.filter(f=>(Number(f?.expires)||0)>now);return state[name];}
  function drawEffectsV51(){
    const now=performance.now();
    for(const f of pruneEffects('v17Effects',now)){
      const alpha=Math.max(.15,(f.expires-now)/190);ctx.globalAlpha=alpha;
      if(f.kind==='rail'){ctx.strokeStyle='#bdefff';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(f.x1,f.y1);ctx.lineTo(f.x2,f.y2);ctx.stroke();ctx.strokeStyle='#fff';ctx.lineWidth=1.5;ctx.stroke();}
      else if(f.kind==='tesla'&&Array.isArray(f.points)){ctx.strokeStyle='#b59cff';ctx.lineWidth=3;for(let i=1;i<f.points.length;i++){const a=f.points[i-1],b=f.points[i];ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}}
      else if(f.kind==='rocket'){ctx.strokeStyle='#ffad58';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(f.x1,f.y1);ctx.lineTo(f.x2,f.y2);ctx.stroke();ctx.fillStyle='rgba(255,125,50,.25)';ctx.beginPath();ctx.arc(f.x2,f.y2,f.r||30,0,Math.PI*2);ctx.fill();}
      else if(f.kind==='heal'){ctx.strokeStyle='#80f2d3';ctx.lineWidth=3;ctx.setLineDash([5,5]);ctx.beginPath();ctx.moveTo(f.x1,f.y1);ctx.lineTo(f.x2,f.y2);ctx.stroke();ctx.setLineDash([]);}
    }
    for(const f of pruneEffects('v21Effects',now)){ctx.globalAlpha=Math.max(.12,(f.expires-now)/130);ctx.strokeStyle='#ff6f78';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(f.x1,f.y1);ctx.lineTo(f.x2,f.y2);ctx.stroke();ctx.strokeStyle='#fff0f1';ctx.lineWidth=2;ctx.stroke();}
    for(const f of pruneEffects('v22Effects',now)){
      ctx.globalAlpha=Math.max(.12,(f.expires-now)/250);
      if(f.kind==='cryo'){ctx.strokeStyle='#8cecff';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(f.x1,f.y1);ctx.lineTo(f.x2,f.y2);ctx.stroke();}
      else if(f.kind==='missile'){ctx.strokeStyle='#ffbf79';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(f.x1,f.y1);ctx.lineTo(f.x2,f.y2);ctx.stroke();ctx.fillStyle='rgba(255,120,55,.22)';ctx.beginPath();ctx.arc(f.x2,f.y2,f.r||30,0,Math.PI*2);ctx.fill();}
      else{ctx.fillStyle=f.kind==='flak'?'rgba(190,225,255,.18)':'rgba(255,160,70,.20)';ctx.strokeStyle=f.kind==='flak'?'#d5f3ff':'#ff9d55';ctx.lineWidth=3;ctx.beginPath();ctx.arc(f.x,f.y,f.r||24,0,Math.PI*2);ctx.fill();ctx.stroke();}
    }
    for(const f of pruneEffects('v24Effects',now)){
      ctx.globalAlpha=Math.min(1,Math.max(.12,(f.expires-now)/1000)*2.5);
      if(f.kind==='acid'){ctx.strokeStyle='#9dff4f';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(f.x1,f.y1);ctx.quadraticCurveTo((f.x1+f.x2)/2,(f.y1+f.y2)/2-45,f.x2,f.y2);ctx.stroke();ctx.fillStyle='rgba(130,255,60,.28)';ctx.beginPath();ctx.arc(f.x2,f.y2,18,0,Math.PI*2);ctx.fill();}
      else if(f.kind==='charge'){ctx.strokeStyle='#ffd35e';ctx.lineWidth=3;ctx.beginPath();ctx.arc(f.x,f.y,34,0,Math.PI*2);ctx.stroke();}
      else if(f.kind==='impact'){ctx.fillStyle='rgba(255,120,65,.28)';ctx.strokeStyle='#ff8658';ctx.lineWidth=4;ctx.beginPath();ctx.arc(f.x,f.y,f.r||46,0,Math.PI*2);ctx.fill();ctx.stroke();}
      else{ctx.strokeStyle=f.kind==='emerge'?'#d7bd78':'#987443';ctx.lineWidth=3;ctx.setLineDash([5,4]);ctx.beginPath();ctx.arc(f.x,f.y,24,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);}
    }
    for(const f of pruneEffects('v25Effects',now)){
      ctx.globalAlpha=Math.max(.15,(f.expires-now)/260);
      if(f.kind==='repair'){ctx.strokeStyle='#ffd65c';ctx.lineWidth=3;ctx.setLineDash([5,4]);ctx.beginPath();ctx.moveTo(f.x1,f.y1);ctx.lineTo(f.x2,f.y2);ctx.stroke();ctx.setLineDash([]);}
      else if(f.kind==='trooperflame'){ctx.strokeStyle='#ff8a3d';ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(f.x1,f.y1);ctx.lineTo(f.x2,f.y2);ctx.stroke();}
      else if(f.kind==='shipblast'){ctx.strokeStyle='#9fe8ff';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(f.x1,f.y1);ctx.lineTo(f.x2,f.y2);ctx.stroke();ctx.fillStyle='rgba(110,205,255,.22)';ctx.beginPath();ctx.arc(f.x2,f.y2,f.r||30,0,Math.PI*2);ctx.fill();}
      else{ctx.fillStyle='rgba(255,180,70,.27)';ctx.strokeStyle='#ffc061';ctx.lineWidth=3;ctx.beginPath();ctx.arc(f.x,f.y,f.r||24,0,Math.PI*2);ctx.fill();ctx.stroke();}
    }
    for(const f of pruneEffects('v26Effects',now)){
      ctx.globalAlpha=Math.max(.15,(f.expires-now)/260);
      if(f.kind==='repairvehicle'){ctx.strokeStyle='#ffd55f';ctx.lineWidth=4;ctx.setLineDash([6,4]);ctx.beginPath();ctx.moveTo(f.x1,f.y1);ctx.lineTo(f.x2,f.y2);ctx.stroke();ctx.setLineDash([]);}
      else{ctx.strokeStyle=f.kind==='artillery'?'#f0bf72':'#c8d7a3';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(f.x1,f.y1);ctx.lineTo(f.x2,f.y2);ctx.stroke();ctx.fillStyle=f.kind==='artillery'?'rgba(240,150,70,.24)':'rgba(190,205,130,.18)';ctx.beginPath();ctx.arc(f.x2,f.y2,f.r||30,0,Math.PI*2);ctx.fill();ctx.stroke();}
    }
    ctx.globalAlpha=1;ctx.setLineDash([]);
  }

  function drawWallDraftV51(){
    try{
      if(typeof wallPath==='undefined'||!Array.isArray(wallPath)||!wallPath.length)return;
      ctx.save();ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='rgba(99,232,137,.62)';ctx.lineWidth=CONFIG.WALL.THICKNESS;ctx.beginPath();ctx.moveTo(wallPath[0].x,wallPath[0].y);for(let i=1;i<wallPath.length;i++)ctx.lineTo(wallPath[i].x,wallPath[i].y);if(typeof wallLastWorld!=='undefined'&&wallLastWorld&&typeof wallPainting!=='undefined'&&wallPainting)ctx.lineTo(wallLastWorld.x,wallLastWorld.y);ctx.stroke();
      if(typeof wallPathLength==='function'&&typeof wallPrice==='function'){const len=wallPathLength(),p=wallPath[wallPath.length-1];ctx.fillStyle='rgba(5,12,17,.9)';ctx.fillRect(p.x-74,p.y-34,148,20);ctx.fillStyle='#dff7e5';ctx.font='bold 11px Arial';ctx.textAlign='center';ctx.fillText(`${Math.round(len)}px · ${wallPrice(len)} metal`,p.x,p.y-20);}ctx.restore();
    }catch{}
  }

  function drawFogV51(z,camX,camY){
    refreshVisionV51();
    const ex=state.v47FogExplored instanceof Uint8Array?state.v47FogExplored:null,src=state.v47VisionSources||state.v32VisionSources||[],fc=fogCtxV51;
    fc.setTransform(1,0,0,1,0,0);fc.globalAlpha=1;fc.globalCompositeOperation='source-over';fc.clearRect(0,0,W,H);
    const x0=Math.max(0,camX),y0=Math.max(0,camY),x1=Math.min(WORLD_W,camX+W/z),y1=Math.min(WORLD_H,camY+H/z);
    const c0=Math.max(0,Math.floor(x0/FOG_CELL)-1),c1=Math.min(FOG_COLS-1,Math.floor(x1/FOG_CELL)+1),r0=Math.max(0,Math.floor(y0/FOG_CELL)-1),r1=Math.min(FOG_ROWS-1,Math.floor(y1/FOG_CELL)+1);
    fc.setTransform(z,0,0,z,-camX*z,-camY*z);fc.fillStyle='rgba(0,1,3,.985)';fc.fillRect(c0*FOG_CELL,r0*FOG_CELL,(c1-c0+1)*FOG_CELL+2/z,(r1-r0+1)*FOG_CELL+2/z);
    if(ex){fc.fillStyle='rgba(1,7,11,.62)';for(let gy=r0;gy<=r1;gy++){let run=-1;for(let gx=c0;gx<=c1+1;gx++){const seen=gx<=c1&&ex[gy*FOG_COLS+gx];if(seen&&run<0)run=gx;else if(!seen&&run>=0){fc.fillRect(run*FOG_CELL,gy*FOG_CELL,(gx-run)*FOG_CELL+2/z,FOG_CELL+2/z);run=-1;}}}}
    fc.globalCompositeOperation='destination-out';fc.fillStyle='#000';for(const v of src){if(!v||!Number.isFinite(v.x)||!Number.isFinite(v.y)||!Number.isFinite(v.r))continue;fc.globalAlpha=.92;fc.beginPath();fc.arc(v.x,v.y,v.r,0,Math.PI*2);fc.fill();fc.globalAlpha=1;fc.beginPath();fc.arc(v.x,v.y,v.r*.84,0,Math.PI*2);fc.fill();}
    fc.globalAlpha=1;fc.globalCompositeOperation='source-over';fc.setTransform(1,0,0,1,0,0);ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.drawImage(fogCanvasV51,0,0);ctx.restore();
  }

  function drawScreenV51(){
    try{if(typeof drawOffscreenUnitIndicators==='function')drawOffscreenUnitIndicators();}catch{}
    try{if(typeof drawIncomingEnemyArrows==='function')drawIncomingEnemyArrows();}catch{}
    try{if(typeof updateCancelButtonPosition==='function')updateCancelButtonPosition();}catch{}
    ctx.save();ctx.setTransform(1,0,0,1,0,0);
    if(state.debug?.unlimitedCash||state.debug?.unlimitedLives){ctx.fillStyle='#7fe6ff';ctx.font='bold 13px Arial';ctx.textAlign='left';ctx.fillText(`DEBUG ${state.debug.unlimitedCash?'∞ CASH ':''}${state.debug.unlimitedLives?'∞ LIVES':''}`,14,H-14);}
    if(state.gameOver){ctx.fillStyle='rgba(0,0,0,.65)';ctx.fillRect(0,0,W,H);ctx.fillStyle='#fff';ctx.font='bold 42px Arial';ctx.textAlign='center';ctx.fillText('BASE LOST',W/2,H/2);ctx.font='20px Arial';ctx.fillText('Press RESTART to begin a new run',W/2,H/2+38);}
    ctx.restore();
  }

  function renderV51(){
    const z=zoomV51();clampCameraV51();refreshVisionV51();
    const camX=Number(state.camera.x)||0,camY=Number(state.camera.y)||0;
    ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,W,H);ctx.restore();
    ctx.save();ctx.setTransform(z,0,0,z,-camX*z,-camY*z);
    try{
      drawBackdrop();drawBase();
      for(const s of state.structures||[])drawStructure(s);
      for(const u of state.units||[])drawUnit(u);
      for(const e of state.enemies||[])drawEnemy(e);
      drawProjectilesV51();drawPlayerMinesV51();drawEffectsV51();drawWallDraftV51();
    }catch(err){console.error('v51 direct world render failed',err);}
    ctx.restore();
    drawFogV51(z,camX,camY);drawScreenV51();
    window.__apdZoomDiagnostics={version:51,z,cameraX:camX,cameraY:camY,renderer:'direct-world-primitives',matrix:{a:z,b:0,c:0,d:z,e:-camX*z,f:-camY*z}};
  }
  draw=renderV51;
  window.__apdFogOwner='v51-single-overlay';

  // -------------------------------------------------------------------------
  // Keep the good v49 interaction fixes while removing v49's competing wheel
  // listener from the active script chain.
  // -------------------------------------------------------------------------
  function removeCapturedCachesV51(){if(Array.isArray(state?.v47ResourceCaches)&&state.v47ResourceCaches.some(c=>c?.captured))state.v47ResourceCaches=state.v47ResourceCaches.filter(c=>!c?.captured);}
  const updateBeforeV51=update;
  update=function(dt){const r=updateBeforeV51(dt);removeCapturedCachesV51();return r;};
  removeCapturedCachesV51();

  canvas.addEventListener('pointerup',e=>{if(e.pointerType!=='mouse')return;try{if(pointer&&pointer.id===e.pointerId)pointer.drag=false;}catch{}},{capture:true});

  const setUnitDestinationBeforeV51=setUnitDestination;
  function unitRadiusV51(u){try{return Math.max(4,Number(uRadius(u))||18);}catch{return 18;}}
  function nearestOpenV51(x,y,r){if(!navPointBlocked(x,y,r))return{x,y};for(const d of [18,30,44,60,80,105])for(let i=0;i<24;i++){const a=i/24*Math.PI*2,nx=x+Math.cos(a)*d,ny=y+Math.sin(a)*d;if(nx<r+5||ny<r+5||nx>WORLD_W-r-5||ny>WORLD_H-r-5)continue;if(!navPointBlocked(nx,ny,r))return{x:nx,y:ny};}return null;}
  setUnitDestination=function(u,x,y,opt={}){
    if(!u||!Number.isFinite(x)||!Number.isFinite(y))return false;
    let air=false;try{air=typeof isFlyingUnit==='function'&&isFlyingUnit(u);}catch{air=u.type==='airunit';}
    if(air)return setUnitDestinationBeforeV51(u,x,y,opt);
    const r=unitRadiusV51(u),dest=nearestOpenV51(x,y,r);if(!dest){if(els?.message)els.message.textContent='That destination is physically blocked.';return false;}
    const oldPath=Array.isArray(u.path)?u.path:[],oldTarget=u.moveTarget,ok=setUnitDestinationBeforeV51(u,dest.x,dest.y,opt);if(!ok){u.path=oldPath;u.moveTarget=oldTarget;return false;}return true;
  };
  const handleTapBeforeV51=handleTap;
  handleTap=function(x,y){
    const selected=state?.selectedUnit,clicked=typeof unitAt==='function'?unitAt(x,y):null,tower=typeof towerAt==='function'?towerAt(x,y):null;
    const special=state?.attachMode||state?.platoonAttachMode||state?.routeEditing||(typeof wallModeActive==='function'&&wallModeActive())||state?.v47MedicAttachMode||state?.v47ApcAttachMode;
    if(selected&&!clicked&&!tower&&!special&&!selected.garrisonedIn&&!selected.transportedIn){
      if(selected.attachedTo){if(els?.message)els.message.textContent='Detach this squad before giving it an independent move order.';return;}
      if(selected.type==='truck'&&!state.routeEditing){selected.routeLoop=false;selected.routeActive=false;}
      if(setUnitDestination(selected,x,y)&&els?.message)els.message.textContent='Move order updated.';return;
    }
    return handleTapBeforeV51(x,y);
  };

  window.addEventListener('resize',()=>{clampCameraV51();refreshZoomUiV51();},{passive:true});
  window.addEventListener('orientationchange',()=>setTimeout(()=>{clampCameraV51();refreshZoomUiV51();},100),{passive:true});
  refreshZoomUiV51();clampCameraV51();
  window.__apdAudit={...(window.__apdAudit||{}),version:51,zoom:'direct-renderer-no-legacy-draw-chain',fogOwner:'v51-single-overlay',capturedCaches:'removed',moveOrders:'rapid-reroute-preserved'};
})();
