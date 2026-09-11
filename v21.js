// Alien Planet Defense v21
// Removes Tower Safe Spots and adds metal-funded 1/3 -> 3/3 tower progression.

const towerActions=document.getElementById('towerActions');
const towerActionName=document.getElementById('towerActionName');
const towerActionLevel=document.getElementById('towerActionLevel');
const towerActionStats=document.getElementById('towerActionStats');
const towerUpgradeName=document.getElementById('towerUpgradeName');
const towerUpgradeDesc=document.getElementById('towerUpgradeDesc');
const towerUpgradeBtn=document.getElementById('towerUpgradeBtn');
const towerUpgradeCloseBtn=document.getElementById('towerUpgradeCloseBtn');

const UPGRADEABLE_TOWERS=new Set(['laser','flame','railgun','tesla']);
state.selectedTower=null;
state.v21Effects=[];

// Safe Spots are retained in CONFIG only for old-script bootstrap compatibility.
// They are no longer buildable, selectable, rendered or used by tower placement.
delete BUILD.safespot;
findSafeSpotAt=function(){return null;};
for(const s of state.structures){if(s.type!=='safespot'){s.protected=false;s.safeSpotId=null;}}
state.structures=state.structures.filter(s=>s.type!=='safespot');

function isUpgradeableTower(s){return !!s&&UPGRADEABLE_TOWERS.has(s.type);}
function towerLevel(s){return Math.max(1,Math.min(3,s.level||1));}
function towerName(s){return s.type==='laser'?'Laser Sniper':s.type==='flame'?'Flamethrower':s.type==='railgun'?'Railgun Tower':'Tesla Tower';}
function towerBaseConfig(s){return s.type==='laser'?CONFIG.LASER:s.type==='flame'?CONFIG.FLAME:s.type==='railgun'?CONFIG.RAILGUN:CONFIG.TESLA;}
function towerStats(s){
 const l=towerLevel(s),c=towerBaseConfig(s);
 if(s.type==='laser')return{
  range:c.RANGE*[1,1.15,1.25][l-1],damage:c.DAMAGE*[1,1.40,1.75][l-1],interval:c.FIRE_INTERVAL*[1,.90,.82][l-1],pierce:[1,1,2][l-1]
 };
 if(s.type==='flame')return{
  range:c.RANGE*[1,1.16,1.28][l-1],interval:c.FIRE_INTERVAL*[1,1,.90][l-1],targets:[1,2,4][l-1],burnDuration:c.BURN_DURATION*[1,1.15,1.35][l-1]
 };
 if(s.type==='railgun')return{
  range:c.RANGE*[1,1.15,1.25][l-1],damage:c.DAMAGE*[1,1.45,1.85][l-1],interval:c.FIRE_INTERVAL*[1,1,.82][l-1],maxTargets:[c.MAX_TARGETS,5,7][l-1],width:c.PIERCE_WIDTH*[1,1.12,1.25][l-1]
 };
 return{
  range:c.RANGE*[1,1.14,1.24][l-1],damage:c.DAMAGE*[1,1.24,1.52][l-1],interval:c.FIRE_INTERVAL*[1,1,.73][l-1],chains:[c.CHAINS,5,7][l-1],chainRange:c.CHAIN_RANGE*[1,1.08,1.16][l-1],chainMult:[c.CHAIN_DAMAGE_MULTIPLIER,.80,.86][l-1]
 };
}

const v20StructureRangeV21=structureRange;
structureRange=function(s){return isUpgradeableTower(s)?towerStats(s).range:v20StructureRangeV21(s);};

function towerStatsText(s){
 const t=towerStats(s);
 if(s.type==='laser')return `${Math.round(t.damage)} dmg · ${Math.round(t.range)} range · ${(1/t.interval).toFixed(2)}/s${t.pierce>1?` · pierce ${t.pierce}`:''}`;
 if(s.type==='flame')return `${Math.round(t.range)} range · ignites ${t.targets} target${t.targets===1?'':'s'} · ${(1/t.interval).toFixed(1)}/s`;
 if(s.type==='railgun')return `${Math.round(t.damage)} dmg · ${Math.round(t.range)} range · pierce ${t.maxTargets}`;
 return `${Math.round(t.damage)} dmg · ${Math.round(t.range)} range · ${t.chains} chains · ${(1/t.interval).toFixed(2)}/s`;
}
function updateTowerPanel(){
 const s=state.selectedTower;
 if(!s||!state.structures.includes(s)||!isUpgradeableTower(s)){
  state.selectedTower=null;towerActions.classList.remove('active');return;
 }
 if(!s.level)s.level=1;
 const l=towerLevel(s);towerActions.classList.add('active');towerActionName.textContent=towerName(s);towerActionLevel.textContent=`${l}/3`;towerActionStats.textContent=towerStatsText(s);
 if(!s.built){towerUpgradeName.textContent='UNDER CONSTRUCTION';towerUpgradeDesc.textContent='Upgrades unlock when construction is complete.';towerUpgradeBtn.textContent='BUILDING…';towerUpgradeBtn.disabled=true;return;}
 if(l>=3){towerUpgradeName.textContent='MAX LEVEL';towerUpgradeDesc.textContent='This tower has reached its final specialization.';towerUpgradeBtn.textContent='MAX 3/3';towerUpgradeBtn.disabled=true;return;}
 const next=CONFIG.TOWER_UPGRADES[s.type][l+1];towerUpgradeName.textContent=next.NAME;towerUpgradeDesc.textContent=next.DESC;towerUpgradeBtn.textContent=`UPGRADE TO ${l+1}/3 · ${next.COST} METAL`;towerUpgradeBtn.disabled=(state.metal||0)<next.COST;
}

towerUpgradeBtn.onclick=()=>{
 const s=state.selectedTower;if(!s||!s.built||!isUpgradeableTower(s))return;const l=towerLevel(s);if(l>=3)return;
 const next=CONFIG.TOWER_UPGRADES[s.type][l+1];if((state.metal||0)<next.COST){els.message.textContent=`Need ${next.COST} metal for ${next.NAME}.`;updateTowerPanel();return;}
 state.metal-=next.COST;s.level=l+1;s.cool=Math.min(s.cool||0,.15);els.message.textContent=`${towerName(s)} upgraded to ${s.level}/3 — ${next.NAME}.`;updateHud();updateTowerPanel();
};
towerUpgradeCloseBtn.onclick=()=>{state.selectedTower=null;updateTowerPanel();};

function towerAt(x,y){
 const scale=W/Math.max(1,canvas.clientWidth||W);let best=null,bd=Math.max(34,26*scale);
 for(const s of state.structures){if(!isUpgradeableTower(s))continue;const d=Math.hypot(x-s.x,y-s.y);const hit=Math.max(bd,structureRadius(s)+10);if(d<hit&&(best===null||d<Math.hypot(x-best.x,y-best.y)))best=s;}
 return best;
}

const v20HandleTapV21=handleTap;
handleTap=function(x,y){
 if(typeof wallModeActive==='function'&&wallModeActive())return v20HandleTapV21(x,y);
 const clickedUnit=unitAt(x,y),clickedTower=towerAt(x,y);
 if(clickedTower){
  state.selectedUnit=null;state.routeEditing=false;state.attachMode=false;state.selectedTower=clickedTower;if(!clickedTower.level)clickedTower.level=1;
  els.message.textContent=`${towerName(clickedTower)} selected — level ${towerLevel(clickedTower)}/3.`;updateHud();updateTowerPanel();return;
 }
 if(clickedUnit){state.selectedTower=null;updateTowerPanel();return v20HandleTapV21(x,y);}
 if(state.selectedTower){state.selectedTower=null;updateTowerPanel();els.message.textContent='Tower selection cleared.';return;}
 return v20HandleTapV21(x,y);
};
document.querySelectorAll('.buildBtn').forEach(b=>b.addEventListener('click',()=>{state.selectedTower=null;updateTowerPanel();}));

// Full tower combat pass so level effects are deterministic and tower-specific.
updateTowers=function(dt){
 for(const s of state.structures){
  if(!s.built||!isUpgradeableTower(s)||s.hp<=0)continue;if(!s.level)s.level=1;s.cool=(s.cool||0)-dt;if(s.cool>0)continue;const st=towerStats(s);
  if(s.type==='laser'){
   const target=findTarget(s.x,s.y,st.range);if(!target)continue;
   if(st.pierce===1){shoot(s.x,s.y,target,'laser',st.damage,CONFIG.LASER.BULLET_SPEED);}else{
    const dx=target.x-s.x,dy=target.y-s.y,d=Math.hypot(dx,dy)||1,ex=s.x+dx/d*st.range,ey=s.y+dy/d*st.range;
    const hits=[...state.enemies].filter(e=>{const along=((e.x-s.x)*dx+(e.y-s.y)*dy)/d;return along>=0&&along<=st.range&&pointSegmentDistance(e.x,e.y,s.x,s.y,ex,ey)<=e.r+9;}).sort((a,b)=>Math.hypot(a.x-s.x,a.y-s.y)-Math.hypot(b.x-s.x,b.y-s.y)).slice(0,st.pierce);
    for(const e of hits)hitEnemy(e,st.damage);state.v21Effects.push({kind:'prism',x1:s.x,y1:s.y,x2:ex,y2:ey,expires:performance.now()+130});
   }
   s.cool=st.interval*state.mods.laserRate;
  }else if(s.type==='flame'){
   const targets=[...state.enemies].map(e=>({e,d:Math.hypot(e.x-s.x,e.y-s.y)})).filter(v=>v.d<=st.range).sort((a,b)=>a.d-b.d).slice(0,st.targets);if(!targets.length)continue;
   for(const {e} of targets){e.burn=Math.max(e.burn,st.burnDuration*state.mods.burnDuration);e.burnTick=Math.min(e.burnTick,.01);}s.cool=st.interval;
  }else if(s.type==='railgun'){
   const target=findTarget(s.x,s.y,st.range);if(!target)continue;const dx=target.x-s.x,dy=target.y-s.y,d=Math.hypot(dx,dy)||1,ex=s.x+dx/d*st.range,ey=s.y+dy/d*st.range;
   const hits=[...state.enemies].filter(e=>{const along=((e.x-s.x)*dx+(e.y-s.y)*dy)/d;return along>=0&&along<=st.range&&linePointDistance(e.x,e.y,s.x,s.y,ex,ey)<=st.width;}).sort((a,b)=>Math.hypot(a.x-s.x,a.y-s.y)-Math.hypot(b.x-s.x,b.y-s.y)).slice(0,st.maxTargets);
   for(const e of hits)hitEnemy(e,st.damage);fxPush({kind:'rail',x1:s.x,y1:s.y,x2:ex,y2:ey,expires:performance.now()+125});s.cool=st.interval;
  }else{
   const first=findTarget(s.x,s.y,st.range);if(!first)continue;const used=new Set(),points=[{x:s.x,y:s.y}];let cur=first,damage=st.damage;
   for(let i=0;i<st.chains&&cur;i++){used.add(cur);points.push({x:cur.x,y:cur.y});hitEnemy(cur,damage);damage*=st.chainMult;cur=nearestEnemyExcept(points.at(-1).x,points.at(-1).y,st.chainRange,used);}fxPush({kind:'tesla',points,expires:performance.now()+150});s.cool=st.interval;
  }
 }
};

// Hide any legacy Safe Spot that somehow exists, and stamp every combat tower with
// a clear 1/3, 2/3 or 3/3 badge directly on the battlefield.
const v20DrawStructureV21=drawStructure;
drawStructure=function(s){
 if(s.type==='safespot')return;v20DrawStructureV21(s);if(!isUpgradeableTower(s))return;
 if(!s.level)s.level=1;ctx.save();ctx.translate(s.x,s.y);if(state.selectedTower===s){ctx.strokeStyle='#ffe77c';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,structureRadius(s)+9,0,Math.PI*2);ctx.stroke();}
 ctx.fillStyle='rgba(5,12,18,.92)';ctx.fillRect(-18,-42,36,15);ctx.strokeStyle=towerLevel(s)===3?'#f3c86b':'#65c8e9';ctx.lineWidth=1;ctx.strokeRect(-18,-42,36,15);ctx.fillStyle=towerLevel(s)===3?'#ffe6a0':'#d9f5ff';ctx.font='bold 10px Arial';ctx.textAlign='center';ctx.fillText(`${towerLevel(s)}/3`,0,-31);ctx.restore();
};

const v20DrawV21=draw;
draw=function(){
 v20DrawV21();const now=performance.now();state.v21Effects=state.v21Effects.filter(f=>f.expires>now);if(!state.v21Effects.length)return;ctx.save();ctx.translate(-state.camera.x,-state.camera.y);
 for(const f of state.v21Effects){const a=Math.max(.12,(f.expires-now)/130);ctx.globalAlpha=a;ctx.strokeStyle='#ff6f78';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(f.x1,f.y1);ctx.lineTo(f.x2,f.y2);ctx.stroke();ctx.strokeStyle='#fff0f1';ctx.lineWidth=2;ctx.stroke();}ctx.restore();ctx.globalAlpha=1;
};

const v20CleanupDestroyedV21=cleanupDestroyed;
cleanupDestroyed=function(){v20CleanupDestroyedV21();if(state.selectedTower&&!state.structures.includes(state.selectedTower)){state.selectedTower=null;updateTowerPanel();}};

const v20UpdateHudV21=updateHud;
updateHud=function(){v20UpdateHudV21();updateTowerPanel();};

const v20ResetV21=reset;
reset=function(){
 v20ResetV21();state.selectedTower=null;state.v21Effects=[];state.structures=state.structures.filter(s=>s.type!=='safespot');for(const s of state.structures){s.protected=false;s.safeSpotId=null;if(isUpgradeableTower(s))s.level=1;}updateTowerPanel();
};
els.restart.onclick=reset;

updateTowerPanel();
