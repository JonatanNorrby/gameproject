// Alien Planet Defense v44
// Single-owner fog renderer. This deliberately bypasses every legacy draw wrapper
// that can paint v32/v36/v37 fog, then applies exactly one current fog overlay.
const V44_TITLE='Alien Planet Defense v44';
document.title=V44_TITLE;
window.__apdFogOwner='v44-single-overlay';
window.addEventListener('load',()=>{document.title=V44_TITLE;},{once:true});

(function installV44SingleFog(){
  const CELL=96,COLS=Math.ceil(WORLD_W/CELL),ROWS=Math.ceil(WORLD_H/CELL);
  const fogCanvas=document.createElement('canvas');fogCanvas.width=W;fogCanvas.height=H;
  const fc=fogCanvas.getContext('2d');

  const role=u=>{try{return typeof unitRole==='function'?unitRole(u):(u?.role||u?.type);}catch{return u?.role||u?.type;}};
  const active=u=>!!u&&(Number(u.hp)||0)>0&&!u.transportedIn&&!u.garrisonedIn;
  function roleCfg(u){try{return typeof roleConfig==='function'?(roleConfig(u)||{}):{};}catch{return {};}}
  function unitVision(u){
    const r=role(u),cfg=roleCfg(u);
    if(r==='scout')return 460;if(r==='spotter')return 440;if(r==='sniper')return 520;
    if(u?.type==='airunit'||(typeof isFlyingUnit==='function'&&isFlyingUnit(u)))return 350;
    return Math.max(250,(Number(cfg.RANGE)||0)+65,Number(cfg.DETECT_RANGE)||0,Number(cfg.SPOT_RANGE)||0);
  }
  function structureVision(s){
    if(!s?.built||s.hp<=0||s.type==='wall'||s.type==='bunker')return 0;
    try{if(typeof isUpgradeableTower==='function'&&isUpgradeableTower(s))return Math.max(265,(towerStats(s)?.range||0)+55);}catch{}
    if(s.type==='landingpad')return 330;if(s.type==='refinery')return 275;if(s.type==='mine'||s.type==='oremine')return 210;
    return 225;
  }
  function explored(){
    if(state.v44FogExplored instanceof Uint8Array&&state.v44FogExplored.length===COLS*ROWS)return state.v44FogExplored;
    const prior=[state.v43FogExplored,state.v42FogExplored,state.v37FogExplored,state.v36FogExplored].find(a=>a instanceof Uint8Array&&a.length===COLS*ROWS);
    state.v44FogExplored=prior?new Uint8Array(prior):new Uint8Array(COLS*ROWS);
    return state.v44FogExplored;
  }
  function refreshVision(){
    const ex=explored(),src=[{x:BASE_X,y:BASE_Y,r:390,kind:'base',id:'base'}];
    for(const u of state.units||[])if(active(u))src.push({x:u.x,y:u.y,r:unitVision(u),kind:'unit',id:u.id});
    for(const s of state.structures||[]){const r=structureVision(s);if(r>0)src.push({x:s.x,y:s.y,r,kind:'structure',id:s.id});}
    state.v44VisionSources=src;
    // Older targeting/arrow systems may still read these arrays. Feed all of them
    // the same authoritative source list, but none of them is allowed to draw fog.
    state.v43VisionSources=src;state.v42VisionSources=src;state.v37VisionSources=src;state.v36VisionSources=src;state.v32VisionSources=src;
    for(const v of src){
      const c0=Math.max(0,Math.floor((v.x-v.r)/CELL)),c1=Math.min(COLS-1,Math.floor((v.x+v.r)/CELL));
      const r0=Math.max(0,Math.floor((v.y-v.r)/CELL)),r1=Math.min(ROWS-1,Math.floor((v.y+v.r)/CELL));
      for(let gy=r0;gy<=r1;gy++)for(let gx=c0;gx<=c1;gx++){
        const cx=gx*CELL+CELL/2,cy=gy*CELL+CELL/2;
        if(Math.hypot(cx-v.x,cy-v.y)<=v.r+CELL*.72)ex[gy*COLS+gx]=1;
      }
    }
  }
  function pointVisible(x,y){for(const v of state.v44VisionSources||[])if(Math.hypot(x-v.x,y-v.y)<=v.r)return true;return false;}
  try{refreshFogSourcesV32=refreshVision;}catch{}
  try{pointVisibleV32=pointVisible;}catch{}
  try{drawFogOverlayV32=function(){};}catch{}

  // Capture the literal world transform used when the Base is painted. Buildings
  // and units are rendered under the same transform, so all reveal circles remain
  // mathematically attached to their world positions at every zoom level.
  let worldMatrix=null;
  function snapshot(){
    if(typeof ctx.getTransform==='function'){
      const m=ctx.getTransform();return{a:m.a,b:m.b,c:m.c,d:m.d,e:m.e,f:m.f};
    }
    const z=Math.max(Number(CONFIG.WORLD.MIN_ZOOM)||.18,Math.min(Number(CONFIG.WORLD.MAX_ZOOM)||1.35,Number(state.camera?.zoom)||1));
    return{a:z,b:0,c:0,d:z,e:-state.camera.x*z,f:-state.camera.y*z};
  }
  function scaleOf(m){return Math.max(.0001,(Math.hypot(m.a,m.b)+Math.hypot(m.c,m.d))/2);}
  function inverse(m,sx,sy){const det=m.a*m.d-m.b*m.c;if(Math.abs(det)<1e-9)return{x:state.camera.x,y:state.camera.y};const x=sx-m.e,y=sy-m.f;return{x:(m.d*x-m.c*y)/det,y:(-m.b*x+m.a*y)/det};}
  const drawBaseBeforeV44=drawBase;
  drawBase=function(...args){worldMatrix=snapshot();return drawBaseBeforeV44(...args);};

  function drawFogOnce(){
    const m=worldMatrix||snapshot(),ex=explored(),scale=scaleOf(m);
    fc.setTransform(1,0,0,1,0,0);fc.globalAlpha=1;fc.globalCompositeOperation='source-over';fc.clearRect(0,0,W,H);
    const corners=[inverse(m,0,0),inverse(m,W,0),inverse(m,0,H),inverse(m,W,H)];
    const minX=Math.max(0,Math.min(...corners.map(p=>p.x))),maxX=Math.min(WORLD_W,Math.max(...corners.map(p=>p.x)));
    const minY=Math.max(0,Math.min(...corners.map(p=>p.y))),maxY=Math.min(WORLD_H,Math.max(...corners.map(p=>p.y)));
    const c0=Math.max(0,Math.floor(minX/CELL)-1),c1=Math.min(COLS-1,Math.floor(maxX/CELL)+1);
    const r0=Math.max(0,Math.floor(minY/CELL)-1),r1=Math.min(ROWS-1,Math.floor(maxY/CELL)+1);
    fc.setTransform(m.a,m.b,m.c,m.d,m.e,m.f);
    for(let gy=r0;gy<=r1;gy++)for(let gx=c0;gx<=c1;gx++){
      fc.fillStyle=ex[gy*COLS+gx]?'rgba(1,7,11,.62)':'rgba(0,1,3,.985)';
      fc.fillRect(gx*CELL,gy*CELL,CELL+2/scale,CELL+2/scale);
    }
    fc.globalCompositeOperation='destination-out';fc.fillStyle='#000';
    for(const v of state.v44VisionSources||[]){
      fc.globalAlpha=.92;fc.beginPath();fc.arc(v.x,v.y,v.r,0,Math.PI*2);fc.fill();
      fc.globalAlpha=1;fc.beginPath();fc.arc(v.x,v.y,v.r*.84,0,Math.PI*2);fc.fill();
    }
    fc.globalAlpha=1;fc.globalCompositeOperation='source-over';fc.setTransform(1,0,0,1,0,0);
    ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.drawImage(fogCanvas,0,0);ctx.restore();
  }

  // Hard guarantee: never use the current draw chain as a fallback. The current
  // chain contains the old v36/v37 fog closures and was the source of double fog
  // whenever the pre-v32 symbol was unavailable. Prefer the known pre-fog scene;
  // if it cannot be resolved, render the scene explicitly instead.
  let cleanScene=null;
  try{if(typeof v31DrawV32==='function')cleanScene=v31DrawV32;}catch{}

  function manualCleanScene(){
    const z=Math.max(Number(CONFIG.WORLD.MIN_ZOOM)||.18,Math.min(Number(CONFIG.WORLD.MAX_ZOOM)||1.35,Number(state.camera?.zoom)||1)),cam=state.camera;
    ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,W,H);ctx.restore();
    ctx.save();ctx.setTransform(z,0,0,z,-cam.x*z,-cam.y*z);
    drawBackdrop();drawBase();
    for(const s of state.structures||[])drawStructure(s);
    for(const u of state.units||[])drawUnit(u);
    for(const e of state.enemies||[])drawEnemy(e);
    for(const b of state.bullets||[]){ctx.strokeStyle=b.type==='laser'?'#ff5967':'#fff0a0';ctx.lineWidth=b.type==='laser'?4:1.6;ctx.beginPath();ctx.moveTo(b.x-b.vx*.016,b.y-b.vy*.016);ctx.lineTo(b.x,b.y);ctx.stroke();}
    for(const b of state.enemyBullets||[]){ctx.fillStyle='#9cff55';ctx.beginPath();ctx.arc(b.x,b.y,4,0,Math.PI*2);ctx.fill();}
    for(const p of state.particles||[]){ctx.globalAlpha=Math.max(0,p.life/.45);ctx.fillStyle='#b9ff8a';ctx.fillRect(p.x,p.y,3,3);ctx.globalAlpha=1;}
    ctx.restore();
    if(typeof drawOffscreenUnitIndicators==='function')drawOffscreenUnitIndicators();
    if(typeof drawIncomingEnemyArrows==='function')drawIncomingEnemyArrows();
    if(typeof updateCancelButtonPosition==='function')updateCancelButtonPosition();
  }

  function drawScreenOverlays(){
    if(state.debug?.unlimitedCash||state.debug?.unlimitedLives){ctx.fillStyle='#7fe6ff';ctx.font='bold 13px Arial';ctx.textAlign='left';ctx.fillText(`DEBUG ${state.debug.unlimitedCash?'∞ CASH ':''}${state.debug.unlimitedLives?'∞ LIVES':''}`,14,H-14);}
    if(state.paused&&!state.gameOver){ctx.fillStyle='rgba(0,0,0,.36)';ctx.fillRect(0,0,W,H);ctx.fillStyle='#ffe36b';ctx.font='bold 48px Arial';ctx.textAlign='center';ctx.fillText('PAUSED',W/2,80);ctx.font='16px Arial';ctx.fillText('Orders and building placements can still be queued',W/2,108);}
    if(state.gameOver){ctx.fillStyle='rgba(0,0,0,.65)';ctx.fillRect(0,0,W,H);ctx.fillStyle='#fff';ctx.font='bold 42px Arial';ctx.textAlign='center';ctx.fillText('BASE LOST',W/2,H/2);ctx.font='20px Arial';ctx.fillText('Press RESTART to begin a new run',W/2,H/2+38);}
  }

  draw=function(){
    refreshVision();worldMatrix=null;
    if(cleanScene){
      const paused=state.paused,gameOver=state.gameOver;
      state.paused=false;state.gameOver=false;
      try{cleanScene();}finally{state.paused=paused;state.gameOver=gameOver;}
    }else manualCleanScene();
    drawFogOnce();
    drawScreenOverlays();
  };

  const resetBeforeV44=reset;
  reset=function(){
    resetBeforeV44();
    state.v44FogExplored=new Uint8Array(COLS*ROWS);state.v44VisionSources=[];
    refreshVision();
    if(typeof updateHud==='function')updateHud();
  };
  if(els?.restart)els.restart.onclick=reset;
  refreshVision();
})();
