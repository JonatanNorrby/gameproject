// Alien Planet Defense v49
// Authoritative zoom repair, consumed-cache cleanup, and reliable rapid move orders.
const V49_TITLE='Alien Planet Defense v49';
document.title=V49_TITLE;
window.addEventListener('load',()=>{document.title=V49_TITLE;},{once:true});

(function installV49InteractionRepair(){
  if(window.__apdV49Installed)return;
  window.__apdV49Installed=true;

  // ---------------------------------------------------------------------------
  // ZOOM
  // Keep one camera.zoom value as the source of truth for rendering, pointer
  // conversion, wheel zoom, map buttons and Command Menu buttons.
  // ---------------------------------------------------------------------------
  CONFIG.WORLD.MIN_ZOOM=.18;
  CONFIG.WORLD.MAX_ZOOM=Math.max(1.35,Number(CONFIG.WORLD.MAX_ZOOM)||1.35);
  CONFIG.WORLD.ZOOM_STEP=Math.max(.05,Number(CONFIG.WORLD.ZOOM_STEP)||.10);

  function zoomV49(){
    if(!state?.camera)return 1;
    let z=Number(state.camera.zoom);
    if(!Number.isFinite(z)||z<=0)z=1;
    return Math.max(CONFIG.WORLD.MIN_ZOOM,Math.min(CONFIG.WORLD.MAX_ZOOM,z));
  }

  function clampCameraV49(){
    if(!state?.camera)return;
    const z=zoomV49(),vw=W/z,vh=H/z;
    const maxX=Math.max(0,WORLD_W-vw),maxY=Math.max(0,WORLD_H-vh);
    state.camera.x=Math.max(0,Math.min(maxX,Number(state.camera.x)||0));
    state.camera.y=Math.max(0,Math.min(maxY,Number(state.camera.y)||0));
  }

  function refreshZoomV49(){
    const z=zoomV49(),min=CONFIG.WORLD.MIN_ZOOM,max=CONFIG.WORLD.MAX_ZOOM;
    const label=document.getElementById('mapZoomLabel'),out=document.getElementById('mapZoomOutBtn'),inn=document.getElementById('mapZoomInBtn');
    if(label)label.textContent=`${Math.round(z*100)}%`;
    if(out)out.disabled=z<=min+.0001;
    if(inn)inn.disabled=z>=max-.0001;
    try{
      if(typeof zoomLabel!=='undefined'&&zoomLabel)zoomLabel.textContent=`${Math.round(z*100)}%`;
      if(typeof zoomOutBtn!=='undefined'&&zoomOutBtn)zoomOutBtn.disabled=z<=min+.0001;
      if(typeof zoomInBtn!=='undefined'&&zoomInBtn)zoomInBtn.disabled=z>=max-.0001;
    }catch{}
  }

  function setZoomV49(next,sx=W/2,sy=H/2){
    if(!state?.camera)return 1;
    const old=zoomV49();
    let z=Number(next);if(!Number.isFinite(z))z=old;
    z=Math.max(CONFIG.WORLD.MIN_ZOOM,Math.min(CONFIG.WORLD.MAX_ZOOM,z));
    sx=Math.max(0,Math.min(W,Number(sx)||W/2));
    sy=Math.max(0,Math.min(H,Number(sy)||H/2));
    const worldX=state.camera.x+sx/old,worldY=state.camera.y+sy/old;
    state.camera.zoom=z;
    state.camera.x=worldX-sx/z;
    state.camera.y=worldY-sy/z;
    clampCameraV49();
    refreshZoomV49();
    try{if(typeof updateCancelButtonPosition==='function')updateCancelButtonPosition();}catch{}
    return z;
  }

  // Replace every public zoom entry point used by the inherited renderer/input.
  try{zoomValue=zoomV49;}catch{}
  try{v31ZoomValue=zoomV49;}catch{}
  try{clampCamera=clampCameraV49;}catch{}
  try{setZoom=setZoomV49;}catch{}
  try{updateZoomLabel=refreshZoomV49;}catch{}

  function bindZoomButton(btn,dir){
    if(!btn)return;
    btn.type='button';btn.disabled=false;
    btn.onclick=e=>{e?.preventDefault?.();e?.stopPropagation?.();setZoomV49(zoomV49()+dir*CONFIG.WORLD.ZOOM_STEP,W/2,H/2);};
    btn.onpointerdown=e=>e.stopPropagation();
    btn.onpointerup=e=>e.stopPropagation();
  }

  function installZoomControlsV49(){
    let box=document.getElementById('mapZoomControls');
    if(!box){
      box=document.createElement('div');box.id='mapZoomControls';box.setAttribute('aria-label','Map zoom controls');
      box.innerHTML='<button id="mapZoomOutBtn" type="button" aria-label="Zoom out">−</button><span id="mapZoomLabel">100%</span><button id="mapZoomInBtn" type="button" aria-label="Zoom in">+</button>';
      (document.getElementById('canvasShell')||document.body).appendChild(box);
    }
    Object.assign(box.style,{position:'fixed',right:'14px',bottom:'14px',zIndex:'116',display:'flex',visibility:'visible',opacity:'1',alignItems:'center',gap:'6px',padding:'7px',border:'2px solid rgba(112,214,255,.92)',borderRadius:'11px',background:'rgba(4,14,22,.94)',boxShadow:'0 5px 22px rgba(0,0,0,.55)',pointerEvents:'auto'});
    const label=box.querySelector('#mapZoomLabel'),out=box.querySelector('#mapZoomOutBtn'),inn=box.querySelector('#mapZoomInBtn');
    if(label)Object.assign(label.style,{minWidth:'54px',height:'46px',display:'flex',alignItems:'center',justifyContent:'center',font:'900 12px Arial',color:'#effaff',pointerEvents:'none'});
    for(const b of [out,inn])if(b)Object.assign(b.style,{width:'48px',height:'48px',minWidth:'48px',padding:'0',border:'1px solid #7db7d5',borderRadius:'8px',background:'#123247',color:'#fff',font:'900 30px/1 Arial',cursor:'pointer',touchAction:'manipulation'});
    bindZoomButton(out,-1);bindZoomButton(inn,1);
    try{if(typeof zoomOutBtn!=='undefined')bindZoomButton(zoomOutBtn,-1);if(typeof zoomInBtn!=='undefined')bindZoomButton(zoomInBtn,1);}catch{}
    refreshZoomV49();
  }

  installZoomControlsV49();
  // Capture wheel before the old v26 listener so one notch equals one zoom step,
  // rather than letting multiple generations of handlers fight each other.
  canvas.addEventListener('wheel',e=>{
    try{if(typeof commandMenuOpen==='function'&&commandMenuOpen())return;}catch{}
    e.preventDefault();e.stopImmediatePropagation();
    const rect=canvas.getBoundingClientRect();
    const sx=(e.clientX-rect.left)*W/(rect.width||W),sy=(e.clientY-rect.top)*H/(rect.height||H);
    setZoomV49(zoomV49()+(e.deltaY<0?CONFIG.WORLD.ZOOM_STEP:-CONFIG.WORLD.ZOOM_STEP),sx,sy);
  },{capture:true,passive:false});
  window.addEventListener('resize',()=>{installZoomControlsV49();clampCameraV49();},{passive:true});
  window.addEventListener('orientationchange',()=>setTimeout(()=>{installZoomControlsV49();clampCameraV49();},110),{passive:true});

  // ---------------------------------------------------------------------------
  // CAPTURED RESOURCE CACHES
  // v47 kept a grey "SECURED" crate in the world. Captured caches now disappear
  // completely once their reward has been granted.
  // ---------------------------------------------------------------------------
  function removeCapturedCaches(){
    if(!Array.isArray(state?.v47ResourceCaches))return;
    if(state.v47ResourceCaches.some(c=>c?.captured))state.v47ResourceCaches=state.v47ResourceCaches.filter(c=>!c?.captured);
  }
  const updateBeforeV49=update;
  update=function(dt){const r=updateBeforeV49(dt);removeCapturedCaches();return r;};
  removeCapturedCaches();

  // ---------------------------------------------------------------------------
  // RAPID MOVE ORDERS
  // The original pointer code marks ANY pointer movement over 8 CSS pixels as a
  // drag. Mouse users therefore lose fast direction-change clicks if the mouse
  // moves slightly between down/up, even though mouse dragging does not pan the
  // map. Only touch should use that drag suppression.
  // ---------------------------------------------------------------------------
  canvas.addEventListener('pointerup',e=>{
    if(e.pointerType!=='mouse')return;
    try{if(pointer&&pointer.id===e.pointerId)pointer.drag=false;}catch{}
  },{capture:true});

  // Make a new valid order replace the previous path atomically. If a destination
  // lands just inside a blocker edge, snap to the nearest open point instead of
  // intermittently discarding the command.
  const setUnitDestinationBeforeV49=setUnitDestination;
  function unitRadiusV49(u){try{return Math.max(4,Number(uRadius(u))||18);}catch{return 18;}}
  function nearestOpenDestination(x,y,r){
    if(!navPointBlocked(x,y,r))return{x,y};
    const rings=[18,30,44,60,80,105];
    for(const d of rings)for(let i=0;i<24;i++){
      const a=i/24*Math.PI*2,nx=x+Math.cos(a)*d,ny=y+Math.sin(a)*d;
      if(nx<r+5||ny<r+5||nx>WORLD_W-r-5||ny>WORLD_H-r-5)continue;
      if(!navPointBlocked(nx,ny,r))return{x:nx,y:ny};
    }
    return null;
  }
  setUnitDestination=function(u,x,y,opt={}){
    if(!u||!Number.isFinite(x)||!Number.isFinite(y))return false;
    let air=false;try{air=typeof isFlyingUnit==='function'&&isFlyingUnit(u);}catch{air=u.type==='airunit';}
    if(air)return setUnitDestinationBeforeV49(u,x,y,opt);
    const r=unitRadiusV49(u),dest=nearestOpenDestination(x,y,r);
    if(!dest){if(els?.message)els.message.textContent='That destination is physically blocked.';return false;}
    // Save old route so a genuinely impossible new order does not make the unit
    // freeze. Successful orders replace it immediately.
    const oldPath=Array.isArray(u.path)?u.path:[],oldTarget=u.moveTarget;
    const ok=setUnitDestinationBeforeV49(u,dest.x,dest.y,opt);
    if(!ok){u.path=oldPath;u.moveTarget=oldTarget;return false;}
    return true;
  };

  // Legacy handleTap checks navPointBlocked before it reaches setUnitDestination.
  // Permit the final destination through this wrapper when a selected movable
  // unit is receiving an ordinary move command; setUnitDestination performs the
  // authoritative snap/path validation above.
  const handleTapBeforeV49=handleTap;
  handleTap=function(x,y){
    const selected=state?.selectedUnit;
    const clicked=typeof unitAt==='function'?unitAt(x,y):null;
    const tower=typeof towerAt==='function'?towerAt(x,y):null;
    const special=state?.attachMode||state?.platoonAttachMode||state?.routeEditing||(typeof wallModeActive==='function'&&wallModeActive())||state?.v47MedicAttachMode||state?.v47ApcAttachMode;
    if(selected&&!clicked&&!tower&&!special&&!selected.garrisonedIn&&!selected.transportedIn){
      if(selected.attachedTo){if(els?.message)els.message.textContent='Detach this squad before giving it an independent move order.';return;}
      if(selected.type==='truck'&&!state.routeEditing){selected.routeLoop=false;selected.routeActive=false;}
      if(setUnitDestination(selected,x,y)){if(els?.message)els.message.textContent='Move order updated.';}
      return;
    }
    return handleTapBeforeV49(x,y);
  };

  refreshZoomV49();
  window.__apdAudit={...(window.__apdAudit||{}),version:49,zoom:'single-authoritative-camera-zoom',capturedCaches:'removed',moveOrders:'mouse-click-loss-fixed+atomic-reroute'};
})();
