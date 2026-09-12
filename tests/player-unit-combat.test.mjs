import test from 'node:test';
import assert from 'node:assert/strict';
import { UNIT_CONFIG, getUnitConfig } from '../js/units/unitConfig.js';
import { updatePlayerUnitCombat, assertPlayerCombatCoverage, PLAYER_UNIT_COMBAT_PROFILES } from '../js/combat/unitCombat.js';
import { applyPlayerEnemyDamage } from '../js/combat/playerDamage.js';
import { findBestEnemyTarget } from '../js/combat/unitTargeting.js';
import { isRepairableUnit, isHealableUnit } from '../js/core/entities.js';

function game() {
  return {
    config: { enemies: { saboteur: { stealth: { revealRange: 145 } } } },
    state: {
      entities: { units: [], enemies: [], structures: [], projectiles: [], effects: [], playerMines: [] },
      modifiers: { soldierDamage: 1, soldierRate: 1, extraSoldiers: 0 },
    },
    services: { random: () => 0.5, now: () => 1000 },
  };
}
function unit(role, x=0, y=0) {
  const d=getUnitConfig(role);
  return { id:`u-${role}`, type:d.runtimeType, role, x,y,hp:d.maxHp,maxHp:d.maxHp,cooldowns:Array(Math.max(1,d.members||d.barrels||1)).fill(0),combatCooldowns:Array(Math.max(1,d.members||d.barrels||1)).fill(0),path:[],moveTarget:null };
}
function enemy(type='ravager', x=100, y=0, hp=1000) {
  const radius=type==='flyer'?9:type==='climber'?7:type==='burrower'?9:6;
  return { id:`e-${type}-${x}-${y}`, type,x,y,hp,maxHp:hp,r:radius,burn:0,burnTick:0,markTime:0,markMult:1 };
}
function runRole(role, target=enemy(), dt=0) {
  const g=game(),u=unit(role);g.state.entities.units=[u];g.state.entities.enemies=[target];const actions=updatePlayerUnitCombat(g,dt);return {g,u,target,actions};
}

test('every canonical player role has one explicit clean combat/support profile',()=>{
  assert.equal(assertPlayerCombatCoverage(),true);
  assert.deepEqual(Object.keys(PLAYER_UNIT_COMBAT_PROFILES).sort(),Object.keys(UNIT_CONFIG).sort());
});

const projectileCases=[
 ['rifleman',6,1.55,740,.5],['heavygunner',4,1.1,740,.2],['scout',4,1.25,820,.42],['sniper',2,27,1200,2.05],
 ['mech',2,8.5,880,.24],['combatdrone',1,4.3,920,.38],['apc',1,3.2,820,.23],['mgcar',1,3,930,.16],
];
for(const [role,count,damage,speed,interval] of projectileCases){
 test(`${role} acquires nearest valid target and emits current projectile attack`,()=>{
  const {g,u,target,actions}=runRole(role,enemy('ravager',100,0,1000),0);
  assert.equal(actions,count);assert.equal(g.state.entities.projectiles.length,count);
  for(const p of g.state.entities.projectiles){assert.equal(p.dmg,damage);assert.ok(Math.abs(Math.hypot(p.vx,p.vy)-speed)<1e-8);}
  assert.equal(u.combatCooldowns[0],interval);
  const hit=applyPlayerEnemyDamage(g,target,damage);assert.equal(hit.applied,true);assert.ok(Math.abs(target.hp-(1000-damage*(role==='scout'?1.15:1)))<1e-9);
 });
}

test('Rifleman keeps current soldier modifiers and v47 cooldown behavior',()=>{
 const g=game(),u=unit('rifleman'),t=enemy('ravager',100,0,100);delete u.combatCooldowns;u.v47RifleCooldowns=Array(6).fill(0);g.state.modifiers.soldierDamage=2;g.state.modifiers.soldierRate=.8;g.state.modifiers.extraSoldiers=1;g.state.entities.units=[u];g.state.entities.enemies=[t];
 updatePlayerUnitCombat(g,0);assert.equal(g.state.entities.projectiles.length,6);assert.equal(g.state.entities.projectiles[0].dmg,3.1);assert.equal(u.combatCooldowns[0],.4);assert.equal(u.v47FiringUntil,1170);
});

test('Rocketeer preserves three-member direct splash: primary 13, secondary 65%',()=>{
 const g=game(),u=unit('rocketeer'),a=enemy('ravager',100,0,1000),b=enemy('ravager',120,0,1000);g.state.entities.units=[u];g.state.entities.enemies=[a,b];
 const actions=updatePlayerUnitCombat(g,0);assert.equal(actions,3);assert.equal(a.hp,1000-39);assert.ok(Math.abs(b.hp-(1000-13*.65*3))<1e-9);assert.equal(u.combatCooldowns[0],2.2);
});

test('Combat Ship preserves immediate 22 splash with 55% secondary damage',()=>{
 const g=game(),u=unit('combatship'),a=enemy('ravager',100,0,100),b=enemy('flyer',120,0,100);g.state.entities.units=[u];g.state.entities.enemies=[a,b];
 updatePlayerUnitCombat(g,0);assert.equal(a.hp,78);assert.equal(b.hp,100-22*.55);assert.equal(u.combatCooldowns[0],1.05);
});

test('Tank preserves immediate 34 splash with 32% secondary damage',()=>{
 const g=game(),u=unit('tank'),a=enemy('ravager',100,0,100),b=enemy('ravager',120,0,100);g.state.entities.units=[u];g.state.entities.enemies=[a,b];
 updatePlayerUnitCombat(g,0);assert.equal(a.hp,66);assert.equal(b.hp,100-34*.32);assert.equal(u.combatCooldowns[0],.82);
});

test('Mobile Artillery preserves 125 minimum, 540 maximum, ground-only targeting and 62/62% splash',()=>{
 const g=game(),u=unit('mobileartillery'),tooClose=enemy('ravager',100,0,100),ground=enemy('ravager',200,0,1000),nearSplash=enemy('ravager',230,0,1000),flyer=enemy('flyer',210,0,1000);g.state.entities.units=[u];g.state.entities.enemies=[tooClose,ground,nearSplash,flyer];
 updatePlayerUnitCombat(g,0);assert.equal(ground.hp,938);assert.equal(nearSplash.hp,1000-62*.62);assert.equal(tooClose.hp,100);assert.equal(flyer.hp,1000);assert.equal(u.combatCooldowns[0],2.45);
});

test('Flamethrower Trooper keeps nearest-3 direct damage, burn duration and 0.18 cooldown',()=>{
 const g=game(),u=unit('flametrooper'),targets=[enemy('ravager',60,0,100),enemy('flyer',70,0,100),enemy('ravager',80,0,100),enemy('ravager',90,0,100)];g.state.entities.units=[u];g.state.entities.enemies=targets;
 const actions=updatePlayerUnitCombat(g,0);assert.equal(actions,3);for(const t of targets.slice(0,3)){assert.equal(t.hp,98.5);assert.equal(t.burn,2.4);assert.equal(t.burnTick,0);}assert.equal(targets[3].hp,100);assert.equal(u.combatCooldowns[0],.18);
});

test('Sneaky Spotter marks every eligible enemy in 375 and never fires a normal weapon',()=>{
 const g=game(),u=unit('spotter'),a=enemy('ravager',100,0,100),b=enemy('flyer',300,0,100),c=enemy('ravager',400,0,100);g.state.entities.units=[u];g.state.entities.enemies=[a,b,c];
 const actions=updatePlayerUnitCombat(g,0);assert.equal(actions,2);assert.equal(a.markMult,1.2);assert.equal(a.markTime,.32);assert.equal(b.markMult,1.2);assert.equal(c.markMult,1);assert.equal(g.state.entities.projectiles.length,0);
});

test('Spotter group runs before v26 vehicle group so same-frame mark boosts Tank damage',()=>{
 const g=game(),tank=unit('tank'),spotter=unit('spotter'),t=enemy('ravager',100,0,100);g.state.entities.units=[tank,spotter];g.state.entities.enemies=[t];
 updatePlayerUnitCombat(g,0);assert.ok(Math.abs(t.hp-(100-34*1.2))<1e-9);
});

test('Mine Layer does not fire normally; manually placed mine auto-detonates against ground only',()=>{
 const g=game(),u=unit('minelayer'),primary=enemy('ravager',20,0,200),secondary=enemy('ravager',40,0,200),flyer=enemy('flyer',20,0,200);g.state.entities.units=[u];g.state.entities.enemies=[primary,secondary,flyer];g.state.entities.playerMines=[{id:'m1',ownerId:u.id,x:0,y:0}];
 const actions=updatePlayerUnitCombat(g,0);assert.equal(actions,1);assert.equal(primary.hp,105);assert.equal(secondary.hp,200-95*.72);assert.equal(flyer.hp,200);assert.equal(g.state.entities.playerMines.length,0);assert.equal(g.state.entities.projectiles.length,0);
});

test('Medic heals lowest-health-ratio healable infantry at 11/s, caps HP, and never alters movement',()=>{
 const g=game(),m=unit('medic'),a=unit('rifleman',50,0),b=unit('scout',80,0),mech=unit('mech',40,0);a.hp=80;b.hp=140;mech.hp=100;m.path=[{x:999,y:0}];m.moveTarget={x:999,y:0};m.v47FollowId=a.id;g.state.entities.units=[m,a,b,mech];
 updatePlayerUnitCombat(g,1);assert.equal(a.hp,91);assert.equal(b.hp,140);assert.equal(mech.hp,100);assert.deepEqual(m.path,[{x:999,y:0}]);assert.deepEqual(m.moveTarget,{x:999,y:0});assert.equal(m.v47FollowId,a.id);
 a.hp=a.maxHp-2;updatePlayerUnitCombat(g,1);assert.equal(a.hp,a.maxHp);
});

test('Medic does not heal dead infantry, transported infantry, or mechanical units',()=>{
 const g=game(),m=unit('medic'),dead=unit('rifleman',30,0),transported=unit('scout',40,0),mech=unit('mech',50,0);dead.hp=0;transported.hp=50;transported.transportedIn='apc';mech.hp=100;g.state.entities.units=[m,dead,transported,mech];updatePlayerUnitCombat(g,1);assert.equal(dead.hp,0);assert.equal(transported.hp,50);assert.equal(mech.hp,100);
 assert.equal(isHealableUnit(dead),true);assert.equal(isHealableUnit(mech),false);
});

const repairables=['truck','mech','tank','mobileartillery','repairvehicle','apc','mgcar','combatdrone','combatship'];
for(const role of repairables){
 test(`Engineer canonical repair includes ${role}`,()=>{
  const g=game(),eng=unit('engineer'),target=unit(role,50,0);target.hp=target.maxHp-20;g.state.entities.units=[eng,target];updatePlayerUnitCombat(g,1);assert.equal(target.hp,Math.min(target.maxHp,target.maxHp-2));assert.equal(isRepairableUnit(target),true);
 });
}

test('Engineer repairs built structures, excludes infantry, caps HP, and never revives dead mechanics',()=>{
 const g=game(),eng=unit('engineer'),structure={id:'s',type:'refinery',built:true,x:40,y:0,hp:90,maxHp:100},rifle=unit('rifleman',50,0),dead=unit('tank',60,0);rifle.hp=10;dead.hp=0;g.state.entities.units=[eng,rifle,dead];g.state.entities.structures=[structure];updatePlayerUnitCombat(g,1);assert.equal(structure.hp,100);assert.equal(rifle.hp,10);assert.equal(dead.hp,0);
});

test('Repair Vehicle uses same canonical repairability with current 150 range / 34 per second',()=>{
 const g=game(),rv=unit('repairvehicle'),apc=unit('apc',100,0);apc.hp=400;g.state.entities.units=[rv,apc];updatePlayerUnitCombat(g,1);assert.equal(apc.hp,434);
});

test('Truck remains non-combat',()=>{const {g,actions}=runRole('truck',enemy('ravager',50,0,100),1);assert.equal(actions,0);assert.equal(g.state.entities.projectiles.length,0);});

test('ground-only vs air and dual-capable air/ground regression',()=>{
 const g=game(),art=unit('mobileartillery'),fly=enemy('flyer',200,0,100),ground=enemy('ravager',200,0,100);g.state.entities.units=[art];g.state.entities.enemies=[fly];assert.equal(findBestEnemyTarget(g,art,{range:540,minRange:125,targeting:'ground',inclusiveMax:true}),null);g.state.entities.enemies=[ground];assert.equal(findBestEnemyTarget(g,art,{range:540,minRange:125,targeting:'ground',inclusiveMax:true}),ground);
 const drone=unit('combatdrone');g.state.entities.units=[drone];g.state.entities.enemies=[fly];assert.equal(findBestEnemyTarget(g,drone,{range:225,targeting:'any'}),fly);g.state.entities.enemies=[ground];assert.equal(findBestEnemyTarget(g,drone,{range:225,targeting:'any'}),ground);
});

test('dead targets cannot be revived by heal/repair or damaged twice through player damage',()=>{
 const g=game(),dead=enemy('ravager',100,0,5);g.state.entities.enemies=[dead];const first=applyPlayerEnemyDamage(g,dead,10);const second=applyPlayerEnemyDamage(g,dead,10);assert.equal(first.destroyed,true);assert.equal(dead.hp,-5);assert.equal(second.applied,false);assert.equal(dead.hp,-5);
});

test('player-unit combat update does not execute or mutate tower attack cooldowns',()=>{
 const g=game(),tower={id:'tower',type:'railgun',x:0,y:0,hp:225,maxHp:225,built:true,cool:.37},t=enemy('ravager',100,0,100);
 g.state.entities.structures=[tower];g.state.entities.enemies=[t];
 const actions=updatePlayerUnitCombat(g,1);
 assert.equal(actions,0);assert.equal(tower.cool,.37);assert.equal(t.hp,100);assert.equal(g.state.entities.projectiles.length,0);
});
