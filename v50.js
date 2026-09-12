// Alien Planet Defense v50
// Definitive zoom renderer: one explicit world->screen transform for the entire
// battlefield, while preserving the existing v17-v31 visual/effect stack.
const V50_TITLE='Alien Planet Defense v50';
document.title=V50_TITLE;
window.addEventListener('load',()=>{document.title=V50_TITLE;},{once:true});

(function installV50AuthoritativeZoomRenderer(){
  if(window.__apdV50Installed)return;
  window.__apdV50Installed=true;

  CONFIG.WORLD.MIN_ZOOM=.18;
  CONFIG.WORLD.MAX_ZOOM=Math.max(1.35,Number(CONFIG.WORLD.MAX_ZOOM)||1.35);
  CONFIG.WORLD.ZOOM_STEP=Math.max(.05,Number(CONFIG.WORLD.ZOOM_STEP)||.10);

  function zoomV50(){
    let z=Number(state?.camera?.zoom);
    if(!Number.isFinite(z)||z<=0)z=1;
    return Math.max(CONFIG.WORLD.MIN_ZOOM,Math.min(CONFIG.WORLD.MAX_ZOOM,z));
  }
  function clampV50(){
    if(!state?.camera)return;
    const z=zoomV50(),vw=W/z,vh=H/z;
    state.camera.x=Math.max(0,Math.min(Math.max(0,WORLD_W-vw),Number(state.camera.x)||0));
    state.camera.y=Math.max(0,Math.min(Math.max(0,WORLD_H-vh),Number(state.camera.y)||0));
  }
  function setZoomV50(next,sx=W/2,sy=H/2){
    if(!state?.camera)return 1;
    const old=zoomV50();
    let z=Number(next);if(!Number.isFinite(z))z=old;
    z=Math.max(CONFIG.WORLD.MIN_ZOOM,Math.min(CONFIG.WORLD.MAX_ZOOM,z));
    sx=Math.max(0,Math.min(W,Number(sx)||W/2));sy=Math.max(0,Math.min(H,Number(sy)||H/2));
    const wx=state.camera.x+sx/old,wy=state.camera.y+sy/old;
    state.camera.zoom=z;state.camera.x=wx-sx/z;state.camera.y=wy-sy/z;clampV50();
    try{if(typeof updateZoomLabel==='function')updateZoomLabel();}catch{}
    try{if(typeof updateCancelButtonPosition==='function')updateCancelButtonPosition();}catch{}
    return z;
  }
  try{zoomValue=zoomV50;}catch{}
  try{v31ZoomValue=zoomV50;}catch{}
  try{clampCamera=clampV50;}catch{}
  try{setZoom=setZoomV50;}catch{}

  // v31DrawV32 is the last pre-fog scene. It contains all visual/effect wrappers
  // through v31, including v17/v24/v25/v26 effects, but no old v32 fog overlay.
  let sceneV50=null;
  try{if(typeof v31DrawV32==='function')sceneV50=v31DrawV32;}catch{}
  try{if(!sceneV50&&typeof v25DrawV26==='function')sceneV50=v25DrawV26;}catch{}
  const drawFallbackV50=draw;

  // The old v26 renderer applies camera translate/zoom internally. We deliberately
  // neutralize only those exact legacy transform calls while sceneV50 is running,
  // then supply the authoritative transform ourselves. State camera/zoom stay real
  // so v47 culling, selection and visibility continue to use the correct viewport.
  let neutralizeLegacy=false,renderZ=1,renderCamX=0,renderCamY=0;
  let transformHookReady=false;
  try{
    const proto=Object.getPrototypeOf(ctx),rawScale=proto.scale,rawTranslate=proto.translate;
    if(typeof rawScale==='function'&&typeof rawTranslate==='function'){
      proto.scale=function(x,y){
        if(neutralizeLegacy&&this===ctx&&Math.abs(Number(x)-renderZ)<1e-7&&Math.abs(Number(y)-renderZ)<1e-7)return;
        return rawScale.call(this,x,y);
      };
      proto.translate=function(x,y){
        if(neutralizeLegacy&&this===ctx&&Math.abs(Number(x)+renderCamX)<1e-7&&Math.abs(Number(y)+renderCamY)<1e-7)return;
        return rawTranslate.call(this,x,y);
      };
      transformHookReady=true;
    }
  }catch(err){console.error('v50: could not install legacy transform neutralizer',err);}

  // Single fog layer using exactly the same z/camera transform as battlefield.
  const CELL=96,COLS=Math.ceil(WORLD_W/CELL),ROWS=Math.ceil(WORLD_H/CELL);
  const fog=document.createElement('canvas');fog.width=W;fog.height=H;
  const fc=fog.getContext('2d');
  function drawFogV50(z,camX,camY){
    try{if(typeof refreshFogSourcesV32==='function')refreshFogSourcesV32();}catch{}
    const ex=state.v47FogExplored instanceof Uint8Array?state.v47FogExplored:null;
    const src=state.v47VisionSources||state.v32VisionSources||[];
    fc.setTransform(1,0,0,1,0,0);fc.globalAlpha=1;fc.globalCompositeOperation='source-over';fc.clearRect(0,0,W,H);
    const x0=Math.max(0,camX),y0=Math.max(0,camY),x1=Math.min(WORLD_W,camX+W/z),y1=Math.min(WORLD_H,camY+H/z);
    const c0=Math.max(0,Math.floor(x0/CELL)-1),c1=Math.min(COLS-1,Math.floor(x1/CELL)+1),r0=Math.max(0,Math.floor(y0/CELL)-1),r1=Math.min(ROWS-1,Math.floor(y1/CELL)+1);
    fc.setTransform(z,0,0,z,-camX*z,-camY*z);
    fc.fillStyle='rgba(0,1,3,.985)';fc.fillRect(c0*CELL,r0*CELL,(c1-c0+1)*CELL+2/z,(r1-r0+1)*CELL+2/z);
    if(ex){
      fc.fillStyle='rgba(1,7,11,.62)';
      for(let gy=r0;gy<=r1;gy++){
        let run=-1;
        for(let gx=c0;gx<=c1+1;gx++){
          const seen=gx<=c1&&ex[gy*COLS+gx];
          if(seen&&run<0)run=gx;
          else if(!seen&&run>=0){fc.fillRect(run*CELL,gy*CELL,(gx-run)*CELL+2/z,CELL+2/z);run=-1;}
        }
      }
    }
    fc.globalCompositeOperation='destination-out';fc.fillStyle='#000';
    for(const v of src){
      if(!v||!Number.isFinite(v.x)||!Number.isFinite(v.y)||!Number.isFinite(v.r))continue;
      fc.globalAlpha=.92;fc.beginPath();fc.arc(v.x,v.y,v.r,0,Math.PI*2);fc.fill();
      fc.globalAlpha=1;fc.beginPath();fc.arc(v.x,v.y,v.r*.84,0,Math.PI*2);fc.fill();
    }
    fc.globalAlpha=1;fc.globalCompositeOperation='source-over';fc.setTransform(1,0,0,1,0,0);
    ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.drawImage(fog,0,0);ctx.restore();
  }

  function drawScreenV50(){
    ctx.save();ctx.setTransform(1,0,0,1,0,0);
    if(state.debug?.unlimitedCash||state.debug?.unlimitedLives){
      ctx.fillStyle='#7fe6ff';ctx.font='bold 13px Arial';ctx.textAlign='left';
      ctx.fillText(`DEBUG ${state.debug.unlimitedCash?'∞ CASH ':''}${state.debug.unlimitedLives?'∞ LIVES':''}`,14,H-14);
    }
    // Keep the v28/v47 design: paused gameplay stays unobscured for planning.
    if(state.gameOver){
      ctx.fillStyle='rgba(0,0,0,.65)';ctx.fillRect(0,0,W,H);ctx.fillStyle='#fff';ctx.font='bold 42px Arial';ctx.textAlign='center';ctx.fillText('BASE LOST',W/2,H/2);ctx.font='20px Arial';ctx.fillText('Press RESTART to begin a new run',W/2,H/2+38);
    }
    ctx.restore();
  }

  function renderSceneV50(){
    const z=zoomV50();clampV50();
    const camX=Number(state.camera.x)||0,camY=Number(state.camera.y)||0;
    renderZ=z;renderCamX=camX;renderCamY=camY;
    try{if(typeof refreshFogSourcesV32==='function')refreshFogSourcesV32();}catch{}

    if(!sceneV50||!transformHookReady){
      // Safe fallback rather than a blank screen. Diagnostics make this explicit.
      drawFallbackV50();
      window.__apdZoomDiagnostics={version:50,fallback:true,z,cameraX:camX,cameraY:camY};
      return;
    }

    const paused=state.paused,gameOver=state.gameOver,dc=state.debug?.unlimitedCash,dl=state.debug?.unlimitedLives;
    const off=drawOffscreenUnitIndicators,incoming=drawIncomingEnemyArrows,cancel=updateCancelButtonPosition;
    // Screen-space UI is redrawn after fog, not inside the transformed scene.
    try{drawOffscreenUnitIndicators=function(){};}catch{}
    try{drawIncomingEnemyArrows=function(){};}catch{}
    try{updateCancelButtonPosition=function(){};}catch{}
    state.paused=false;state.gameOver=false;if(state.debug){state.debug.unlimitedCash=false;state.debug.unlimitedLives=false;}

    ctx.save();ctx.setTransform(z,0,0,z,-camX*z,-camY*z);neutralizeLegacy=true;
    try{sceneV50();}
    catch(err){console.error('v50 authoritative scene render failed',err);}
    finally{
      neutralizeLegacy=false;ctx.restore();state.paused=paused;state.gameOver=gameOver;
      if(state.debug){state.debug.unlimitedCash=dc;state.debug.unlimitedLives=dl;}
      try{drawOffscreenUnitIndicators=off;}catch{}
      try{drawIncomingEnemyArrows=incoming;}catch{}
      try{updateCancelButtonPosition=cancel;}catch{}
    }

    drawFogV50(z,camX,camY);
    try{off?.();}catch(err){console.warn('v50 offscreen indicator draw failed',err);}
    try{incoming?.();}catch(err){console.warn('v50 incoming indicator draw failed',err);}
    try{cancel?.();}catch{}
    drawScreenV50();
    window.__apdZoomDiagnostics={version:50,fallback:false,z,cameraX:camX,cameraY:camY,matrix:{a:z,b:0,c:0,d:z,e:-camX*z,f:-camY*z}};
  }
  draw=renderSceneV50;

  // Rebind both zoom-control sets to the same authoritative camera function.
  function bind(btn,dir){if(!btn)return;btn.onclick=e=>{e?.preventDefault?.();e?.stopPropagation?.();setZoomV50(zoomV50()+dir*CONFIG.WORLD.ZOOM_STEP,W/2,H/2);};}
  bind(document.getElementById('mapZoomOutBtn'),-1);bind(document.getElementById('mapZoomInBtn'),1);
  try{if(typeof zoomOutBtn!=='undefined')bind(zoomOutBtn,-1);if(typeof zoomInBtn!=='undefined')bind(zoomInBtn,1);}catch{}

  // v49's capture-phase wheel handler remains authoritative for wheel input and
  // already updates camera.zoom. The renderer above now consumes that value
  // directly, so wheel and buttons finally change actual battlefield scale.
  clampV50();
  window.__apdAudit={...(window.__apdAudit||{}),version:50,zoom:'authoritative-render-transform',fogOwner:'v50-single-overlay'};
})();
