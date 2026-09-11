// Alien Planet Defense v27 - stability, guide and mobile landscape polish.
document.title='Alien Planet Defense v27';

// -----------------------------------------------------------------------------
// START / MENU STATE: later patch resets must never let the simulation advance
// behind the title screen before the player actually presses Start/Resume.
// -----------------------------------------------------------------------------
const v26ResetV27=reset;
reset=function(){
 v26ResetV27();
 if(typeof mainMenu!=='undefined'&&!mainMenu.classList.contains('hidden'))state.paused=true;
 state.last=performance.now();
 pointer=null;
 if(typeof wallPainting!=='undefined')wallPainting=false;
};
els.restart.onclick=reset;
if(typeof mainMenu!=='undefined'&&!mainMenu.classList.contains('hidden'))state.paused=true;
state.last=performance.now();

// Opening a UI layer also cancels half-finished touch gestures without deleting a
// drafted wall path. This prevents stuck panning/wall painting after menu taps.
const v26SetCommandMenuV27=setCommandMenu;
setCommandMenu=function(open){
 if(open){pointer=null;if(typeof wallPainting!=='undefined')wallPainting=false;}
 v26SetCommandMenuV27(open);
};
const v26OpenMainMenuV27=openMainMenu;
openMainMenu=function(){pointer=null;if(typeof wallPainting!=='undefined')wallPainting=false;v26OpenMainMenuV27();state.paused=true;state.last=performance.now();};

// v26 adds these buttons after v21/v23 registered their generic build listeners.
// Explicitly clear Tower selection so the next battlefield tap actually deploys
// the chosen vehicle instead of merely dismissing an old Tower selection.
for(const type of ['tank','mobileartillery','repairvehicle']){
 const btn=document.querySelector(`.buildBtn[data-type="${type}"]`);
 if(btn)btn.addEventListener('click',()=>{state.selectedTower=null;if(typeof updateTowerPanel==='function')updateTowerPanel();});
}

// -----------------------------------------------------------------------------
// ZOOM-AWARE SELECTION. v15/v21 used CSS scaling but did not account for the
// v26 world zoom, making units/towers unnecessarily hard to select when zoomed out.
// -----------------------------------------------------------------------------
unitAt=function(x,y){
 const z=typeof zoomValue==='function'?zoomValue():1;
 const cssScale=W/Math.max(1,canvas.clientWidth||W);
 const base=Math.max(38,26*cssScale)/z;
 let best=null,bd=Infinity;
 for(const u of state.units){
  if(u.garrisonedIn)continue;
  const hit=Math.max(base,uRadius(u)+12/z),d=Math.hypot(x-u.x,y-u.y);
  if(d<hit&&d<bd){best=u;bd=d;}
 }
 return best;
};
towerAt=function(x,y){
 const z=typeof zoomValue==='function'?zoomValue():1;
 const cssScale=W/Math.max(1,canvas.clientWidth||W);
 const base=Math.max(34,26*cssScale)/z;
 let best=null,bd=Infinity;
 for(const s of state.structures){
  if(!isUpgradeableTower(s))continue;
  const hit=Math.max(base,structureRadius(s)+11/z),d=Math.hypot(x-s.x,y-s.y);
  if(d<hit&&d<bd){best=s;bd=d;}
 }
 return best;
};

// Keep the contextual unit X inside the actual phone playfield at every zoom and
// orientation. v26 replaced the earlier mobile clamp, so restore it here.
updateCancelButtonPosition=function(){
 const u=state.selectedUnit;if(!u||u.garrisonedIn){els.cancelUnit.classList.remove('visible');return;}
 const z=typeof zoomValue==='function'?zoomValue():1,sx=(u.x-state.camera.x)*z,sy=(u.y-state.camera.y)*z;
 if(sx<0||sy<0||sx>W||sy>H){els.cancelUnit.classList.remove('visible');return;}
 const r=canvas.getBoundingClientRect(),shell=document.getElementById('canvasShell').getBoundingClientRect();
 let left=(r.left-shell.left)+sx*r.width/W+26,top=(r.top-shell.top)+sy*r.height/H-30;
 const coarse=window.matchMedia?.('(pointer:coarse)').matches||navigator.maxTouchPoints>0,pad=coarse?30:23;
 left=Math.max(pad,Math.min(shell.width-pad,left));top=Math.max(pad,Math.min(shell.height-pad,top));
 els.cancelUnit.style.left=`${left}px`;els.cancelUnit.style.top=`${top}px`;els.cancelUnit.classList.add('visible');
};

// -----------------------------------------------------------------------------
// GUIDE: replace the incremental historical guide with one concise description
// of the CURRENT game. This avoids stale instructions from old versions.
// -----------------------------------------------------------------------------
const guideGridV27=document.querySelector('#guidePanel .guide-grid');
if(guideGridV27){
 const sections=[
  ['Objective','Defend the central base indefinitely while expanding resource extraction, logistics, mobile forces and layered defenses. Enemies spawn continuously and special threats appear later in the run.'],
  ['Mobile / Landscape','Landscape is the recommended phone orientation. Drag the battlefield to pan, tap units or Towers to select them, and use ☰ MENU for every persistent control. The Command Menu opens as a compact side panel in landscape.'],
  ['Camera','Use the Command Menu zoom controls on touch devices or the mouse wheel on desktop. Zoom can go from 135% down to a 42% strategic overview. CENTER BASE recenters without changing zoom.'],
  ['Pause & Planning','Pause is inside ☰ MENU. While paused you can inspect the battlefield, issue movement orders and queue construction, then resume when your plan is ready.'],
  ['Gold & Metal','Kills and full Crystal export ships provide Gold. Gold buys units and economy/support buildings. Ore delivered to Refineries becomes Metal, which builds Walls/Towers and pays for Tower upgrades.'],
  ['Resource Depots','Crystal and Ore deposits contain finite stock; farther deposits generally hold more. Up to 3 matching Mines can share one deposit. Extra Mines extract faster but drain the same finite stock sooner.'],
  ['Trucks & Routes','Logistics Trucks automatically load nearby Mines. Crystal goes to Landing Pads; Ore goes to Refineries. Record at least 2 route points and the Truck automatically travels to point 1, starts looping and deselects itself. Infantry escorts can attach to Trucks.'],
  ['Landing Pads & Export Ships','Pads warehouse up to 520 Crystal. A ship lands after its cooldown, attracts nearby aliens, loads gradually and exports 220 Crystal when full. The landed ship has HP and takes attacks before the Pad; if destroyed, loaded cargo is lost and the 2-minute cooldown restarts.'],
  ['Walls','Choose Wall, click bend points or drag to paint a path, then press ✓ to review Metal cost/build time. Enemies prefer reasonable routes around Walls, but may break through; Siege Beasts, Climbers, Burrowers and Crushers each counter Walls differently.'],
  ['Towers & Upgrades','Every combat Tower starts at 1/3. Tap a Tower, open ☰ MENU and spend Metal for levels 2/3 and 3/3. Upgrades add meaningful mechanics such as piercing, extra chains, larger salvos, stronger crowd control or additional drones.'],
  ['Tower Roles','Laser/Railgun excel at long-range precision; Flame/Tesla/Cryo control dense groups; Mortar/Missile provide splash; Minigun supplies sustained DPS; Anti-Air specializes against Flyers; Drone Bays provide autonomous local coverage.'],
  ['Infantry & Support','Riflemen, Heavy Gunners, Rocketeers and Flamethrower Troopers provide frontline damage. Medics heal infantry. Engineers repair and accelerate construction. Scouts detect/mark, Snipers provide extreme range, Spotters mark enemies while being ignored, and Mine Layers deploy paid anti-ground mines.'],
  ['Vehicles & Aircraft','Mechs and Tanks are durable line holders. Mobile Artillery provides long-range ground splash with a minimum range. Repair Vehicles rapidly repair mechanical assets. Combat Drones reinforce quickly; only one expensive Combat Ship may be active and it must deploy near a Landing Pad.'],
  ['Bunkers','Bunkers are Gold-funded defensive buildings. Eligible infantry can garrison from nearby, becoming protected and gaining +28% range and +35% damage until ungarrisoned or the Bunker is destroyed.'],
  ['Enemy Intel','Ravagers form the basic melee line. Brutes soak damage; Spitters attack from range; Flyers ignore Walls/terrain. Acid Lobbers corrode structures. Harvester Hunters chase logistics, Saboteurs target economy while cloaked, and late-game Wall specialists force varied defenses.']
 ];
 guideGridV27.innerHTML='';
 for(const [title,text] of sections){const box=document.createElement('div');box.className='guide-box';box.innerHTML=`<b>${title}</b><p>${text}</p>`;guideGridV27.appendChild(box);}
}

// Small current-version hint in the command menu rather than old backlog wording.
const hintV27=document.getElementById('hint');
if(hintV27)hintV27.textContent='Landscape recommended on phones · drag to pan · use zoom for strategic overview · tap units/Towers, then open ☰ MENU for contextual actions.';

// Re-clamp after rotation/viewport changes using the CURRENT zoom-aware camera.
function v27ViewportChanged(){pointer=null;if(typeof wallPainting!=='undefined')wallPainting=false;clampCamera();state.last=performance.now();updateCancelButtonPosition();}
window.addEventListener('orientationchange',()=>setTimeout(v27ViewportChanged,160));
window.addEventListener('resize',()=>{clearTimeout(window.__apdV27Resize);window.__apdV27Resize=setTimeout(v27ViewportChanged,110);},{passive:true});
