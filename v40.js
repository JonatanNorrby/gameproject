// Alien Planet Defense v40
// Medic follow/heal fix, unattackable Sneaky Spotters, APC unit/platoon support.
const V40_TITLE='Alien Planet Defense v40';document.title=V40_TITLE;window.addEventListener('load',()=>document.title=V40_TITLE,{once:true});
(function(){
 const C={MEDIC_FOLLOW:58,MEDIC_REPATH:78,APC_BOOST:1.28,APC_RADIUS:360,APC_FOLLOW:110,APC_REPATH:145};
 const INF=new Set(['rifleman','heavygunner','rocketeer','medic','engineer','scout','sniper','flametrooper','spotter','minelayer']);
 const role=u=>{try{return unitRole(u)}catch{return u?.role||u?.type}};
 const medic=u=>role(u)==='medic',spotter=u=>role(u)==='spotter',apc=u=>role(u)==='apc';
 const active=u=>!!u&&state.units.includes(u)&&u.hp>0&&!u.transportedIn&&!u.garrisonedIn;
 const infantry=u=>active(u)&&INF.has(role(u));

 // MEDIC: do not run legacy Medic branch (which can heal structures). Heal infantry units only.
 const combat0=updateUnitCombat;
 updateUnitCombat=function(dt){
  const all=state.units,medics=all.filter(u=>medic(u)&&active(u));
  if(!medics.length)return combat0(dt);
  state.units=all.filter(u=>!medics.includes(u));try{combat0(dt)}finally{state.units=all}
  for(const m of medics){
   const cfg=roleConfig(m)||CONFIG.MEDIC;let t=null,ratio=1,dist=Infinity;
   for(const u of state.units){if(u===m||!infantry(u)||u.hp>=u.maxHp)continue;const d=Math.hypot(u.x-m.x,u.y-m.y);if(d>(cfg.HEAL_RANGE||150))continue;const r=u.hp/u.maxHp;if(r<ratio||(r===ratio&&d<dist)){t=u;ratio=r;dist=d}}
   if(t){t.hp=Math.min(t.maxHp,t.hp+(cfg.HEAL_PER_SECOND||12)*dt);m.healFxCooldown=Math.max(0,(m.healFxCooldown||0)-dt);if(m.healFxCooldown<=0&&typeof fxPush==='function'){fxPush({kind:'heal',x1:m.x,y1:m.y,x2:t.x,y2:t.y,expires:performance.now()+150});m.healFxCooldown=.28}}
  }
 };

 state.v40MedicAttachMode=false;state.v40ApcAttachMode=false;
 const mf=document.createElement('button'),md=document.createElement('button'),as=document.createElement('button'),ad=document.createElement('button');
 mf.textContent='ATTACH / FOLLOW SQUAD';md.textContent='DETACH FROM SQUAD';as.textContent='ATTACH / BOOST UNIT';ad.textContent='DETACH SUPPORT';
 for(const b of [mf,md,as,ad]){b.style.display='none';els.unitActions.appendChild(b)}
 const followTarget=m=>{const t=state.units.find(u=>u.id===m?.v40FollowId);if(t&&infantry(t)&&!medic(t))return t;if(m)m.v40FollowId=null;return null};
 const clearMedic=m=>{if(m){m.v40FollowId=null;m.v40FollowTimer=0}};
 const followPoint=(f,t,d)=>{let a=Number(t.heading);if(!Number.isFinite(a))a=Math.atan2(t.y-f.y,t.x-f.x);const r=uRadius(f);return{x:Math.max(r+6,Math.min(WORLD_W-r-6,t.x-Math.cos(a)*d)),y:Math.max(r+6,Math.min(WORLD_H-r-6,t.y-Math.sin(a)*d))}};
 mf.onclick=()=>{const m=state.selectedUnit;if(!medic(m))return;state.v40MedicAttachMode=true;state.v40ApcAttachMode=false;state.attachMode=false;state.platoonAttachMode=false;if(els.message)els.message.textContent='Medic follow mode: tap another infantry squad.';if(typeof closeCommandMenu==='function')closeCommandMenu()};
 md.onclick=()=>{clearMedic(state.selectedUnit);state.v40MedicAttachMode=false;els.message.textContent='Medic detached.';updateHud()};

 // APC support can follow one unit, or every member of the selected unit's Platoon.
 const passenger=a=>{try{return apcPassenger(a)}catch{return a?.passengerId?state.units.find(u=>u.id===a.passengerId):null}};
 const clearApc=a=>{if(a){a.v40SupportUnitId=null;a.v40SupportPlatoonId=null;a.v40SupportTimer=0}};
 const targets=a=>{if(!apc(a)||a.hp<=0)return[];if(a.v40SupportPlatoonId&&typeof platoonMembers==='function'){const p=platoonMembers(a.v40SupportPlatoonId).filter(active);if(p.length)return p;a.v40SupportPlatoonId=null}const u=state.units.find(x=>x.id===a.v40SupportUnitId);if(active(u)&&u!==a)return[u];a.v40SupportUnitId=null;return[]};
 const center=a=>{const ts=targets(a);if(!ts.length)return null;let x=0,y=0;for(const u of ts){x+=u.x;y+=u.y}return{x:x/ts.length,y:y/ts.length,ts}};
 const attachApc=(a,t)=>{if(!apc(a)||!active(t)||a===t||passenger(a))return false;if(typeof removeFromPlatoon==='function'&&a.platoonId)removeFromPlatoon(a);a.v40SupportUnitId=t.id;a.v40SupportPlatoonId=t.platoonId||null;a.path=[];a.moveTarget=null;a.v40SupportTimer=0;return true};
 const supports=(a,u)=>{const c=center(a);if(!c||Math.hypot(a.x-c.x,a.y-c.y)>C.APC_RADIUS)return false;return(a.v40SupportPlatoonId&&u.platoonId===a.v40SupportPlatoonId)||a.v40SupportUnitId===u.id};
 as.onclick=()=>{const a=state.selectedUnit;if(!apc(a))return;if(passenger(a)){els.message.textContent='Unload the APC before using support mode.';return}state.v40ApcAttachMode=true;state.v40MedicAttachMode=false;state.attachMode=false;state.platoonAttachMode=false;if(els.message)els.message.textContent='APC support mode: tap a unit. A Platoon member boosts the entire Platoon.';if(typeof closeCommandMenu==='function')closeCommandMenu()};
 ad.onclick=()=>{clearApc(state.selectedUnit);state.v40ApcAttachMode=false;els.message.textContent='APC support detached.';updateHud()};

 const speed0=unitSpeed;
 unitSpeed=function(u){const b=speed0(u);if(!u||apc(u)||u.transportedIn||u.garrisonedIn)return b;for(const a of state.units)if(apc(a)&&active(a)&&supports(a,u))return Math.min((CONFIG.APC.MOVE_SPEED||172)*.94,b*C.APC_BOOST);return b};

 const move0=updateUnitMovement;
 updateUnitMovement=function(dt){move0(dt);
  for(const m of state.units){if(!medic(m)||!active(m))continue;const t=followTarget(m);if(!t)continue;m.v40FollowTimer=Math.max(0,(m.v40FollowTimer||0)-dt);const p=followPoint(m,t,C.MEDIC_FOLLOW),d=Math.hypot(m.x-p.x,m.y-p.y);if(d>C.MEDIC_REPATH&&m.v40FollowTimer<=0){setUnitDestination(m,p.x,p.y);m.v40FollowTimer=.42}else if(d<34&&!t.path?.length){m.path=[];m.moveTarget=null}}
  for(const a of state.units){if(!apc(a)||!active(a)||passenger(a))continue;const c=center(a);if(!c)continue;a.v40SupportTimer=Math.max(0,(a.v40SupportTimer||0)-dt);const p=followPoint(a,{x:c.x,y:c.y,heading:c.ts[0]?.heading},C.APC_FOLLOW),d=Math.hypot(a.x-p.x,a.y-p.y);if(d>C.APC_REPATH&&a.v40SupportTimer<=0){setUnitDestination(a,p.x,p.y);a.v40SupportTimer=.48}else if(d<58&&c.ts.every(u=>!u.path?.length)){a.path=[];a.moveTarget=null}}
 };
 if(typeof apcLoadBtn!=='undefined'&&apcLoadBtn){const load0=apcLoadBtn.onclick;apcLoadBtn.onclick=()=>{clearApc(state.selectedUnit);state.v40ApcAttachMode=false;return load0?.()}};

 const tap0=handleTap;
 handleTap=function(x,y){const clicked=unitAt(x,y);
  if(state.v40MedicAttachMode){const m=state.selectedUnit;if(!medic(m)){state.v40MedicAttachMode=false;return}if(!clicked||clicked===m||!infantry(clicked)||medic(clicked)){els.message.textContent='Tap another active infantry squad.';return}if(typeof removeFromPlatoon==='function'&&m.platoonId)removeFromPlatoon(m);m.attachedTo=null;m.v40FollowId=clicked.id;m.path=[];m.moveTarget=null;state.v40MedicAttachMode=false;els.message.textContent=`Medic attached to ${unitDisplayName(clicked)}.`;updateHud();return}
  if(state.v40ApcAttachMode){const a=state.selectedUnit;if(!apc(a)){state.v40ApcAttachMode=false;return}if(!clicked||clicked===a){els.message.textContent='Tap a movable unit to support.';return}if(attachApc(a,clicked)){state.v40ApcAttachMode=false;const n=a.v40SupportPlatoonId&&typeof platoonMembers==='function'?platoonMembers(a.v40SupportPlatoonId).length:1;els.message.textContent=n>1?`APC attached: whole Platoon (${n} units) boosted.`:'APC attached: unit boosted.';updateHud()}return}
  const s=state.selectedUnit,tower=typeof towerAt==='function'?towerAt(x,y):null,special=state.attachMode||state.platoonAttachMode||state.routeEditing||(typeof wallModeActive==='function'&&wallModeActive());
  if(s&&!clicked&&!tower&&!special){if(medic(s)&&s.v40FollowId)clearMedic(s);if(apc(s)&&(s.v40SupportUnitId||s.v40SupportPlatoonId))clearApc(s)}return tap0(x,y)
 };

 const actions0=updateUnitActions;
 updateUnitActions=function(){actions0();const u=state.selectedUnit,m=medic(u),a=apc(u),ft=m?followTarget(u):null,ts=a?targets(u):[];mf.style.display=m&&!ft?'inline-flex':'none';md.style.display=m&&ft?'inline-flex':'none';if(m){els.attach.style.display='none';els.detach.style.display='none'}as.style.display=a&&!passenger(u)&&!ts.length?'inline-flex':'none';ad.style.display=a&&ts.length?'inline-flex':'none';const l=document.querySelector('#unitActions .unitActionLabel');if(l&&m&&ft)l.textContent=`MEDIC · FOLLOWING ${unitDisplayName(ft).toUpperCase()}`;if(l&&a&&ts.length)l.textContent=`APC SUPPORT · ${u.v40SupportPlatoonId?'PLATOON '+ts.length+' UNITS':unitDisplayName(ts[0]).toUpperCase()} · +${Math.round((C.APC_BOOST-1)*100)}% MOVE`};

 // SPOTTER: remove from every enemy AI pass; also discard enemy projectiles targeting it.
 if(typeof closestAttackTarget==='function'){const target0=closestAttackTarget;closestAttackTarget=function(...args){const all=state.units;state.units=all.filter(u=>!spotter(u));try{return target0(...args)}finally{state.units=all}}}
 const enemies0=updateEnemies;
 updateEnemies=function(dt){const all=state.units,sp=all.filter(spotter);if(!sp.length)return enemies0(dt);state.units=all.filter(u=>!spotter(u));try{enemies0(dt)}finally{const survivors=state.units,set=new Set(survivors);state.units=all.filter(u=>spotter(u)?u.hp>0:set.has(u));for(const u of survivors)if(!all.includes(u))state.units.push(u)}};
 const proj0=updateProjectiles;
 updateProjectiles=function(dt){const sp=state.units.filter(spotter),hp=new Map(sp.map(u=>[u,u.hp]));if(state.enemyBullets)state.enemyBullets=state.enemyBullets.filter(b=>!spotter(b.target));proj0(dt);for(const [u,h] of hp)if(state.units.includes(u)&&u.hp<h)u.hp=h};

 const reset0=reset;
 reset=function(){reset0();state.v40MedicAttachMode=false;state.v40ApcAttachMode=false;for(const u of state.units){clearMedic(u);clearApc(u)}updateHud()};if(els.restart)els.restart.onclick=reset;
 const guide=document.querySelector('#guidePanel .guide-grid');if(guide&&!document.getElementById('v40SupportGuide')){const d=document.createElement('div');d.className='guide-box';d.id='v40SupportGuide';d.innerHTML='<b>Support Units</b><p>Medics heal infantry units only and can attach to another squad to follow it. Sneaky Spotters cannot be targeted by aliens. APCs can attach to a unit or an entire Platoon; while the APC stays close, that formation gets a movement-speed boost.</p>';guide.appendChild(d)}
})();
