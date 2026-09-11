// Alien Planet Defense v31
// Fix zoom controls and make the battlefield a true full-screen layer.
document.title='Alien Planet Defense v31';

// -----------------------------------------------------------------------------
// RELIABLE ZOOM CONTROLS
// -----------------------------------------------------------------------------
function v31ZoomValue(){
 const min=Number(CONFIG.WORLD.MIN_ZOOM)||0.42,max=Number(CONFIG.WORLD.MAX_ZOOM)||1.35;
 return Math.max(min,Math.min(max,Number(state.camera.zoom)||1));
}

setZoom=function(next,sx=W/2,sy=H/2){
 const min=Number(CONFIG.WORLD.MIN_ZOOM)||0.42,max=Number(CONFIG.WORLD.MAX_ZOOM)||1.35;
 const old=v31ZoomValue(),z=Math.max(min,Math.min(max,Number(next)||old));
 const wx=state.camera.x+sx/old,wy=state.camera.y+sy/old;
 state.camera.zoom=z;
 state.camera.x=wx-sx/z;
 state.camera.y=wy-sy/z;
 clampCamera();
 updateZoomLabel();
 if(typeof updateCancelButtonPosition==='function')updateCancelButtonPosition();
 return z;
};

updateZoomLabel=function(){
 const z=v31ZoomValue(),min=Number(CONFIG.WORLD.MIN_ZOOM)||0.42,max=Number(CONFIG.WORLD.MAX_ZOOM)||1.35;
 if(typeof zoomLabel!=='undefined'&&zoomLabel)zoomLabel.textContent=`${Math.round(z*100)}%`;
 if(typeof zoomOutBtn!=='undefined'&&zoomOutBtn)zoomOutBtn.disabled=z<=min+0.0001;
 if(typeof zoomInBtn!=='undefined'&&zoomInBtn)zoomInBtn.disabled=z>=max-0.0001;
 const mapLabel=document.getElementById('mapZoomLabel');
 const mapOut=document.getElementById('mapZoomOutBtn');
 const mapIn=document.getElementById('mapZoomInBtn');
 if(mapLabel)mapLabel.textContent=`${Math.round(z*100)}%`;
 if(mapOut)mapOut.disabled=z<=min+0.0001;
 if(mapIn)mapIn.disabled=z>=max-0.0001;
};

function bindV31ZoomButton(btn,direction){
 if(!btn)return;
 btn.type='button';
 btn.disabled=false;
 btn.onclick=e=>{
  e.preventDefault();e.stopPropagation();
  const step=Number(CONFIG.WORLD.ZOOM_STEP)||0.10;
  setZoom(v31ZoomValue()+direction*step,W/2,H/2);
 };
 btn.addEventListener('pointerdown',e=>e.stopPropagation());
 btn.addEventListener('pointerup',e=>e.stopPropagation());
}
if(typeof zoomOutBtn!=='undefined')bindV31ZoomButton(zoomOutBtn,-1);
if(typeof zoomInBtn!=='undefined')bindV31ZoomButton(zoomInBtn,1);

// Always-visible battlefield zoom controls. These stay outside the Command Menu
// so zoom is available immediately on touch devices as well as desktop.
const mapZoomControls=document.createElement('div');
mapZoomControls.id='mapZoomControls';
mapZoomControls.setAttribute('aria-label','Map zoom controls');
mapZoomControls.innerHTML='<button id="mapZoomOutBtn" type="button" aria-label="Zoom out">−</button><span id="mapZoomLabel">100%</span><button id="mapZoomInBtn" type="button" aria-label="Zoom in">+</button>';
document.getElementById('canvasShell')?.appendChild(mapZoomControls);
const mapZoomOutBtn=document.getElementById('mapZoomOutBtn');
const mapZoomInBtn=document.getElementById('mapZoomInBtn');
bindV31ZoomButton(mapZoomOutBtn,-1);
bindV31ZoomButton(mapZoomInBtn,1);
updateZoomLabel();

// -----------------------------------------------------------------------------
// FULL-VIEWPORT MAP INTEGRATION
// -----------------------------------------------------------------------------
function syncV31Viewport(){
 document.documentElement.style.setProperty('--v31-screen-w',`${window.innerWidth}px`);
 document.documentElement.style.setProperty('--v31-screen-h',`${window.innerHeight}px`);
 clampCamera();
 updateZoomLabel();
 if(typeof updateCancelButtonPosition==='function')updateCancelButtonPosition();
}
window.addEventListener('resize',syncV31Viewport,{passive:true});
window.addEventListener('orientationchange',()=>setTimeout(syncV31Viewport,60),{passive:true});
if(window.visualViewport)window.visualViewport.addEventListener('resize',syncV31Viewport,{passive:true});
syncV31Viewport();

els.center.onclick=()=>{
 const z=v31ZoomValue();
 state.camera.x=BASE_X-W/(2*z);
 state.camera.y=BASE_Y-H/(2*z);
 clampCamera();
 if(typeof updateCancelButtonPosition==='function')updateCancelButtonPosition();
};

if(typeof guideBoxByTitle==='function'){
 const camera=guideBoxByTitle('Camera');
 if(camera)camera.querySelector('p').textContent='The battlefield fills the entire device screen. Use the always-visible − / + zoom buttons on the map, the Command Menu controls, or the mouse wheel on desktop. Zoom ranges from 42% strategic overview to 135% close view.';
 const mobile=guideBoxByTitle('Mobile / Landscape');
 if(mobile)mobile.querySelector('p').textContent='Landscape is recommended on phones. The map fills the full screen and every UI element floats above it. Drag to pan, tap to select/order, use − / + to zoom, and open ☰ MENU for build, upgrade and route controls.';
}
