// Alien Planet Defense v53
// Advanced movable-unit revamp: one authoritative identity, spawn and renderer
// for the ten advanced roles that were being collapsed into legacy soldier/truck art.
const V53_TITLE='Alien Planet Defense v53';
document.title=V53_TITLE;
window.addEventListener('load',()=>{document.title=V53_TITLE;},{once:true});

(function installV53AdvancedUnitRevamp(){
  if(window.__apdV53Installed)return;
  window.__apdV53Installed=true;

  const SPECS={
    medic:{label:'Medic Squad',cfg:'MEDIC',radius:22,kind:'ground',members:3},
    engineer:{label:'Engineer Squad',cfg:'ENGINEER',radius:22,kind:'ground',members:3},
    scout:{label:'Scout Squad',cfg:'SCOUT',radius:21,kind:'ground',members:4},
    sniper:{label:'Sniper Squad',cfg:'SNIPER',radius:21,kind:'ground',members:2},
    flametrooper:{label:'Flamethrower Troopers',cfg:'FLAME_TROOPER',radius:22,kind:'ground',members:4},
    spotter:{label:'Sneaky Spotter Squad',cfg:'SPOTTER',radius:21,kind:'ground',members:3},
    minelayer:{label:'Mine Layer Squad',cfg:'MINE_LAYER',radius:23,kind:'ground',members:3},
    mech:{label:'Combat Mech',cfg:'MECH',radius:29,kind:'ground',members:1},
    combatdrone:{label:'Combat Drone',cfg:'COMBAT_DRONE',radius:16,kind:'air',members:1},
    combatship:{label:'Combat Ship',cfg:'COMBAT_SHIP',radius:27,kind:'air',members:1}
  };
  const TYPES=new Set(Object.keys(SPECS));

  const oldUnitRole=typeof unitRole==='function'?unitRole:null;
  const oldRoleConfig=typeof roleConfig==='function'?roleConfig:null;
  const oldDisplayName=typeof unitDisplayName==='function'?unitDisplayName:null;
  const oldIsFlying=typeof isFlyingUnit==='function'?isFlyingUnit:null;
  const oldURadius=typeof uRadius==='function'?uRadius:null;
  const oldStructureOrUnitRadius=typeof structureOrUnitRadius==='function'?structureOrUnitRadius:null;

  function explicitRole(u){
    if(!u)return null;
    const r=typeof u.role==='string'?u.role:null;
    return r&&TYPES.has(r)?r:null;
  }
  function roleV53(u){
    const r=explicitRole(u);if(r)return r;
    try{return oldUnitRole?oldUnitRole(u):(u?.role||u?.type);}catch{return u?.role||u?.type;}
  }
  function cfgV53(u){
    const r=roleV53(u),s=SPECS[r];
    if(s&&CONFIG?.[s.cfg])return CONFIG[s.cfg];
    try{return oldRoleConfig?oldRoleConfig(u):CONFIG.SOLDIER;}catch{return CONFIG.SOLDIER;}
  }
  function nameV53(u){
    const r=roleV53(u),s=SPECS[r];if(s)return s.label;
    try{return oldDisplayName?oldDisplayName(u):(r||'Unit');}catch{return r||'Unit';}
  }
  function flyingV53(u){
    const r=roleV53(u);if(r==='combatdrone'||r==='combatship')return true;
    try{return oldIsFlying?oldIsFlying(u):u?.type==='airunit';}catch{return u?.type==='airunit';}
  }
  function radiusV53(u){
    const s=SPECS[roleV53(u)];if(s)return s.radius;
    try{return oldURadius?oldURadius(u):20;}catch{return 20;}
  }

  try{unitRole=roleV53;}catch{}
  try{roleConfig=cfgV53;}catch{}
  try{unitDisplayName=nameV53;}catch{}
  try{isFlyingUnit=flyingV53;}catch{}
  try{uRadius=radiusV53;}catch{}
  try{structureOrUnitRadius=function(t){const s=SPECS[roleV53(t)];if(s)return s.radius;return oldStructureOrUnitRadius?oldStructureOrUnitRadius(t):20;};}catch{}

  function cfgFor(type){const s=SPECS[type];return s?CONFIG?.[s.cfg]:null;}
  function costFor(type){const c=cfgFor(type),d=BUILD?.[type];return Math.max(0,Number(c?.COST ?? d?.cost ?? 0)||0);}

  function ensureRegistry(){
    if(typeof BUILD!=='object'||!BUILD)return;
    for(const [type,s] of Object.entries(SPECS)){
      const c=cfgFor(type),cost=Math.max(0,Number(c?.COST)||0);
      BUILD[type]={...(BUILD[type]||{}),kind:'unit',currency:'gold',cost,label:s.label,radius:s.radius};
      const b=document.querySelector(`#unitsMenu .buildBtn[data-type="${type}"]`),small=b?.querySelector('small');
      if(b){b.disabled=false;b.dataset.v53Spawn='authoritative';b.title=s.label;}
      if(small)small.textContent=`${cost} gold`;
    }
  }

  function normalizeUnit(u){
    const r=explicitRole(u);if(!r)return u;
    const s=SPECS[r],cfg=cfgFor(r)||{};
    u.type=s.kind==='air'?'airunit':'soldier';
    u.role=r;
    // Migration may repair missing/non-numeric state, but zero/negative HP is a
    // legitimate dead unit and must never be revived by normalization.
    if(!Number.isFinite(Number(u.hp)))u.hp=Math.max(1,Number(cfg.HP)||1);
    if(!Number.isFinite(Number(u.maxHp))||Number(u.maxHp)<=0)u.maxHp=Math.max(1,Number(cfg.HP)||Number(u.hp)||1);
    if(!Array.isArray(u.path))u.path=[];
    if(!('moveTarget' in u))u.moveTarget=null;
    if(!Number.isFinite(Number(u.heading)))u.heading=0;
    const n=Math.max(1,Number(cfg.MEMBERS)||Number(cfg.BARRELS)||s.members||1);
    if(!Array.isArray(u.cooldowns))u.cooldowns=[];
    while(u.cooldowns.length<n)u.cooldowns.push(Math.random()*.22);
    if(u.cooldowns.length>n)u.cooldowns.length=n;
    if(s.kind==='ground'){
      if(!('attachedTo' in u))u.attachedTo=null;
      if(!('attachSlot' in u))u.attachSlot=0;
    }else{
      u.attachedTo=null;u.attachSlot=0;
    }
    if(!('garrisonedIn' in u))u.garrisonedIn=null;
    if(!('transportedIn' in u))u.transportedIn=null;
    if(!('platoonId' in u))u.platoonId=null;
    if(!('platoonSlot' in u))u.platoonSlot=0;
    if(r==='medic'){
      if(!Number.isFinite(Number(u.healFxCooldown)))u.healFxCooldown=0;
      if(!('v47FollowId' in u))u.v47FollowId=null;
    }
    if(r==='engineer'&&!Number.isFinite(Number(u.repairFxCooldown)))u.repairFxCooldown=0;
    return u;
  }
  function normalizeAll(){for(const u of state?.units||[])normalizeUnit(u);}

  function active(u){return !!u&&(Number(u.hp)||0)>0&&!u.transportedIn&&!u.garrisonedIn;}
  function inside(x,y,r){return Number.isFinite(x)&&Number.isFinite(y)&&x>=r+8&&y>=r+8&&x<=WORLD_W-r-8&&y<=WORLD_H-r-8;}
  function occupied(x,y,r){
    for(const u of state.units||[]){
      if(!active(u)||!Number.isFinite(u.x)||!Number.isFinite(u.y))continue;
      if(Math.hypot(x-u.x,y-u.y)<r+radiusV53(u)+8)return true;
    }
    return false;
  }
  function blockedGround(x,y,r){
    if(!inside(x,y,r)||Math.hypot(x-BASE_X,y-BASE_Y)<BASE_RADIUS+r+10)return true;
    try{if(typeof navPointBlocked==='function'&&navPointBlocked(x,y,r))return true;}catch{}
    return false;
  }
  function spawnPoint(type){
    const s=SPECS[type],r=s.radius;
    for(let ring=0;ring<26;ring++){
      const d=BASE_RADIUS+r+(s.kind==='air'?80:54)+ring*(s.kind==='air'?36:38);
      for(let i=0;i<72;i++){
        const a=i/72*Math.PI*2+ring*.173+type.length*.031;
        const x=BASE_X+Math.cos(a)*d,y=BASE_Y+Math.sin(a)*d;
        if(!inside(x,y,r)||occupied(x,y,r))continue;
        if(s.kind==='air'||!blockedGround(x,y,r))return{x,y};
      }
    }
    return null;
  }

  function makeUnit(type,p){
    const s=SPECS[type],cfg=cfgFor(type)||{},hp=Math.max(1,Number(cfg.HP)||1);
    const n=Math.max(1,Number(cfg.MEMBERS)||Number(cfg.BARRELS)||s.members||1);
    return normalizeUnit({
      id:'u'+Date.now()+'-'+Math.random().toString(36).slice(2),
      type:s.kind==='air'?'airunit':'soldier',role:type,unitClass:s.kind,
      x:p.x,y:p.y,hp,maxHp:hp,moveTarget:null,path:[],heading:0,
      cooldowns:Array.from({length:n},()=>Math.random()*.22),
      attachedTo:null,attachSlot:0,garrisonedIn:null,transportedIn:null,
      platoonId:null,platoonSlot:0
    });
  }

  function clearModes(){
    try{buildType=null;}catch{}
    state.routeEditing=false;state.attachMode=false;state.platoonAttachMode=false;
    state.v47MedicAttachMode=false;state.v47ApcAttachMode=false;
    try{if(typeof resetWallPath==='function')resetWallPath();}catch{}
    if('selectedTower' in state)state.selectedTower=null;
    if('selectedStorageBuilding' in state)state.selectedStorageBuilding=null;
  }
  function safeHud(){try{updateHud?.();}catch(err){console.warn('v53 HUD update failed',err);}}

  function purchase(type){
    ensureRegistry();
    const s=SPECS[type],cfg=cfgFor(type);
    if(!s||!cfg){if(els?.message)els.message.textContent=`${s?.label||type} configuration is unavailable.`;return false;}
    if(type==='combatship'&&(state.units||[]).some(u=>active(u)&&roleV53(u)==='combatship')){
      if(els?.message)els.message.textContent='Only one Combat Ship can be active at a time.';return false;
    }
    const cost=costFor(type),free=!!state.debug?.unlimitedCash;
    if(!free&&(Number(state.credits)||0)<cost){if(els?.message)els.message.textContent=`Need ${cost} gold for ${s.label}.`;safeHud();return false;}
    const p=spawnPoint(type);
    if(!p){if(els?.message)els.message.textContent=`No open deployment point near the Base for ${s.label}.`;return false;}
    const u=makeUnit(type,p);
    if(!u||roleV53(u)!==type||u.type!==(s.kind==='air'?'airunit':'soldier')){
      console.error('v53 invalid unit identity',type,u);if(els?.message)els.message.textContent=`Could not deploy ${s.label}: invalid unit identity.`;return false;
    }
    if(!free)state.credits-=cost;
    try{
      state.units.push(u);clearModes();state.selectedUnit=u;
      if(els?.message)els.message.textContent=`${s.label} deployed from the Base.`;
      safeHud();window.__apdLastSpawn={version:53,type,role:roleV53(u),runtimeType:u.type,ok:true,id:u.id};return true;
    }catch(err){
      const i=state.units?.indexOf(u);if(i>=0)state.units.splice(i,1);
      if(!free)state.credits+=cost;
      console.error('v53 deployment failed',type,err);if(els?.message)els.message.textContent=`Could not deploy ${s.label}. Purchase refunded.`;
      safeHud();window.__apdLastSpawn={version:53,type,ok:false,error:String(err?.stack||err)};return false;
    }
  }

  const menu=document.getElementById('unitsMenu');
  if(menu){
    menu.addEventListener('click',e=>{
      const b=e.target?.closest?.('.buildBtn[data-type]');
      if(!b||!menu.contains(b)||!TYPES.has(b.dataset.type))return;
      e.preventDefault();e.stopImmediatePropagation();
      const ok=purchase(b.dataset.type);
      if(ok&&typeof closeCommandMenu==='function')setTimeout(()=>{try{closeCommandMenu();}catch{}},0);
    },true);
  }

  let legacySpawn=null;try{if(typeof spawnUnitAtBase==='function')legacySpawn=spawnUnitAtBase;}catch{}
  try{spawnUnitAtBase=function(type){return TYPES.has(type)?purchase(type):(legacySpawn?legacySpawn(type):false);};}catch{}

  // Engineer repair classification is intentionally mechanical. The historic
  // design already allowed aircraft repair, so the current Drone/Ship stay in it.
  const ENGINEER_REPAIRABLE_ROLES=new Set(['truck','mech','tank','mobileartillery','repairvehicle','apc','mgcar','combatdrone','combatship']);
  function engineerRepairableUnit(u){return !!u&&ENGINEER_REPAIRABLE_ROLES.has(roleV53(u));}
  try{repairTargetFor=function(engineer){
    let best=null,ratio=1;
    const structures=(state.structures||[]).filter(s=>s?.built&&Number(s.hp)>0);
    const units=(state.units||[]).filter(u=>u!==engineer&&Number(u?.hp)>0&&engineerRepairableUnit(u));
    for(const t of [...structures,...units]){
      if(!Number.isFinite(Number(t.maxHp))||Number(t.maxHp)<=0||Number(t.hp)>=Number(t.maxHp))continue;
      if(Math.hypot(t.x-engineer.x,t.y-engineer.y)>Number(CONFIG.ENGINEER.REPAIR_RANGE))continue;
      const r=Number(t.hp)/Number(t.maxHp);if(r<ratio){best=t;ratio=r;}
    }
    return best;
  };}catch{}
  window.__apdIsEngineerRepairableUnit=engineerRepairableUnit;

  const drawUnitBeforeV53=drawUnit;
  const squadOffsets=[[-12,-9],[12,-9],[-12,10],[12,10],[0,-18],[0,18]];

  function pathOverlay(u){
    if(!u.path?.length)return;
    ctx.save();ctx.setLineDash([7,5]);ctx.strokeStyle='rgba(96,225,255,.72)';ctx.lineWidth=1.8;
    ctx.beginPath();ctx.moveTo(0,0);for(const p of u.path)ctx.lineTo(p.x-u.x,p.y-u.y);ctx.stroke();ctx.restore();
  }
  function selectionAndHp(u,r,label){
    if(state.selectedUnit===u){
      ctx.strokeStyle='#ffe47b';ctx.lineWidth=2.5;ctx.setLineDash([]);ctx.beginPath();ctx.arc(0,0,r+7,0,Math.PI*2);ctx.stroke();
      ctx.fillStyle='rgba(5,13,18,.88)';ctx.fillRect(-42,-r-28,84,15);ctx.fillStyle='#f8ecad';ctx.font='bold 8px Arial';ctx.textAlign='center';ctx.fillText(label.toUpperCase(),0,-r-17);
    }
    if(u.hp<u.maxHp){ctx.fillStyle='#111';ctx.fillRect(-24,r+8,48,4);ctx.fillStyle='#ef6666';ctx.fillRect(-24,r+8,48*Math.max(0,u.hp/u.maxHp),4);}
  }
  function person(x,y,body,accent,heading=0,longGun=0){
    ctx.save();ctx.translate(x,y);ctx.rotate(heading);
    ctx.fillStyle=body;ctx.beginPath();ctx.arc(0,1,5.8,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#d7d3c8';ctx.beginPath();ctx.arc(0,-5.2,2.8,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=accent;ctx.fillRect(-4,-1,8,3);
    ctx.strokeStyle='#d8e1e5';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(3,0);ctx.lineTo(10+longGun,0);ctx.stroke();
    ctx.restore();
  }
  function drawMedic(u){
    pathOverlay(u);const h=u.heading||0;for(let i=0;i<3;i++){const o=squadOffsets[i];person(o[0],o[1],'#e5ecef','#5fe1c4',h,0);}
    ctx.strokeStyle='#70f0d3';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-5,0);ctx.lineTo(5,0);ctx.moveTo(0,-5);ctx.lineTo(0,5);ctx.stroke();selectionAndHp(u,27,'Medic Squad');
  }
  function drawEngineer(u){
    pathOverlay(u);const h=u.heading||0;for(let i=0;i<3;i++){const o=squadOffsets[i];person(o[0],o[1],'#48545c','#ffd45f',h,1);}
    ctx.strokeStyle='#ffd45f';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-7,7);ctx.lineTo(8,-8);ctx.moveTo(3,-10);ctx.lineTo(10,-3);ctx.stroke();selectionAndHp(u,27,'Engineer Squad');
  }
  function drawScout(u){
    pathOverlay(u);const h=u.heading||0;for(let i=0;i<4;i++){const o=squadOffsets[i];person(o[0],o[1],'#294d3f','#6df0a8',h,2);}
    ctx.strokeStyle='#7cf0b1';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(0,0,24,0,Math.PI*2);ctx.stroke();selectionAndHp(u,26,'Scout Squad');
  }
  function drawSniper(u){
    pathOverlay(u);const h=u.heading||0;for(let i=0;i<2;i++){const o=[[-9,-5],[9,6]][i];person(o[0],o[1],'#35413f','#b6d3b8',h,10);}
    ctx.strokeStyle='rgba(210,235,217,.45)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(Math.cos(h)*13,Math.sin(h)*13);ctx.lineTo(Math.cos(h)*29,Math.sin(h)*29);ctx.stroke();selectionAndHp(u,25,'Sniper Squad');
  }
  function drawFlame(u){
    pathOverlay(u);const h=u.heading||0;for(let i=0;i<4;i++){
      const o=squadOffsets[i];person(o[0],o[1],'#55352a','#ff9448',h,2);
      ctx.save();ctx.translate(o[0],o[1]);ctx.fillStyle='#d97a35';ctx.beginPath();ctx.arc(-5,3,3.5,0,Math.PI*2);ctx.fill();ctx.restore();
    }
    ctx.fillStyle='#ffb14d';ctx.beginPath();ctx.arc(Math.cos(h)*25,Math.sin(h)*25,4,0,Math.PI*2);ctx.fill();selectionAndHp(u,27,'Flamethrower Troopers');
  }
  function drawSpotter(u){
    pathOverlay(u);ctx.save();ctx.globalAlpha=.68;const h=u.heading||0;for(let i=0;i<3;i++){const o=squadOffsets[i];person(o[0],o[1],'#28545a','#83f2ef',h,0);}ctx.restore();
    ctx.strokeStyle='#7de7e9';ctx.lineWidth=2;ctx.setLineDash([4,4]);ctx.beginPath();ctx.arc(0,0,23,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#b5ffff';ctx.beginPath();ctx.arc(0,0,3,0,Math.PI*2);ctx.fill();selectionAndHp(u,26,'Sneaky Spotter Squad');
  }
  function drawMineLayer(u){
    pathOverlay(u);const h=u.heading||0;for(let i=0;i<3;i++){const o=squadOffsets[i];person(o[0],o[1],'#504a35','#d7be69',h,0);ctx.fillStyle='#bca451';ctx.beginPath();ctx.arc(o[0]-5,o[1]+4,3.5,0,Math.PI*2);ctx.fill();}
    ctx.fillStyle='#d6bd66';ctx.beginPath();ctx.arc(0,0,6,0,Math.PI*2);ctx.fill();selectionAndHp(u,28,'Mine Layer Squad');
  }
  function drawMech(u){
    pathOverlay(u);ctx.save();ctx.rotate(u.heading||0);
    ctx.fillStyle='#26343e';ctx.fillRect(-24,-19,48,38);
    ctx.fillStyle='#617b8d';ctx.fillRect(-15,-16,29,32);
    ctx.fillStyle='#18242b';ctx.fillRect(-25,-22,9,44);ctx.fillRect(16,-22,9,44);
    ctx.fillStyle='#8fb0c2';ctx.fillRect(-8,-11,17,22);
    ctx.strokeStyle='#d5e6ef';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(7,-8);ctx.lineTo(31,-8);ctx.moveTo(7,8);ctx.lineTo(31,8);ctx.stroke();
    ctx.fillStyle='#74dcff';ctx.fillRect(-4,-5,8,10);ctx.restore();selectionAndHp(u,34,'Combat Mech');
  }
  function drawDrone(u){
    pathOverlay(u);ctx.save();ctx.rotate(u.heading||0);
    ctx.fillStyle='#7eddf5';ctx.beginPath();ctx.moveTo(19,0);ctx.lineTo(4,-9);ctx.lineTo(-17,-6);ctx.lineTo(-10,0);ctx.lineTo(-17,6);ctx.lineTo(4,9);ctx.closePath();ctx.fill();
    ctx.fillStyle='#263c48';ctx.beginPath();ctx.arc(0,0,5,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#b9f3ff';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-5,-8);ctx.lineTo(-13,-15);ctx.moveTo(-5,8);ctx.lineTo(-13,15);ctx.stroke();ctx.restore();selectionAndHp(u,23,'Combat Drone');
  }
  function drawShip(u){
    pathOverlay(u);ctx.save();ctx.rotate(u.heading||0);
    ctx.fillStyle='#405a6b';ctx.beginPath();ctx.moveTo(38,0);ctx.lineTo(12,-19);ctx.lineTo(-6,-15);ctx.lineTo(-28,-28);ctx.lineTo(-20,-7);ctx.lineTo(-35,0);ctx.lineTo(-20,7);ctx.lineTo(-28,28);ctx.lineTo(-6,15);ctx.lineTo(12,19);ctx.closePath();ctx.fill();
    ctx.fillStyle='#7898aa';ctx.beginPath();ctx.moveTo(20,0);ctx.lineTo(3,-10);ctx.lineTo(-12,-8);ctx.lineTo(-8,8);ctx.lineTo(3,10);ctx.closePath();ctx.fill();
    ctx.fillStyle='#9fe8ff';ctx.beginPath();ctx.ellipse(9,0,9,5,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#ffb45c';ctx.fillRect(-31,-16,7,8);ctx.fillRect(-31,8,7,8);
    ctx.strokeStyle='#d4edf8';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(14,-10);ctx.lineTo(31,-13);ctx.moveTo(14,10);ctx.lineTo(31,13);ctx.stroke();ctx.restore();selectionAndHp(u,41,'Combat Ship');
  }

  const renderers={medic:drawMedic,engineer:drawEngineer,scout:drawScout,sniper:drawSniper,flametrooper:drawFlame,spotter:drawSpotter,minelayer:drawMineLayer,mech:drawMech,combatdrone:drawDrone,combatship:drawShip};
  drawUnit=function(u){
    if(!u)return;
    const r=roleV53(u),fn=renderers[r];
    if(!fn)return drawUnitBeforeV53(u);
    if(u.garrisonedIn||u.transportedIn)return;
    // Rendering is intentionally read-only for gameplay state. Migration happens
    // at construction/reset boundaries, never inside drawUnit().
    ctx.save();ctx.translate(u.x,u.y);fn(u);ctx.restore();
  };

  const resetBeforeV53=reset;
  reset=function(){const r=resetBeforeV53();ensureRegistry();normalizeAll();return r;};
  if(els?.restart)els.restart.onclick=reset;

  const REQUIRED_CONFIG={
    medic:['HP','MOVE_SPEED','HEAL_RANGE','HEAL_PER_SECOND'],
    engineer:['HP','MOVE_SPEED','REPAIR_RANGE','REPAIR_PER_SECOND'],
    scout:['HP','MOVE_SPEED','RANGE','FIRE_INTERVAL','DAMAGE'],
    sniper:['HP','MOVE_SPEED','RANGE','FIRE_INTERVAL','DAMAGE'],
    flametrooper:['HP','MOVE_SPEED','RANGE','FIRE_INTERVAL','DIRECT_DAMAGE'],
    spotter:['HP','MOVE_SPEED','SPOT_RANGE','MARK_DAMAGE_MULTIPLIER'],
    minelayer:['HP','MOVE_SPEED','MINE_DAMAGE','MINE_TRIGGER_RADIUS'],
    mech:['HP','MOVE_SPEED','RANGE','FIRE_INTERVAL','DAMAGE'],
    combatdrone:['HP','MOVE_SPEED','RANGE','FIRE_INTERVAL','DAMAGE'],
    combatship:['HP','MOVE_SPEED','RANGE','FIRE_INTERVAL','DAMAGE','SPLASH_RADIUS']
  };
  function runUnitAudit(){
    const audit={};
    for(const type of TYPES){
      const s=SPECS[type],u=makeUnit(type,{x:BASE_X+400,y:BASE_Y}),expected=s.kind==='air'?'airunit':'soldier',cfg=cfgFor(type)||{};
      const dead=makeUnit(type,{x:BASE_X+420,y:BASE_Y});dead.hp=0;normalizeUnit(dead);
      const missingConfig=(REQUIRED_CONFIG[type]||[]).filter(k=>!Number.isFinite(Number(cfg[k])));
      const checks={
        role:roleV53(u)===type,
        runtimeType:u.type===expected,
        renderer:typeof renderers[type]==='function',
        hp:Number.isFinite(Number(u.hp))&&Number(u.hp)>0&&Number.isFinite(Number(u.maxHp))&&Number(u.maxHp)>0,
        cooldowns:Array.isArray(u.cooldowns)&&u.cooldowns.length>0&&u.cooldowns.every(v=>Number.isFinite(Number(v))),
        movement:typeof setUnitDestination==='function'&&typeof updateUnitMovement==='function',
        coordinates:Number.isFinite(Number(u.x))&&Number.isFinite(Number(u.y)),
        deathSafe:Number(dead.hp)===0,
        config:missingConfig.length===0
      };
      audit[type]={role:roleV53(u),type:u.type,expectedType:expected,missingConfig,checks,ok:Object.values(checks).every(Boolean)};
    }
    return{version:53,allOk:Object.values(audit).every(v=>v.ok),units:audit};
  }

  ensureRegistry();normalizeAll();
  window.__apdUnitAudit=runUnitAudit();
  window.__apdRunUnitAudit=runUnitAudit;
  window.__apdAudit={...(window.__apdAudit||{}),version:53,advancedUnits:'authoritative-identity+spawn+renderer',deathNormalization:'zero-hp-preserved',engineerRepair:'mechanical-role-classification',v52Superseded:true};
})();
