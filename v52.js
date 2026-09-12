// Alien Planet Defense v52
// Authoritative advanced-unit deployment. This deliberately bypasses the legacy
// placement/purchase listener stack for the ten units that were still unreliable.
const V52_TITLE='Alien Planet Defense v52';
document.title=V52_TITLE;
window.addEventListener('load',()=>{document.title=V52_TITLE;},{once:true});

(function installV52AdvancedUnitDeployment(){
  if(window.__apdV52Installed)return;
  window.__apdV52Installed=true;

  const SPECS={
    medic:{label:'Medic Squad',cfg:'MEDIC',radius:22,kind:'ground'},
    engineer:{label:'Engineer',cfg:'ENGINEER',radius:22,kind:'ground'},
    scout:{label:'Scout',cfg:'SCOUT',radius:21,kind:'ground'},
    sniper:{label:'Sniper',cfg:'SNIPER',radius:21,kind:'ground'},
    flametrooper:{label:'Flame Troopers',cfg:'FLAME_TROOPER',radius:22,kind:'ground'},
    spotter:{label:'Spotter',cfg:'SPOTTER',radius:21,kind:'ground'},
    minelayer:{label:'Mine Layer',cfg:'MINE_LAYER',radius:23,kind:'ground'},
    mech:{label:'Combat Mech',cfg:'MECH',radius:29,kind:'ground'},
    combatdrone:{label:'Combat Drone',cfg:'COMBAT_DRONE',radius:16,kind:'air'},
    combatship:{label:'Combat Ship',cfg:'COMBAT_SHIP',radius:27,kind:'air'}
  };
  const TYPES=new Set(Object.keys(SPECS));

  function cfgFor(type){const s=SPECS[type];return s?CONFIG?.[s.cfg]:null;}
  function costFor(type){const c=cfgFor(type),d=BUILD?.[type];return Math.max(0,Number(c?.COST ?? d?.cost ?? 0)||0);}

  function ensureBuildRegistry(){
    if(typeof BUILD!=='object'||!BUILD)return;
    for(const [type,s] of Object.entries(SPECS)){
      const c=cfgFor(type),cost=Math.max(0,Number(c?.COST)||0);
      BUILD[type]={...(BUILD[type]||{}),kind:'unit',currency:'gold',cost,label:s.label,radius:s.radius};
      const b=document.querySelector(`#unitsMenu .buildBtn[data-type="${type}"]`),small=b?.querySelector('small');
      if(small)small.textContent=`${cost} gold`;
      if(b){b.disabled=false;b.dataset.v52Spawn='authoritative';}
    }
  }

  function activeUnit(u){return !!u&&(Number(u.hp)||0)>0&&!u.transportedIn&&!u.garrisonedIn;}
  function roleOf(u){try{return typeof unitRole==='function'?unitRole(u):(u?.role||u?.type);}catch{return u?.role||u?.type;}}
  function isInside(x,y,r){return Number.isFinite(x)&&Number.isFinite(y)&&x>=r+8&&y>=r+8&&x<=WORLD_W-r-8&&y<=WORLD_H-r-8;}
  function groundBlocked(x,y,r){
    if(!isInside(x,y,r))return true;
    if(Math.hypot(x-BASE_X,y-BASE_Y)<BASE_RADIUS+r+8)return true;
    try{if(typeof navPointBlocked==='function'&&navPointBlocked(x,y,r))return true;}catch{}
    try{if(typeof pointBlockedByTerrain==='function'&&pointBlockedByTerrain(x,y,r*.35))return true;}catch{}
    return false;
  }
  function occupiedByUnit(x,y,r){
    for(const u of state.units||[]){
      if(!activeUnit(u)||!Number.isFinite(u.x)||!Number.isFinite(u.y))continue;
      let ur=22;try{if(typeof uRadius==='function')ur=Math.max(8,Number(uRadius(u))||22);}catch{}
      if(Math.hypot(x-u.x,y-u.y)<r+ur+8)return true;
    }
    return false;
  }
  function spawnPoint(type){
    const s=SPECS[type],r=s.radius;
    if(s.kind==='air'){
      const n=(state.units||[]).filter(u=>activeUnit(u)&&(u.type==='airunit'||roleOf(u)==='combatdrone'||roleOf(u)==='combatship')).length;
      for(let ring=0;ring<8;ring++)for(let i=0;i<48;i++){
        const a=(i/48)*Math.PI*2+n*.47+ring*.13,d=BASE_RADIUS+r+78+ring*34;
        const x=BASE_X+Math.cos(a)*d,y=BASE_Y+Math.sin(a)*d;
        if(isInside(x,y,r)&&!occupiedByUnit(x,y,r))return{x,y};
      }
      return isInside(BASE_X+BASE_RADIUS+r+90,BASE_Y,r)?{x:BASE_X+BASE_RADIUS+r+90,y:BASE_Y}:null;
    }
    for(let ring=0;ring<24;ring++){
      const d=BASE_RADIUS+r+54+ring*38;
      for(let i=0;i<72;i++){
        const a=(i/72)*Math.PI*2+ring*.173+type.length*.019;
        const x=BASE_X+Math.cos(a)*d,y=BASE_Y+Math.sin(a)*d;
        if(!groundBlocked(x,y,r)&&!occupiedByUnit(x,y,r))return{x,y};
      }
    }
    return null;
  }

  function makeUnit(type,p){
    const s=SPECS[type],cfg=cfgFor(type)||{},air=s.kind==='air';
    const hp=Math.max(1,Number(cfg.HP)||1),members=Math.max(1,Number(cfg.MEMBERS)||Number(cfg.BARRELS)||1);
    const u={
      id:'u'+Date.now()+'-'+Math.random().toString(36).slice(2),
      type:air?'airunit':'soldier',role:type,x:p.x,y:p.y,hp,maxHp:hp,
      moveTarget:null,path:[],heading:0,
      cooldowns:Array.from({length:members},()=>Math.random()*.24),
      garrisonedIn:null,transportedIn:null,platoonId:null,platoonSlot:0
    };
    if(!air){u.attachedTo=null;u.attachSlot=0;}
    if(type==='medic'){u.healFxCooldown=0;u.v47FollowId=null;}
    if(type==='engineer'){u.repairFxCooldown=0;}
    if(type==='minelayer'){u.mineCooldown=0;}
    return u;
  }

  function validateUnit(type,u){
    const s=SPECS[type],cfg=cfgFor(type);
    if(!s||!cfg)return `missing CONFIG.${s?.cfg||type}`;
    if(!u||!Number.isFinite(u.x)||!Number.isFinite(u.y))return 'invalid position';
    if(!Number.isFinite(u.hp)||u.hp<=0||u.maxHp<=0)return 'invalid HP';
    if(s.kind==='air'&&u.type!=='airunit')return 'wrong air type';
    if(s.kind==='ground'&&u.type!=='soldier')return 'wrong ground type';
    if(u.role!==type)return 'wrong role';
    if(!Array.isArray(u.path)||!Array.isArray(u.cooldowns))return 'missing movement/combat arrays';
    return '';
  }

  function safeHud(){try{if(typeof updateHud==='function')updateHud();}catch(err){console.warn('v52 HUD refresh failed after deployment',err);}}
  function clearModes(){
    try{buildType=null;}catch{}
    state.routeEditing=false;state.attachMode=false;state.platoonAttachMode=false;
    state.v47MedicAttachMode=false;state.v47ApcAttachMode=false;
    try{if(typeof resetWallPath==='function')resetWallPath();}catch{}
    if('selectedTower' in state)state.selectedTower=null;
    if('selectedStorageBuilding' in state)state.selectedStorageBuilding=null;
  }

  function purchase(type){
    ensureBuildRegistry();
    const s=SPECS[type],cfg=cfgFor(type);
    if(!s||!cfg){if(els?.message)els.message.textContent=`${s?.label||type} configuration is unavailable.`;return false;}
    if(type==='combatship'&&(state.units||[]).some(u=>activeUnit(u)&&roleOf(u)==='combatship')){
      if(els?.message)els.message.textContent='Only one Combat Ship can be active at a time.';return false;
    }
    const cost=costFor(type),free=!!state.debug?.unlimitedCash;
    if(!free&&(Number(state.credits)||0)<cost){
      if(els?.message)els.message.textContent=`Need ${cost} gold for ${s.label}.`;safeHud();return false;
    }
    const p=spawnPoint(type);
    if(!p){if(els?.message)els.message.textContent=`No open deployment point near the Base for ${s.label}.`;return false;}
    const u=makeUnit(type,p),problem=validateUnit(type,u);
    if(problem){console.error('v52 constructor validation failed',type,problem,u);if(els?.message)els.message.textContent=`Could not deploy ${s.label}: ${problem}.`;return false;}

    if(!free)state.credits-=cost;
    try{
      state.units.push(u);
      clearModes();state.selectedUnit=u;
      if(els?.message)els.message.textContent=`${s.label} deployed from the Base.`;
      safeHud();
      window.__apdLastSpawn={version:52,type,ok:true,id:u.id,x:u.x,y:u.y,cost};
      return true;
    }catch(err){
      const i=state.units?.indexOf(u);if(i>=0)state.units.splice(i,1);
      if(!free)state.credits+=cost;
      console.error('v52 deployment failed',type,err);
      if(els?.message)els.message.textContent=`Could not deploy ${s.label}. Purchase refunded.`;
      safeHud();window.__apdLastSpawn={version:52,type,ok:false,error:String(err?.stack||err)};
      return false;
    }
  }

  const menu=document.getElementById('unitsMenu');
  if(menu){
    menu.addEventListener('click',e=>{
      const b=e.target?.closest?.('.buildBtn[data-type]');if(!b||!menu.contains(b)||!TYPES.has(b.dataset.type))return;
      e.preventDefault();e.stopImmediatePropagation();
      const ok=purchase(b.dataset.type);
      if(ok&&typeof closeCommandMenu==='function')setTimeout(()=>{try{closeCommandMenu();}catch{}},0);
    },true);
  }

  let inheritedSpawn=null;try{if(typeof spawnUnitAtBase==='function')inheritedSpawn=spawnUnitAtBase;}catch{}
  try{spawnUnitAtBase=function(type){return TYPES.has(type)?purchase(type):(inheritedSpawn?inheritedSpawn(type):false);};}catch{}

  function audit(){
    const result={};
    for(const type of TYPES){
      const p={x:BASE_X+BASE_RADIUS+SPECS[type].radius+100,y:BASE_Y};
      let error='';try{error=validateUnit(type,makeUnit(type,p));}catch(err){error=String(err?.message||err);}
      result[type]={ok:!error,error:error||null,cost:costFor(type)};
    }
    window.__apdSpawnAudit={version:52,results:result,allOk:Object.values(result).every(v=>v.ok)};
    return window.__apdSpawnAudit;
  }

  ensureBuildRegistry();audit();
  window.__apdAudit={...(window.__apdAudit||{}),version:52,advancedUnitSpawn:'capture-delegated-authoritative',advancedUnitTypes:[...TYPES]};
})();
