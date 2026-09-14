// Transitional classic-script host for Step 7 visual runtime migration.
// Input listeners and the outer requestAnimationFrame loop remain legacy until
// Step 8, but their mutable camera/render/fog seams delegate to clean modules.
(function installRenderingFogCameraLegacyHost(){
  if(window.__apdRenderingFogCameraLegacyHost)return;

  const startButton=document.getElementById('startGameBtn');
  let ready=false;
  const blockStart=e=>{
    if(ready)return;
    e.preventDefault();e.stopImmediatePropagation();
    try{if(els?.message)els.message.textContent='Loading migrated visual runtime…';}catch{}
  };
  startButton?.addEventListener('click',blockStart,true);
  function releaseStart(){ready=true;startButton?.removeEventListener('click',blockStart,true);}
  function message(text){try{if(els?.message)els.message.textContent=String(text);}catch{}}

  const finalVisuals={
    drawBackdrop:typeof drawBackdrop==='function'?drawBackdrop:null,
    drawBase:typeof drawBase==='function'?drawBase:null,
    drawStructure:typeof drawStructure==='function'?drawStructure:null,
    drawUnit:typeof drawUnit==='function'?drawUnit:null,
    drawEnemy:typeof drawEnemy==='function'?drawEnemy:null,
  };
  const firingSquadImage=typeof FIRING_SQUAD_SHEET!=='undefined'?FIRING_SQUAD_SHEET:null;

  function refreshZoomUi(z){
    const zoom=Number(z)||1,min=Number(CONFIG?.WORLD?.MIN_ZOOM)||.18,max=Number(CONFIG?.WORLD?.MAX_ZOOM)||1.35;
    for(const [id,kind] of [['mapZoomLabel','label'],['mapZoomOutBtn','out'],['mapZoomInBtn','in']]){
      const el=document.getElementById(id);if(!el)continue;
      if(kind==='label')el.textContent=`${Math.round(zoom*100)}%`;
      else el.disabled=kind==='out'?zoom<=min+.0001:zoom>=max-.0001;
    }
    try{
      if(typeof zoomLabel!=='undefined'&&zoomLabel)zoomLabel.textContent=`${Math.round(zoom*100)}%`;
      if(typeof zoomOutBtn!=='undefined'&&zoomOutBtn)zoomOutBtn.disabled=zoom<=min+.0001;
      if(typeof zoomInBtn!=='undefined'&&zoomInBtn)zoomInBtn.disabled=zoom>=max-.0001;
    }catch{}
  }
  function updateCancel(){try{if(typeof updateCancelButtonPosition==='function')updateCancelButtonPosition();}catch{}}
  function bindZoomButton(button,direction,owners){
    if(!button)return;
    button.type='button';button.disabled=false;
    button.onclick=e=>{e?.preventDefault?.();e?.stopPropagation?.();return owners.setZoom(owners.zoomValue()+direction*(Number(CONFIG?.WORLD?.ZOOM_STEP)||.10),W/2,H/2);};
  }

  function installOwners(owners){
    if(!owners||typeof owners!=='object')throw new TypeError('Visual migration owners are required');
    for(const key of ['draw','updateCamera','clampCamera','setZoom','zoomValue','worldFromEvent','refreshFog','pointVisible'])if(typeof owners[key]!=='function')throw new TypeError(`${key} owner must be a function`);

    const mapOut=document.getElementById('mapZoomOutBtn'),mapIn=document.getElementById('mapZoomInBtn');
    const oldOut=typeof zoomOutBtn!=='undefined'?zoomOutBtn:null,oldIn=typeof zoomInBtn!=='undefined'?zoomInBtn:null;
    const previous={
      draw,updateCamera,clampCamera,worldFromEvent,
      setZoom:typeof setZoom==='function'?setZoom:null,
      zoomValue:typeof zoomValue==='function'?zoomValue:null,
      v31ZoomValue:typeof v31ZoomValue==='function'?v31ZoomValue:null,
      updateZoomLabel:typeof updateZoomLabel==='function'?updateZoomLabel:null,
      refreshFogSourcesV32:typeof refreshFogSourcesV32==='function'?refreshFogSourcesV32:null,
      pointVisibleV32:typeof pointVisibleV32==='function'?pointVisibleV32:null,
      mapOutClick:mapOut?.onclick||null,mapInClick:mapIn?.onclick||null,
      oldOutClick:oldOut?.onclick||null,oldInClick:oldIn?.onclick||null,
    };
    function restore(){
      draw=previous.draw;updateCamera=previous.updateCamera;clampCamera=previous.clampCamera;worldFromEvent=previous.worldFromEvent;
      if(previous.setZoom)setZoom=previous.setZoom;
      if(previous.zoomValue)zoomValue=previous.zoomValue;
      if(previous.v31ZoomValue)v31ZoomValue=previous.v31ZoomValue;
      if(previous.updateZoomLabel)updateZoomLabel=previous.updateZoomLabel;
      if(previous.refreshFogSourcesV32)refreshFogSourcesV32=previous.refreshFogSourcesV32;
      if(previous.pointVisibleV32)pointVisibleV32=previous.pointVisibleV32;
      if(mapOut)mapOut.onclick=previous.mapOutClick;if(mapIn)mapIn.onclick=previous.mapInClick;
      if(oldOut)oldOut.onclick=previous.oldOutClick;if(oldIn)oldIn.onclick=previous.oldInClick;
    }
    try{
      draw=function(){return owners.draw();};
      updateCamera=function(dt){return owners.updateCamera(dt);};
      clampCamera=function(){return owners.clampCamera();};
      worldFromEvent=function(e){return owners.worldFromEvent(e);};
      setZoom=function(next,sx,sy){return owners.setZoom(next,sx,sy);};
      zoomValue=function(){return owners.zoomValue();};
      v31ZoomValue=function(){return owners.zoomValue();};
      updateZoomLabel=function(){return refreshZoomUi(owners.zoomValue());};
      refreshFogSourcesV32=function(){return owners.refreshFog();};
      pointVisibleV32=function(x,y){return owners.pointVisible(x,y);};
      bindZoomButton(mapOut,-1,owners);bindZoomButton(mapIn,1,owners);bindZoomButton(oldOut,-1,owners);bindZoomButton(oldIn,1,owners);
      window.__apdFogOwner='js/fog/fog.js';
    }catch(error){restore();throw error;}
    return restore;
  }

  const host={
    baseX:typeof BASE_X==='number'?BASE_X:0,
    baseY:typeof BASE_Y==='number'?BASE_Y:0,
    baseRadius:typeof BASE_RADIUS==='number'?BASE_RADIUS:0,
    viewportWidth:typeof W==='number'?W:1280,
    viewportHeight:typeof H==='number'?H:800,
    canvas:typeof canvas!=='undefined'?canvas:null,
    ctx:typeof ctx!=='undefined'?ctx:null,
    firingSquadImage,
    getState:()=>state,
    getKeys:()=>typeof keys!=='undefined'?keys:{},
    now:()=>performance.now(),
    createSurface(width,height){const c=document.createElement('canvas');c.width=width;c.height=height;return c;},
    drawBackdrop:finalVisuals.drawBackdrop,
    drawBase:finalVisuals.drawBase,
    drawStructure:finalVisuals.drawStructure,
    drawUnit:finalVisuals.drawUnit,
    drawEnemy:finalVisuals.drawEnemy,
    installOwners,
    refreshZoomUi,
    updateCancelButtonPosition:updateCancel,
    markReady(audit){
      releaseStart();window.__apdVisualMigration=audit||{id:'rendering-fog-camera-step7',active:true,renderingOwner:'js/rendering/renderer.js'};
    },
    markFailed(error){
      releaseStart();window.__apdVisualMigration={id:'rendering-fog-camera-step7',active:false,renderingOwner:'legacy-fallback',error:String(error?.stack||error)};
      console.error('Clean visual runtime failed to install; legacy rendering/fog/camera retained.',error);
      message('Visual migration failed to load; using legacy rendering fallback.');
    },
  };

  window.__apdRenderingFogCameraLegacyHost=host;
  window.__apdVisualMigration={id:'rendering-fog-camera-step7',active:false,renderingOwner:'loading'};
})();
