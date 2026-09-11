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

// Replace the older zoom setter with one that always clamps, keeps the chosen
// screen point anchored, refreshes the label immediately and updates contextual UI.
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
}
if(typeof zoomOutBtn!=='undefined')bindV31ZoomButton(zoomOutBtn,-1);
if(typeof zoomInBtn!=='undefined')bindV31ZoomButton(zoomInBtn,1);
updateZoomLabel();

// -----------------------------------------------------------------------------
// FULL-VIEWPORT MAP INTEGRATION
// -----------------------------------------------------------------------------
// CSS makes the 16:10 canvas use cover behavior. The canvas can therefore extend
// slightly beyond an edge of unusually wide/tall screens. Existing pointer math
// uses getBoundingClientRect(), so cropped edges remain coordinate-correct.
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

// Keep CENTER BASE correct with the full-screen/cropped presentation at any zoom.
els.center.onclick=()=>{
 const z=v31ZoomValue();
 state.camera.x=BASE_X-W/(2*z);
 state.camera.y=BASE_Y-H/(2*z);
 clampCamera();
 if(typeof updateCancelButtonPosition==='function')updateCancelButtonPosition();
};

// Refresh guide wording so it matches the current presentation.
if(typeof guideBoxByTitle==='function'){
 const camera=guideBoxByTitle('Camera');
 if(camera)camera.querySelector('p').textContent='The battlefield fills the entire device screen. Use ZOOM IN / ZOOM OUT in ☰ MENU or the mouse wheel on desktop. Zoom ranges from 42% strategic overview to 135% close view; CENTER BASE keeps the current zoom.';
 const mobile=guideBoxByTitle('Mobile / Landscape');
 if(mobile)mobile.querySelector('p').textContent='Landscape is recommended on phones. The map fills the full screen and every UI element floats above it. Drag to pan, tap to select/order, and open ☰ MENU for build, upgrade, route and zoom controls.';
}
