// Alien Planet Defense v20 - mobile interaction polish
const mobileMenuBtn=document.getElementById('mobileMenuBtn');

function isCoarsePointer(){return window.matchMedia?.('(pointer:coarse)').matches||navigator.maxTouchPoints>0;}

// Phones/tablets do not have Escape, so expose the menu directly in the playfield.
mobileMenuBtn.onclick=e=>{e.preventDefault();e.stopPropagation();openMainMenu();};

const v19OpenMainMenuV20=openMainMenu;
openMainMenu=function(){
 v19OpenMainMenuV20();
 startGameBtn.textContent=gameStarted?'RESUME':'START GAME';
 mobileMenuBtn.setAttribute('aria-expanded','true');
};
const v19CloseMainMenuV20=closeMainMenu;
closeMainMenu=function(){
 v19CloseMainMenuV20();
 startGameBtn.textContent=gameStarted?'RESUME':'START GAME';
 mobileMenuBtn.setAttribute('aria-expanded','false');
};

// The existing START GAME handler closes via the overridden closeMainMenu().
// Keep the mobile button hidden behind the main menu but ready as soon as play starts.
mobileMenuBtn.setAttribute('aria-expanded','true');

// Avoid a second finger replacing the active map gesture. This matters on phones
// where an accidental palm/second finger used to leave panning or wall painting stuck.
canvas.addEventListener('pointerdown',e=>{
 if(pointer&&pointer.id!==e.pointerId){e.preventDefault();e.stopImmediatePropagation();}
},{capture:true});
canvas.addEventListener('pointercancel',e=>{
 if(pointer&&pointer.id===e.pointerId)pointer=null;
 if(typeof wallPainting!=='undefined')wallPainting=false;
},{capture:true});

// Stop long-press callouts/text selection over the actual game controls.
canvas.addEventListener('contextmenu',e=>e.preventDefault());
document.querySelectorAll('.buildBtn,.menuTab,#unitActions button,#utilityBar button,#pauseBtn,#mobileMenuBtn').forEach(el=>{
 el.addEventListener('contextmenu',e=>e.preventDefault());
});

// Keep the selected-unit X inside the visible playfield after orientation/layout changes.
const v18UpdateCancelButtonPositionV20=updateCancelButtonPosition;
updateCancelButtonPosition=function(){
 v18UpdateCancelButtonPositionV20();
 if(!els.cancelUnit.classList.contains('visible'))return;
 const shell=document.getElementById('canvasShell').getBoundingClientRect();
 const left=parseFloat(els.cancelUnit.style.left)||0,top=parseFloat(els.cancelUnit.style.top)||0;
 const pad=isCoarsePointer()?28:22;
 els.cancelUnit.style.left=`${Math.max(pad,Math.min(shell.width-pad,left))}px`;
 els.cancelUnit.style.top=`${Math.max(pad,Math.min(shell.height-pad,top))}px`;
};

// Orientation changes alter only CSS dimensions; pointer conversion already uses
// the live canvas rectangle. Re-clamp the camera and cancel half-finished gestures.
function mobileLayoutChanged(){
 if(typeof clampCamera==='function')clampCamera();
 pointer=null;
 if(typeof wallPainting!=='undefined')wallPainting=false;
 state.last=performance.now();
}
window.addEventListener('orientationchange',()=>setTimeout(mobileLayoutChanged,120));
window.addEventListener('resize',()=>{clearTimeout(window.__apdResizeTimer);window.__apdResizeTimer=setTimeout(mobileLayoutChanged,80);},{passive:true});

// Make horizontal control strips keyboard/touch-scroll friendly without causing
// the page itself to bounce sideways on iOS.
for(const el of document.querySelectorAll('#hud,#menuTabs,.buildMenu,#utilityBar,#unitActions')){
 el.addEventListener('wheel',e=>{if(Math.abs(e.deltaY)>Math.abs(e.deltaX)&&el.scrollWidth>el.clientWidth){el.scrollLeft+=e.deltaY;e.preventDefault();}},{passive:false});
}

// Re-open through the v20 wrapper so the initial button/menu state is consistent.
openMainMenu();
