// Alien Planet Defense v46
// Authoritative deployment repair for the advanced movable-unit roster.
// Intercepts only the affected unit buttons at the final load layer so older
// placement/purchase handlers cannot swallow or double-handle these purchases.
const V46_TITLE='Alien Planet Defense v46';
document.title=V46_TITLE;
window.addEventListener('load',()=>{document.title=V46_TITLE;},{once:true});

(function installV46AdvancedUnitSpawnRepair(){
  const MENU=document.getElementById('unitsMenu');
  if(!MENU)return;

  const SPECS={
    medic:{cfg:()=>CONFIG.MEDIC,label:'Medic Squad',radius:22,air:false},
    engineer:{cfg:()=>CONFIG.ENGINEER,label:'Engineer Squad',radius:22,air:false},
    scout:{cfg:()=>CONFIG.SCOUT,label:'Scout Squad',radius:21,air:false},
    sniper:{cfg:()=>CONFIG.SNIPER,label:'Sniper Squad',radius:21,air:false},
    flametrooper:{cfg:()=>CONFIG.FLAME_TROOPER,label:'Flamethrower Troopers',radius:22,air:false},
    spotter:{cfg:()=>CONFIG.SPOTTER,label:'Sneaky Spotter Squad',radius:21,air:false},
    minelayer:{cfg:()=>CONFIG.MINE_LAYER,label:'Mine Layer Squad',radius:23,air:false},
    mech:{cfg:()=>CONFIG.MECH,label:'Combat Mech',radius:29,air:false},
    combatdrone:{cfg:()=>CONFIG.COMBAT_DRONE,label:'Combat Drone',radius:16,air:true},
    combatship:{cfg:()=>CONFIG.COMBAT_SHIP,label:'Combat Ship',radius:27,air:true}
  };

  const msg=text=>{if(els?.message)els.message.textContent=text;};
  const liveUnits=()=>Array.isArray(state?.units)?state.units:[];

  function roleOf(u){
    try{return typeof unitRole==='function'?unitRole(u):(u?.role||u?.type);}catch{return u?.role||u?.type;}
  }

  function blockedGround(x,y,r){
    if(x<r+8||y<r+8||x>WORLD_W-r-8||y>WORLD_H-r-8)return true;
    try{if(typeof pointBlockedByTerrain==='function'&&pointBlockedByTerrain(x,y,r*.45))return true;}catch{}
    try{if(typeof navPointBlocked==='function'&&navPointBlocked(x,y,r*.45))return true;}catch{}

    for(const s of state.structures||[]){
      if(!s||s.hp<=0)continue;
      if(s.type==='wall'&&typeof pointSegmentDistance==='function'&&Number.isFinite(s.x1)&&Number.isFinite(s.y1)&&Number.isFinite(s.x2)&&Number.isFinite(s.y2)){
        let thick=12;try{if(typeof wallThickness==='function')thick=Number(wallThickness(s))||12;}catch{}
        if(pointSegmentDistance(x,y,s.x1,s.y1,s.x2,s.y2)<r+thick/2+6)return true;
      }else if(Number.isFinite(s.x)&&Number.isFinite(s.y)){
        let sr=30;try{if(typeof structureRadius==='function')sr=Number(structureRadius(s))||30;}catch{}
        if(Math.hypot(x-s.x,y-s.y)<r+sr+7)return true;
      }
    }
    for(const d of state.depots||[]){if(Number.isFinite(d.x)&&Number.isFinite(d.y)&&Math.hypot(x-d.x,y-d.y)<r+(Number(d.r)||34)+6)return true;}
    for(const u of liveUnits()){
      if(!u||u.hp<=0||u.transportedIn||u.garrisonedIn||!Number.isFinite(u.x)||!Number.isFinite(u.y))continue;
      let ur=18;try{if(typeof uRadius==='function')ur=Number(uRadius(u))||18;}catch{}
      if(Math.hypot(x-u.x,y-u.y)<r+ur+5)return true;
    }
    return false;
  }

  function spawnPoint(spec){
    const r=spec.radius;
    if(spec.air){
      const activeAir=liveUnits().filter(u=>u?.hp>0&&(u.type==='airunit'||roleOf(u)==='combatdrone'||roleOf(u)==='combatship')).length;
      const a=(activeAir*1.73+.35)%(Math.PI*2),dist=BASE_RADIUS+r+74+(activeAir%3)*24;
      return{x:Math.max(r+8,Math.min(WORLD_W-r-8,BASE_X+Math.cos(a)*dist)),y:Math.max(r+8,Math.min(WORLD_H-r-8,BASE_Y+Math.sin(a)*dist))};
    }
    for(let ring=0;ring<15;ring++){
      const dist=BASE_RADIUS+r+48+ring*34;
      for(let i=0;i<64;i++){
        const a=i/64*Math.PI*2+ring*.173;
        const x=BASE_X+Math.cos(a)*dist,y=BASE_Y+Math.sin(a)*dist;
        if(!blockedGround(x,y,r))return{x,y};
      }
    }
    // Last-resort deterministic point. Unit construction is still allowed rather
    // than silently failing; movement/pathfinding will move it clear afterwards.
    return{x:Math.max(r+8,Math.min(WORLD_W-r-8,BASE_X+BASE_RADIUS+r+70)),y:BASE_Y};
  }

  function buildUnit(type,spec,p){
    const cfg=spec.cfg();
    if(!cfg||!Number.isFinite(Number(cfg.HP)))throw new Error(`Missing/invalid CONFIG for ${type}`);

    let u=null;
    try{
      if(spec.air&&typeof makeAirUnit==='function')u=makeAirUnit(type,p.x,p.y);
      else if(!spec.air&&typeof makeGroundUnit==='function')u=makeGroundUnit(type,p.x,p.y);
    }catch(err){console.warn('v46: legacy unit factory failed; using internal factory',type,err);u=null;}

    if(!u){
      const members=Math.max(1,Number(cfg.MEMBERS)||Number(cfg.BARRELS)||1);
      u={
        id:'u'+Date.now()+Math.random(),type:spec.air?'airunit':'soldier',role:type,
        x:p.x,y:p.y,hp:Number(cfg.HP),maxHp:Number(cfg.HP),moveTarget:null,path:[],heading:0,
        cooldowns:Array.from({length:members},()=>Math.random()*.24),garrisonedIn:null
      };
    }

    // Normalize fields required by later movement/support/platoon systems. These
    // assignments do not alter role stats; they only make every spawned unit obey
    // the same object contract as the established unit factories.
    u.id=u.id||('u'+Date.now()+Math.random());
    u.type=spec.air?'airunit':'soldier';u.role=type;u.x=p.x;u.y=p.y;
    u.hp=Number.isFinite(Number(u.hp))?Number(u.hp):Number(cfg.HP);
    u.maxHp=Number.isFinite(Number(u.maxHp))?Number(u.maxHp):Number(cfg.HP);
    u.path=Array.isArray(u.path)?u.path:[];u.moveTarget=u.moveTarget||null;
    u.heading=Number.isFinite(Number(u.heading))?Number(u.heading):0;
    u.cooldowns=Array.isArray(u.cooldowns)?u.cooldowns:Array.from({length:Math.max(1,Number(cfg.MEMBERS)||Number(cfg.BARRELS)||1)},()=>Math.random()*.24);
    u.platoonId=null;u.platoonSlot=0;u.garrisonedIn=null;
    if(!spec.air){u.attachedTo=null;u.attachSlot=0;}
    if(type==='medic')u.healFxCooldown=Number(u.healFxCooldown)||0;
    if(type==='engineer')u.repairFxCooldown=Number(u.repairFxCooldown)||0;
    if(type==='combatship'||type==='combatdrone')u.transportedIn=null;
    return u;
  }

  function purchase(type){
    const spec=SPECS[type];if(!spec)return false;
    const cfg=spec.cfg(),cost=Math.max(0,Number(cfg?.COST)||0),free=!!state.debug?.unlimitedCash;

    if(type==='combatship'&&liveUnits().some(u=>u?.hp>0&&roleOf(u)==='combatship')){
      msg('Only one Combat Ship can be active at a time.');return false;
    }
    if(!free&&(Number(state.credits)||0)<cost){
      msg(`Need ${cost} gold for ${spec.label}.`);if(typeof updateHud==='function')updateHud();return false;
    }

    if(!free)state.credits-=cost;
    try{
      const p=spawnPoint(spec),u=buildUnit(type,spec,p);
      if(!u||!Number.isFinite(u.x)||!Number.isFinite(u.y)||!Number.isFinite(u.hp)||u.hp<=0)throw new Error('invalid spawned unit');
      liveUnits().push(u);
      buildType=null;state.routeEditing=false;state.attachMode=false;state.platoonAttachMode=false;
      state.v40MedicAttachMode=false;state.v40ApcAttachMode=false;
      state.selectedUnit=u;
      if('selectedTower'in state)state.selectedTower=null;
      if('selectedStorageBuilding'in state)state.selectedStorageBuilding=null;
      if(typeof updateTowerPanel==='function')try{updateTowerPanel();}catch{}
      msg(`${spec.label} deployed from the base.`);
      if(typeof updateHud==='function')updateHud();
      return true;
    }catch(err){
      if(!free)state.credits+=cost;
      console.error('v46 advanced unit deployment failed',type,err);
      msg(`Could not deploy ${spec.label}. Purchase refunded.`);
      if(typeof updateHud==='function')updateHud();
      return false;
    }
  }

  function affectedButton(node){
    const b=node?.closest?.('.buildBtn[data-type]');
    return b&&MENU.contains(b)&&SPECS[b.dataset.type]?b:null;
  }

  // Capture phase is intentional: it runs before every older per-button onclick
  // installed by v25/v33/v36/v43, preventing the legacy placement stack from
  // consuming the same click or charging twice.
  MENU.addEventListener('click',e=>{
    const b=affectedButton(e.target);if(!b)return;
    e.preventDefault();e.stopImmediatePropagation();
    const ok=purchase(b.dataset.type);
    if(ok&&typeof closeCommandMenu==='function')setTimeout(()=>{try{closeCommandMenu();}catch{}},0);
  },true);

  // Make the affected buttons explicitly enabled and non-submit controls. We do
  // not clone them here, so labels/classes/layout remain exactly as authored.
  for(const type of Object.keys(SPECS)){
    const b=MENU.querySelector(`.buildBtn[data-type="${type}"]`);
    if(!b)continue;b.disabled=false;b.type='button';b.dataset.v46Spawn='authoritative';
  }

  // Keep external/debug callers on the same repaired deployment path for these
  // roles while preserving the prior function for every other unit type.
  let spawnBeforeV46=null;try{if(typeof spawnUnitAtBase==='function')spawnBeforeV46=spawnUnitAtBase;}catch{}
  try{spawnUnitAtBase=function(type){return SPECS[type]?purchase(type):(spawnBeforeV46?spawnBeforeV46(type):false);};}catch{}

  window.__apdUnitSpawnRepair={version:46,types:Object.keys(SPECS),purchase};
})();
