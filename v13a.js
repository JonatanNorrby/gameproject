const canvas=document.getElementById('game'),ctx=canvas.getContext('2d');
const W=canvas.width,H=canvas.height;
const WORLD_W=CONFIG.WORLD.WIDTH,WORLD_H=CONFIG.WORLD.HEIGHT;
const BASE_X=WORLD_W/2,BASE_Y=WORLD_H/2,BASE_RADIUS=CONFIG.WORLD.BASE_RADIUS;

const SKITTER_MOVE=new Image();SKITTER_MOVE.src='assets/skitter_move.png';
const BRUTE_SPRITE=new Image();BRUTE_SPRITE.src='assets/brute_topdown.png';
const SKITTER_FRAME_SIZE=128;

const els={
 baseHp:document.getElementById('baseHp'),baseMax:document.getElementById('baseMax'),xp:document.getElementById('xp'),nextXp:document.getElementById('nextXp'),level:document.getElementById('level'),credits:document.getElementById('credits'),aliens:document.getElementById('aliens'),survival:document.getElementById('survival'),message:document.getElementById('message'),reach:document.getElementById('reachBtn'),center:document.getElementById('centerBtn'),restart:document.getElementById('restartBtn'),debugBtn:document.getElementById('debugBtn'),debugPanel:document.getElementById('debugPanel'),debugCash:document.getElementById('debugCash'),debugLives:document.getElementById('debugLives'),debugHeal:document.getElementById('debugHeal'),overlay:document.getElementById('cardOverlay'),cards:document.getElementById('cards')
};

const BUILD={
 soldier:{kind:'unit',cost:CONFIG.SOLDIER.COST,label:'Fire Squad'},
 truck:{kind:'unit',cost:CONFIG.TRUCK.COST,label:'Crystal Truck'},
 laser:{kind:'tower',cost:CONFIG.LASER.COST,label:'Laser Sniper'},
 flame:{kind:'tower',cost:CONFIG.FLAME.COST,label:'Flamethrower'},
 blockade:{kind:'tower',cost:CONFIG.BLOCKADE.COST,label:'Blockade'},
 safespot:{kind:'passive',cost:CONFIG.SAFE_SPOT.COST,label:'Tower Safe Spot'},
 mine:{kind:'passive',cost:CONFIG.CRYSTALS.MINE_COST,label:'Crystal Mine'}
};
const SOLDIER_OFFSETS=[[-13,-10],[0,-13],[13,-10],[-13,8],[0,11],[13,8]];
const RARITIES={common:CONFIG.CARD_RARITY.COMMON,uncommon:CONFIG.CARD_RARITY.UNCOMMON,rare:CONFIG.CARD_RARITY.RARE,epic:CONFIG.CARD_RARITY.EPIC};
const UPGRADES=[
 {name:'Rapid Training',rarity:'common',desc:'Fire Squads shoot 18% faster.',tag:'FIRE SQUADS',apply:s=>s.mods.soldierRate*=.82},
 {name:'Hotter Ammunition',rarity:'common',desc:'Fire Squad bullets deal 30% more damage.',tag:'FIRE SQUADS',apply:s=>s.mods.soldierDamage*=1.3},
 {name:'Combat Conditioning',rarity:'common',desc:'Movable units move 20% faster.',tag:'UNITS',apply:s=>s.mods.unitMove*=1.2},
 {name:'Efficient Drills',rarity:'common',desc:'Crystal Mines produce 25% faster.',tag:'ECONOMY',apply:s=>s.mods.mineRate*=1.25},
 {name:'Expanded Storage',rarity:'uncommon',desc:'Mines and Trucks hold 40% more crystals.',tag:'ECONOMY',apply:s=>{s.mods.mineStorage*=1.4;s.mods.truckCapacity*=1.4}},
 {name:'Expanded Squad',rarity:'uncommon',desc:'Every Fire Squad gains 2 soldiers.',tag:'FIRE SQUADS',apply:s=>s.mods.extraSoldiers+=2},
 {name:'Targeting Computer',rarity:'uncommon',desc:'Laser Snipers fire 22% faster.',tag:'LASER',apply:s=>s.mods.laserRate*=.78},
 {name:'Fortified Base',rarity:'uncommon',desc:'Base maximum HP +35 and heal 35.',tag:'BASE',apply:s=>{s.maxBaseHp+=35;s.baseHp=Math.min(s.maxBaseHp,s.baseHp+35)}},
 {name:'Heavy Laser Core',rarity:'rare',desc:'Laser Snipers deal 60% more damage.',tag:'LASER',apply:s=>s.mods.laserDamage*=1.6},
 {name:'Inferno Gel',rarity:'rare',desc:'Burn damage +75% and duration +50%.',tag:'FLAME',apply:s=>{s.mods.flameDamage*=1.75;s.mods.burnDuration*=1.5}},
 {name:'Armored Convoys',rarity:'rare',desc:'Trucks gain 80% more HP.',tag:'TRUCKS',apply:s=>{s.mods.truckHp*=1.8;for(const u of s.units)if(u.type==='truck'){const r=u.hp/u.maxHp;u.maxHp*=1.8;u.hp=u.maxHp*r}}},
 {name:'Industrial Logistics',rarity:'epic',desc:'Crystal deliveries are worth 75% more money.',tag:'ECONOMY',apply:s=>s.mods.crystalValue*=1.75}
];

let state,buildType='soldier',keys={},pointer=null;
function reset(){
 state={credits:CONFIG.GAME.STARTING_CREDITS,baseHp:CONFIG.GAME.STARTING_BASE_HP,maxBaseHp:CONFIG.GAME.STARTING_BASE_HP,xp:0,xpLevel:1,nextXp:CONFIG.XP.START_TO_LEVEL,elapsed:0,spawnTimer:2,enemies:[],units:[],structures:[],safeSpots:[],terrain:[],depots:[],bullets:[],enemyBullets:[],particles:[],selectedUnit:null,showReach:false,choosing:false,gameOver:false,last:performance.now(),debug:{unlimitedCash:false,unlimitedLives:false},mods:{soldierRate:1,soldierDamage:1,extraSoldiers:0,unitMove:1,laserRate:1,laserDamage:1,flameDamage:1,burnDuration:1,mineRate:1,mineStorage:1,truckCapacity:1,truckHp:1,crystalValue:1},camera:{x:BASE_X-W/2,y:BASE_Y-H/2,speed:CONFIG.WORLD.CAMERA_SPEED}};
 state.terrain=generateTerrain();state.depots=generateDepots();els.overlay.classList.add('hidden');els.debugCash.checked=false;els.debugLives.checked=false;els.message.textContent='Continuous survival started. Build mines and use trucks to fund your defenses.';updateHud();
}
function updateHud(){
 if(state.debug.unlimitedCash&&state.credits<999999)state.credits=999999;if(state.debug.unlimitedLives)state.baseHp=state.maxBaseHp;
 els.baseHp.textContent=Math.ceil(state.baseHp);els.baseMax.textContent=state.maxBaseHp;els.xp.textContent=Math.floor(state.xp);els.nextXp.textContent=state.nextXp;els.level.textContent=state.xpLevel;els.credits.textContent=state.debug.unlimitedCash?'∞':Math.floor(state.credits);els.aliens.textContent=state.enemies.length;const s=Math.floor(state.elapsed),m=Math.floor(s/60);els.survival.textContent=`${m}:${String(s%60).padStart(2,'0')}`;
 document.querySelectorAll('.buildBtn').forEach(b=>b.classList.toggle('selected',b.dataset.type===buildType&&!state.selectedUnit));
}

document.querySelectorAll('.menuTab').forEach(tab=>tab.onclick=()=>{document.querySelectorAll('.menuTab').forEach(t=>t.classList.remove('active'));document.querySelectorAll('.buildMenu').forEach(m=>m.classList.remove('active'));tab.classList.add('active');document.getElementById(tab.dataset.menu).classList.add('active');});
document.querySelectorAll('.buildBtn').forEach(b=>b.onclick=()=>{state.selectedUnit=null;buildType=b.dataset.type;els.message.textContent=`Build mode: ${BUILD[buildType].label}.`;updateHud();});
els.reach.onclick=()=>{state.showReach=!state.showReach;els.reach.textContent=`SHOW REACH: ${state.showReach?'ON':'OFF'}`;};
els.center.onclick=()=>{state.camera.x=BASE_X-W/2;state.camera.y=BASE_Y-H/2;clampCamera();};els.restart.onclick=reset;
els.debugBtn.onclick=()=>els.debugPanel.classList.toggle('open');els.debugCash.onchange=()=>{state.debug.unlimitedCash=els.debugCash.checked;if(state.debug.unlimitedCash)state.credits=999999;updateHud();};els.debugLives.onchange=()=>{state.debug.unlimitedLives=els.debugLives.checked;updateHud();};els.debugHeal.onclick=()=>{state.baseHp=state.maxBaseHp;updateHud();};
window.addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){keys[e.key]=true;e.preventDefault();}});window.addEventListener('keyup',e=>keys[e.key]=false);

function generateTerrain(){const out=[];const count=CONFIG.TERRAIN.MIN_OBSTACLES+Math.floor(Math.random()*(CONFIG.TERRAIN.EXTRA_OBSTACLES_RANDOM+1));let tries=0;while(out.length<count&&tries<1000){tries++;const r=CONFIG.TERRAIN.MIN_RADIUS+Math.random()*(CONFIG.TERRAIN.MAX_RADIUS-CONFIG.TERRAIN.MIN_RADIUS),x=r+45+Math.random()*(WORLD_W-r*2-90),y=r+45+Math.random()*(WORLD_H-r*2-90);if(Math.hypot(x-BASE_X,y-BASE_Y)<BASE_RADIUS+180)continue;if(out.some(o=>Math.hypot(x-o.x,y-o.y)<r+o.r+24))continue;out.push({x,y,r,kind:Math.random()<.65?'rock':'crystal'});}return out;}
function generateDepots(){const out=[];let tries=0;while(out.length<CONFIG.CRYSTALS.DEPOT_COUNT&&tries<700){tries++;const x=100+Math.random()*(WORLD_W-200),y=100+Math.random()*(WORLD_H-200);if(Math.hypot(x-BASE_X,y-BASE_Y)<320)continue;if(pointBlockedByTerrain(x,y,CONFIG.CRYSTALS.DEPOT_RADIUS+12))continue;if(out.some(d=>Math.hypot(x-d.x,y-d.y)<300))continue;out.push({id:'d'+out.length,x,y,r:CONFIG.CRYSTALS.DEPOT_RADIUS,stock:CONFIG.CRYSTALS.DEPOT_BASE_STOCK,mineId:null});}return out;}
function pointBlockedByTerrain(x,y,extra=0){return state.terrain.some(o=>Math.hypot(x-o.x,y-o.y)<o.r+CONFIG.TERRAIN.BUILD_CLEARANCE+extra);}
function pointBlocked(x,y,extra=0){if(x<25||y<25||x>WORLD_W-25||y>WORLD_H-25)return true;if(Math.hypot(x-BASE_X,y-BASE_Y)<BASE_RADIUS+extra)return true;return pointBlockedByTerrain(x,y,extra);}
function clampCamera(){state.camera.x=Math.max(0,Math.min(WORLD_W-W,state.camera.x));state.camera.y=Math.max(0,Math.min(WORLD_H-H,state.camera.y));}
function updateCamera(dt){let dx=(keys.ArrowRight?1:0)-(keys.ArrowLeft?1:0),dy=(keys.ArrowDown?1:0)-(keys.ArrowUp?1:0);if(dx||dy){const l=Math.hypot(dx,dy)||1;state.camera.x+=dx/l*state.camera.speed*dt;state.camera.y+=dy/l*state.camera.speed*dt;clampCamera();}}

function worldFromEvent(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*W/r.width+state.camera.x,y:(e.clientY-r.top)*H/r.height,sx:(e.clientX-r.left)*W/r.width,sy:(e.clientY-r.top)*H/r.height};}
