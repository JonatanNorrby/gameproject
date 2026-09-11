// v11 RTS Fire Squad patch.
// Loaded after the existing game scripts so it can replace rover behavior
// without duplicating the rest of the tower-defense engine.

// Remove the rover from play and from the upgrade pool.
updateVehicle=function(){};
drawVehicle=function(){};
for(let i=UPGRADES.length-1;i>=0;i--){
  if((UPGRADES[i].tag||'').includes('ROVER')||(UPGRADES[i].name||'').includes('Rover'))UPGRADES.splice(i,1);
}
UPGRADES.push(
 {name:'Combat Conditioning',rarity:'common',desc:'Fire Squads move 20% faster.',tag:'FIRE SQUADS',apply:s=>s.mods.squadMove*=1.2},
 {name:'Field Armor',rarity:'rare',desc:'All Fire Squads gain 60% more maximum HP.',tag:'FIRE SQUADS',apply:s=>{s.mods.soldierHp*=1.6;for(const t of s.towers)if(t.type==='soldier'){const ratio=t.hp/t.maxHp;t.maxHp*=1.6;t.hp=t.maxHp*ratio}}},
 {name:'Rapid Redeployment',rarity:'rare',desc:'Fire Squads move 50% faster.',tag:'FIRE SQUADS',apply:s=>s.mods.squadMove*=1.5}
);
TOWERS.soldier.label='Fire Squad';

const cancelSelectionBtn=document.getElementById('cancelSelectionBtn');

function ensureRtsState(){
  state.selectedSquad=null;
  state.mods.squadMove=1;
  state.mods.soldierHp=state.mods.soldierHp||1;
  for(const t of state.towers){
    if(t.type==='soldier'){
      t.moveTarget=null;
      t.moveSpeed=CONFIG.SOLDIER.MOVE_SPEED||155;
    }
  }
}
ensureRtsState();

// Keep RTS fields present after every restart.
const baseReset=reset;
reset=function(){baseReset();ensureRtsState();};
els.restart.onclick=reset;

// Build buttons leave RTS selection mode.
document.querySelectorAll('.towerBtn').forEach(b=>{
  const type=b.dataset.type;
  b.onclick=()=>{
    state.selectedSquad=null;
    selected=type;
    els.message.textContent=`Build mode: ${TOWERS[selected].label}.`;
    updateHud();
  };
});

function refreshSelectionUi(){
  if(cancelSelectionBtn)cancelSelectionBtn.classList.toggle('active',!!state.selectedSquad);
  document.querySelectorAll('.towerBtn').forEach(b=>b.classList.toggle('selected',b.dataset.type===selected&&!state.selectedSquad));
}
const baseUpdateHud=updateHud;
updateHud=function(){baseUpdateHud();refreshSelectionUi();};

if(cancelSelectionBtn){
  cancelSelectionBtn.onclick=()=>{
    state.selectedSquad=null;
    els.message.textContent='Fire Squad selection cancelled.';
    updateHud();
  };
}

function squadAtWorld(x,y){
  let best=null,bestD=34;
  for(const t of state.towers){
    if(t.type!=='soldier')continue;
    const d=Math.hypot(t.x-x,t.y-y);
    if(d<bestD){best=t;bestD=d;}
  }
  return best;
}
function rtsPointBlocked(x,y){
  if(x<25||y<25||x>WORLD_W-25||y>WORLD_H-25)return true;
  if(Math.hypot(x-BASE_X,y-BASE_Y)<BASE_RADIUS+28)return true;
  return pointBlockedByTerrain(x,y,18);
}

// Capture phase runs before the original anonymous build-placement handler.
// We stop the event only when the click is being used for RTS selection/movement.
canvas.addEventListener('click',e=>{
  if(state.gameOver||state.choosing)return;
  const r=canvas.getBoundingClientRect();
  const sx=(e.clientX-r.left)*W/r.width,sy=(e.clientY-r.top)*H/r.height;
  const x=sx+state.camera.x,y=sy+state.camera.y;
  const squad=squadAtWorld(x,y);

  if(squad){
    e.stopImmediatePropagation();
    state.selectedSquad=squad;
    els.message.textContent='Fire Squad selected. Click the map to move it, or press ✕ to cancel.';
    updateHud();
    return;
  }

  if(state.selectedSquad){
    e.stopImmediatePropagation();
    if(rtsPointBlocked(x,y)){
      els.message.textContent='That destination is blocked by terrain or the base.';
      return;
    }
    releaseSafeSpotForTower(state.selectedSquad);
    state.selectedSquad.moveTarget={x,y};
    state.selectedSquad.moveSpeed=CONFIG.SOLDIER.MOVE_SPEED||155;
    els.message.textContent='Move order issued.';
  }
},true);

// Newly placed squads need movement fields. The original placement handler creates them,
// so normalize them continuously at negligible cost.
function normalizeSquads(){
  for(const t of state.towers){
    if(t.type!=='soldier')continue;
    if(t.moveTarget===undefined)t.moveTarget=null;
    if(!t.moveSpeed)t.moveSpeed=CONFIG.SOLDIER.MOVE_SPEED||155;
  }
}

function moveOneSquad(t,dt){
  if(!t.moveTarget)return;
  const dx=t.moveTarget.x-t.x,dy=t.moveTarget.y-t.y,d=Math.hypot(dx,dy);
  if(d<5){
    t.x=t.moveTarget.x;t.y=t.moveTarget.y;t.moveTarget=null;
    const pad=findSafeSpotAt(t.x,t.y);
    if(pad){t.x=pad.x;t.y=pad.y;t.protected=true;t.safeSpotId=pad.id;pad.occupied=true;}
    return;
  }
  const speed=t.moveSpeed*(state.mods.squadMove||1),step=Math.min(d,speed*dt),a=Math.atan2(dy,dx);
  let nx=t.x+Math.cos(a)*step,ny=t.y+Math.sin(a)*step;
  if(pointBlockedByTerrain(nx,ny,18)){
    let found=false;
    for(const off of [.55,-.55,1,-1]){
      const aa=a+off,tx=t.x+Math.cos(aa)*step,ty=t.y+Math.sin(aa)*step;
      if(!pointBlockedByTerrain(tx,ty,18)){nx=tx;ny=ty;found=true;break;}
    }
    if(!found)return;
  }
  t.x=Math.max(25,Math.min(WORLD_W-25,nx));
  t.y=Math.max(25,Math.min(WORLD_H-25,ny));
}

// Move squads before the normal combat update so firing uses their current position.
const baseUpdate=update;
update=function(dt){
  normalizeSquads();
  if(!state.gameOver&&!state.choosing){for(const t of state.towers)if(t.type==='soldier')moveOneSquad(t,dt);}
  baseUpdate(dt);
};

// Draw movement-order line and selection ring around Fire Squads.
const baseDrawTower=drawTower;
drawTower=function(t){
  if(t.type==='soldier'&&t.moveTarget){
    ctx.save();ctx.setLineDash([8,6]);ctx.strokeStyle='rgba(96,225,255,.78)';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(t.x,t.y);ctx.lineTo(t.moveTarget.x,t.moveTarget.y);ctx.stroke();ctx.restore();
  }
  baseDrawTower(t);
  if(t.type==='soldier'&&state.selectedSquad===t){
    ctx.save();ctx.strokeStyle='#ffe47b';ctx.lineWidth=3;ctx.beginPath();ctx.arc(t.x,t.y,31,0,Math.PI*2);ctx.stroke();ctx.restore();
  }
};

function drawOffscreenSquadIndicators(){
  for(const t of state.towers){
    if(t.type!=='soldier')continue;
    const sx=t.x-state.camera.x,sy=t.y-state.camera.y;
    if(sx>=0&&sx<=W&&sy>=0&&sy<=H)continue;
    const cx=W/2,cy=H/2,dx=sx-cx,dy=sy-cy,margin=25;
    const scale=Math.min((W/2-margin)/Math.max(1,Math.abs(dx)),(H/2-margin)/Math.max(1,Math.abs(dy)));
    const ix=cx+dx*scale,iy=cy+dy*scale,a=Math.atan2(dy,dx);
    ctx.save();ctx.translate(ix,iy);ctx.rotate(a);
    ctx.fillStyle=state.selectedSquad===t?'#ffe47b':'#7fe6ff';
    ctx.beginPath();ctx.moveTo(11,0);ctx.lineTo(-7,-7);ctx.lineTo(-7,7);ctx.closePath();ctx.fill();
    ctx.restore();
    ctx.fillStyle='#08131d';ctx.beginPath();ctx.arc(ix,iy,3.5,0,Math.PI*2);ctx.fill();
  }
}

const baseDraw=draw;
draw=function(){baseDraw();drawOffscreenSquadIndicators();};

// The old help text mentions WASD/rover; overwrite it each load.
const hint=document.getElementById('hint');
if(hint)hint.textContent='Arrow keys move the camera. Click a Fire Squad to select it, then click the map to move it. Press ✕ to cancel the current squad selection.';
els.message.textContent='Rover removed. Fire Squads are now mobile RTS units.';
updateHud();
