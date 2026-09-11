const canvas=document.getElementById("game"),ctx=canvas.getContext("2d");
const W=canvas.width,H=canvas.height,STAGE_WAVES=CONFIG.GAME.WAVES_PER_STAGE;
const WORLD_W=CONFIG.WORLD.WIDTH,WORLD_H=CONFIG.WORLD.HEIGHT;
const BASE_X=WORLD_W/2,BASE_Y=WORLD_H/2,BASE_RADIUS=CONFIG.WORLD.BASE_RADIUS;

// =============================================================
// SKITTER SPRITES — extracted from the artwork supplied by you.
// Each horizontal strip contains transparent 128×128 frames.
// =============================================================
const SKITTER_MOVE = new Image();
SKITTER_MOVE.src = "assets/skitter_move.png";
const SKITTER_IDLE = new Image();
SKITTER_IDLE.src = "assets/skitter_idle.png";
const SKITTER_FRAME_SIZE = 128;

// Brute art — extracted directly from the top-down in-game preview in the
// Brute concept sheet supplied for this project.
const BRUTE_SPRITE = new Image();
BRUTE_SPRITE.src = "assets/brute_topdown.png";

const els={
 baseHp:document.getElementById("baseHp"),baseMax:document.getElementById("baseMax"),
 stage:document.getElementById("stage"),wave:document.getElementById("wave"),
 active:document.getElementById("activeWaves"),credits:document.getElementById("credits"),
 aliens:document.getElementById("aliens"),multiBonus:document.getElementById("multiBonus"),message:document.getElementById("message"),
 start:document.getElementById("startBtn"),all:document.getElementById("allBtn"),
 restart:document.getElementById("restartBtn"),money:document.getElementById("moneyBtn"),reach:document.getElementById("reachBtn"),
 overlay:document.getElementById("cardOverlay"),cards:document.getElementById("cards")
};

const TOWERS={
 soldier:{cost:CONFIG.SOLDIER.COST,range:CONFIG.SOLDIER.RANGE,memberRate:CONFIG.SOLDIER.FIRE_INTERVAL,damage:CONFIG.SOLDIER.DAMAGE,bulletSpeed:CONFIG.SOLDIER.BULLET_SPEED,label:"Soldier Squad"},
 laser:{cost:CONFIG.LASER.COST,range:CONFIG.LASER.RANGE,rate:CONFIG.LASER.FIRE_INTERVAL,damage:CONFIG.LASER.DAMAGE,bulletSpeed:CONFIG.LASER.BULLET_SPEED,label:"Laser Sniper"},
 flame:{cost:CONFIG.FLAME.COST,range:CONFIG.FLAME.RANGE,rate:CONFIG.FLAME.FIRE_INTERVAL,label:"Flamethrower"},
 blockade:{cost:CONFIG.BLOCKADE.COST,label:"Blockade"},
 safespot:{cost:CONFIG.SAFE_SPOT.COST,label:"Tower Safe Spot"}
};
const SOLDIER_OFFSETS=[[-13,-10],[0,-13],[13,-10],[-13,8],[0,11],[13,8]];

const RARITIES={
 common:{weight:CONFIG.CARD_RARITY.COMMON},
 uncommon:{weight:CONFIG.CARD_RARITY.UNCOMMON},
 rare:{weight:CONFIG.CARD_RARITY.RARE},
 epic:{weight:CONFIG.CARD_RARITY.EPIC}
};

const UPGRADES=[
 {name:"Rapid Training",rarity:"common",desc:"Each soldier fires 18% faster.",tag:"SOLDIERS",apply:s=>s.mods.soldierRate*=.82},
 {name:"Hotter Ammunition",rarity:"common",desc:"Soldier bullets deal 30% more damage.",tag:"SOLDIERS",apply:s=>s.mods.soldierDamage*=1.30},
 {name:"Reinforced Walls",rarity:"common",desc:"Blockades gain 60% more health.",tag:"BLOCKADES",apply:s=>s.mods.blockadeHp*=1.6},
 {name:"Scavenger Teams",rarity:"common",desc:"Gain 20% more credits from kills.",tag:"ECONOMY",apply:s=>s.mods.reward*=1.2},
 {name:"Long Nozzles",rarity:"uncommon",desc:"Flamethrower range increases by 35%.",tag:"FLAME",apply:s=>s.mods.flameRange*=1.35},
 {name:"Targeting Computer",rarity:"uncommon",desc:"Laser Snipers fire 22% faster.",tag:"LASER",apply:s=>s.mods.laserRate*=.78},
 {name:"Fortified Base",rarity:"uncommon",desc:"Increase max base health by 20 and heal 20.",tag:"BASE",apply:s=>{s.maxBaseHp+=20;s.baseHp=Math.min(s.maxBaseHp,s.baseHp+20)}},
 {name:"Expanded Squad",rarity:"uncommon",desc:"Every soldier squad gains 2 extra soldiers.",tag:"SOLDIERS",apply:s=>s.mods.extraSoldiers+=2},
 {name:"Heavy Laser Core",rarity:"rare",desc:"Laser Snipers deal 60% more damage.",tag:"LASER",apply:s=>s.mods.laserDamage*=1.6},
 {name:"Inferno Gel",rarity:"rare",desc:"Burn damage +75% and burn duration +50%.",tag:"FLAME",apply:s=>{s.mods.flameDamage*=1.75;s.mods.burnDuration*=1.5}},
 {name:"Rover Autoloader",rarity:"rare",desc:"Rover pistol fires 35% faster.",tag:"ROVER",apply:s=>s.mods.vehicleRate*=.65},
 {name:"Rover AP Rounds",rarity:"rare",desc:"Rover weapon damage increases by 75%.",tag:"ROVER",apply:s=>s.mods.vehicleDamage*=1.75},
 {name:"Twin Pistol Mount",rarity:"rare",desc:"The rover upgrades from pistol to twin pistols.",tag:"ROVER WEAPON",apply:s=>s.vehicle.weapon="twin"},
 {name:"Rover Scattergun",rarity:"epic",desc:"Replace the rover weapon with a short-range shotgun that fires 5 pellets.",tag:"ROVER WEAPON",apply:s=>s.vehicle.weapon="shotgun"},
 {name:"Rover Pulse Cannon",rarity:"epic",desc:"Replace the rover weapon with a powerful rapid pulse cannon.",tag:"ROVER WEAPON",apply:s=>s.vehicle.weapon="pulse"},
 {name:"Orbital Logistics",rarity:"epic",desc:"Kill rewards +60% and wave-stack bonus is stronger.",tag:"ECONOMY",apply:s=>{s.mods.reward*=1.6;s.mods.stackBonus+=.10}}
];

let state,selected="soldier",keys={};

function reset(){
 state={
  stage:1,nextWaveInStage:1,credits:CONFIG.GAME.STARTING_CREDITS,baseHp:CONFIG.GAME.STARTING_BASE_HP,maxBaseHp:CONFIG.GAME.STARTING_BASE_HP,
  enemies:[],towers:[],safeSpots:[],terrain:[],bullets:[],enemyBullets:[],particles:[],waveSpawners:[],
  gameOver:false,choosing:false,showReach:false,last:performance.now(),cardsPending:0,
  mods:{soldierRate:1,soldierDamage:1,extraSoldiers:0,laserDamage:1,laserRate:1,
        flameDamage:1,flameRange:1,burnDuration:1,blockadeHp:1,blockadeCost:1,
        reward:1,vehicleDamage:1,vehicleRate:1,stackBonus:CONFIG.MULTI_WAVE.BONUS_PER_EXTRA_ACTIVE_WAVE},
  vehicle:{x:BASE_X,y:BASE_Y+BASE_RADIUS+55,angle:-Math.PI/2,speed:CONFIG.ROVER.MOVE_SPEED,cool:0,weapon:CONFIG.ROVER.STARTING_WEAPON},
  camera:{x:BASE_X-W/2,y:BASE_Y-H/2,speed:CONFIG.WORLD.CAMERA_SPEED}
 };
 els.overlay.classList.add("hidden");
 state.terrain=generateTerrain(state.stage);
 els.message.textContent="Deploy defenses. Towers can now be destroyed by aliens.";
 updateHud();
}
function totalActiveWaves(){return state.waveSpawners.length}
function currentDisplayWave(){return Math.min(state.nextWaveInStage,STAGE_WAVES)}
function updateHud(){
 els.baseHp.textContent=Math.max(0,Math.ceil(state.baseHp));els.baseMax.textContent=state.maxBaseHp;
 els.stage.textContent=state.stage;els.wave.textContent=currentDisplayWave();
 els.active.textContent=totalActiveWaves();
 const bonusPct=Math.round(Math.max(0,totalActiveWaves()-1)*state.mods.stackBonus*100);
 els.multiBonus.textContent=`+${bonusPct}%`;
 els.credits.textContent=state.credits;els.aliens.textContent=state.enemies.length;
 const stageFinished=state.nextWaveInStage>STAGE_WAVES;
 els.start.disabled=state.gameOver||state.choosing||stageFinished;
 els.all.disabled=state.gameOver||state.choosing||stageFinished;
 document.querySelectorAll(".towerBtn").forEach(b=>b.classList.toggle("selected",b.dataset.type===selected));
}
document.querySelectorAll(".towerBtn").forEach(b=>b.onclick=()=>{selected=b.dataset.type;els.message.textContent=`Selected ${TOWERS[selected].label}.`;updateHud()});
els.start.onclick=()=>launchWave(state.nextWaveInStage++);
els.all.onclick=()=>{
 if(state.nextWaveInStage>STAGE_WAVES)return;
 const first=state.nextWaveInStage;
 while(state.nextWaveInStage<=STAGE_WAVES)launchWave(state.nextWaveInStage++);
 els.message.textContent=`Stage ${state.stage}: launched waves ${first}-${STAGE_WAVES} together!`;
};
els.restart.onclick=reset;
els.money.onclick=()=>{state.credits=999999;els.message.textContent="TEST MODE: 999,999 credits granted.";updateHud()};
els.reach.onclick=()=>{state.showReach=!state.showReach;els.reach.textContent=`SHOW REACH: ${state.showReach?"ON":"OFF"}`;};

window.addEventListener("keydown",e=>{
 const controlKeys=["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","w","a","s","d","W","A","S","D"];
 if(controlKeys.includes(e.key)){keys[e.key]=true;e.preventDefault()}
});
window.addEventListener("keyup",e=>{keys[e.key]=false});

function updateCamera(dt){
 const c=state.camera;
 let dx=(keys.ArrowRight?1:0)-(keys.ArrowLeft?1:0);
 let dy=(keys.ArrowDown?1:0)-(keys.ArrowUp?1:0);
 if(dx||dy){
   const l=Math.hypot(dx,dy)||1;dx/=l;dy/=l;
   c.x+=dx*c.speed*dt;c.y+=dy*c.speed*dt;
 }
 c.x=Math.max(0,Math.min(WORLD_W-W,c.x));
 c.y=Math.max(0,Math.min(WORLD_H-H,c.y));
}

function towerBaseHp(type){
 if(type==="soldier")return CONFIG.TOWER_DURABILITY.SOLDIER_HP;
 if(type==="laser")return CONFIG.TOWER_DURABILITY.LASER_HP;
 if(type==="flame")return CONFIG.TOWER_DURABILITY.FLAME_HP;
 if(type==="blockade")return CONFIG.BLOCKADE.HP*state.mods.blockadeHp;
 return 1;
}
function towerRadius(t){
 if(t.type==="blockade")return Math.max(t.w,t.h)/2;
 return 23;
}
function pointBlockedByTerrain(x,y,extra=0){
 return state.terrain.some(o=>Math.hypot(x-o.x,y-o.y)<o.r+CONFIG.TERRAIN.BUILD_CLEARANCE+extra);
}
