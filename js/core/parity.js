import { BUILDING_CONFIG } from '../buildings/buildingConfig.js';
import { ECONOMY_CONFIG } from '../economy/economyConfig.js';
import { ENEMY_CONFIG } from '../enemies/enemyConfig.js';
import { GAME_CONFIG } from './config.js';
import { getTowerLevelStats, TOWER_CONFIG } from '../towers/towerConfig.js';
import { UNIT_CONFIG } from '../units/unitConfig.js';
import { nearlyEqual } from '../utils/math.js';

// Verification fixture only: these values were traced through the currently loaded
// legacy script order at Prompt 3. Runtime code must use the canonical registries,
// never this snapshot.
export const LEGACY_EFFECTIVE_SNAPSHOT = Object.freeze({
  units: {
    rifleman: [165,165,40,23,225,1.55,.50,'ground'], heavygunner:[220,155,75,24,190,1.10,.20,'ground'],
    rocketeer:[155,150,105,23,290,13,2.20,'ground'], medic:[140,160,80,22,165,null,null,'ground'],
    engineer:[150,165,70,22,120,null,null,'ground'], scout:[105,245,55,21,205,1.25,.42,'ground'],
    sniper:[112,145,95,21,445,27,2.05,'ground'], flametrooper:[175,145,90,22,130,1.5,.18,'ground'],
    spotter:[90,175,95,21,375,null,.32,'ground'], minelayer:[190,155,110,23,25,95,null,'ground'],
    mech:[680,105,300,29,270,8.5,.24,'ground'], combatdrone:[95,245,80,16,225,4.3,.38,'air'],
    combatship:[420,145,420,27,335,22,1.05,'air'], tank:[640,92,260,29,255,34,.82,'ground'],
    mobileartillery:[285,96,240,28,540,62,2.45,'ground'], repairvehicle:[330,138,155,27,150,null,null,'ground'],
    apc:[520,172,190,30,185,3.2,.23,'ground'], mgcar:[245,215,125,24,215,3,.16,'ground'],
    truck:[135,185,70,24,100,null,null,'ground'],
  },
  enemies: {
    ravager:[6,.55,70,.8,6,1.5,.30,'ground',.58,.55], swarm:[3.5,.35,78,1,4.7,1,.20,'ground',.58,.55],
    runner:[5.5,.5,108,1.3,6.2,2,.35,'ground',.58,.55], brute:[34,3.2,36,.5,14,8,1.25,'ground',.72,.64],
    spitter:[18,1.5,40,.4,10,3,.65,'ground',.68,.60], flyer:[13,1,92,.8,9,4,.75,'air',.68,.60],
    siegebeast:[175,16,24,.25,20,24,4,'ground',.86,.72], burrower:[19,1.6,58,.55,9,5,1,'ground',.68,.60],
    climber:[10,.8,82,.8,7,3,.55,'ground',.62,.58], acidlobber:[27,2.2,34,.35,11,4,1.4,'ground',.76,.66],
    crusher:[72,6,40,.4,15,9,2.4,'ground',.80,.68], harvesterhunter:[13,.9,122,1,8,6,.85,'ground',.62,.58],
    saboteur:[20,1.5,74,.65,8,10,1.25,'ground',.68,.60],
  },
  towers: {
    laser:[190,70,23,23,400,72,1.42,'any'], flame:[170,55,23,23,160,4.2,.11,'any'],
    railgun:[225,120,25,23,620,145,3.20,'any'], tesla:[210,95,24,23,250,21,.85,'any'],
    antiair:[180,65,23,23,370,14,.38,'air'], cryo:[205,80,23,23,235,5,.82,'any'],
    mortar:[195,105,24,23,520,42,2.35,'ground'], minigun:[220,85,23,23,245,5.5,.12,'any'],
    missile:[215,125,25,23,570,82,2.25,'any'], dronebay:[245,110,27,23,305,8,.56,'any'],
  },
  buildings: {
    base:{enabled:true,hp:300,cost:null,placementRadius:68,collisionRadius:68},
    mine:{enabled:true,hp:180,cost:{metal:45},placementRadius:34,collisionRadius:30,capacity:100},
    oremine:{enabled:true,hp:190,cost:{gold:20},placementRadius:34,collisionRadius:30,capacity:100},
    refinery:{enabled:true,hp:260,cost:{gold:35},placementRadius:38,collisionRadius:38,capacity:[260,440,700]},
    landingpad:{enabled:true,hp:330,cost:{gold:500},placementRadius:48,collisionRadius:48,capacity:[520,800,1200]},
    wall:{enabled:true,hp:null,cost:{metalPer100:11},placementRadius:6,collisionRadius:10,hpPer100:320},
    bunker:{enabled:false,hp:650,cost:{gold:220},placementRadius:35,collisionRadius:35},
    safespot:{enabled:false,hp:180,cost:{gold:50},placementRadius:31,collisionRadius:31},
    blockade:{enabled:false,hp:420,cost:{gold:22},placementRadius:42,collisionRadius:42},
  },
});

export const LEGACY_OVERRIDE_NOTES = Object.freeze([
  { field:'game.startingGold', earlier:650, current:125, owner:'v30.js' },
  { field:'game.startingMetal', earlier:160, current:0, owner:'v30.js' },
  { field:'economy.crystal.mineCost', earlier:95, current:45, owner:'v30.js' },
  { field:'economy.ore.mineCost', earlier:100, current:20, owner:'v30.js' },
  { field:'economy.refinery.cost', earlier:240, current:35, owner:'v30.js' },
  { field:'economy.crystal.goldPerExportedCrystal', earlier:2.2, current:4.0, owner:'v32.js' },
  { field:'camera.minZoom', earlier:0.42, current:0.18, owner:'v47.js/v51.js' },
  { field:'fog.cellSize', earlier:80, current:96, owner:'v47.js/v51.js' },
  { field:'director.enemySpeedMultiplier', earlier:0.50, current:0.30, owner:'v47.js' },
  { field:'enemy.acidlobber.acidAttack.damage', earlier:9, current:6.3, owner:'v47.js one-time tuning' },
  { field:'enemy.crusher.charge.damage', earlier:145, current:104.4, owner:'v47.js one-time tuning' },
  { field:'unit.mech.radius', earlier:28, current:29, owner:'v47.js/v53.js' },
  { field:'unit.combatdrone.radius', earlier:15, current:16, owner:'v47.js/v53.js' },
  { field:'unit.combatship.radius', earlier:26, current:27, owner:'v47.js/v53.js' },
  { field:'building.bunker.enabled', earlier:true, current:false, owner:'v47.js' },
  { field:'building.safespot.enabled', earlier:true, current:false, owner:'v21.js' },
  { field:'building.blockade.enabled', earlier:true, current:false, owner:'v15_patch.js (replaced by wall)' },
  { field:'unit.platoon purchasable entity', earlier:true, current:false, owner:'v29.js (control group only)' },
]);

function same(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return nearlyEqual(a, b, 1e-8);
  return JSON.stringify(a) === JSON.stringify(b);
}

function addMismatch(out, area, id, field, expected, actual) {
  if (!same(expected, actual)) out.push({ area, id, field, expected, actual });
}

function unitComparable(c) {
  return [
    c.maxHp, c.moveSpeed, c.cost.gold, c.radius,
    c.combat?.range ?? c.healing?.range ?? c.repair?.range ?? c.spotting?.range ?? c.mines?.triggerRadius ?? c.logistics?.pickupRange ?? null,
    c.combat?.damage ?? c.combat?.directDamage ?? c.mines?.damage ?? null,
    c.combat?.fireInterval ?? c.spotting?.refresh ?? null,
    c.traits.includes('air') ? 'air' : 'ground',
  ];
}

function enemyComparable(c) {
  return [c.baseHp,c.hpPerLevel,c.baseSpeed,c.speedPerLevel,c.radius,c.baseDamage,c.bountyGold,c.movement,c.horde.hp,c.horde.damage];
}

function towerComparable(c) {
  return [c.maxHp,c.cost.metal,c.placementRadius,c.collisionRadius,c.range,c.damage ?? c.burn?.tickDamage,c.fireInterval,c.targeting];
}

function compareArray(out, area, id, expected, actual, fields) {
  fields.forEach((field, i) => addMismatch(out, area, id, field, expected[i], actual[i]));
}

const TOWER_LEVEL_EXPECTED = Object.freeze({
  laser:{2:{range:460,damage:100.8,fireInterval:1.278,pierce:1},3:{range:500,damage:126,fireInterval:1.1644,pierce:2}},
  flame:{2:{range:185.6,fireInterval:.11,targets:2,burnDuration:3.565},3:{range:204.8,fireInterval:.099,targets:4,burnDuration:4.185}},
  railgun:{2:{range:713,damage:210.25,fireInterval:3.2,pierce:5,pierceWidth:20.16},3:{range:775,damage:268.25,fireInterval:2.624,pierce:7,pierceWidth:22.5}},
  tesla:{2:{range:285,damage:26.04,fireInterval:.85,chains:5,chainRange:129.6,chainDamageMultiplier:.80},3:{range:310,damage:31.92,fireInterval:.6205,chains:7,chainRange:139.2,chainDamageMultiplier:.86}},
  antiair:{2:{range:407,damage:15.12,fireInterval:.361,shots:2,splashRadius:0},3:{range:436.6,damage:17.08,fireInterval:.3344,shots:3,splashRadius:44}},
  cryo:{2:{range:277.3,damage:6.25,fireInterval:.779,slowFactor:.58,slowDuration:2.04,targets:2},3:{range:300.8,damage:9,fireInterval:.7052,slowFactor:.48,slowDuration:2.38,targets:4}},
  mortar:{2:{range:551.2,damage:54.6,fireInterval:2.209,splashRadius:92.16,clusters:0},3:{range:598,damage:69.3,fireInterval:2.021,splashRadius:97.2,clusters:3}},
  minigun:{2:{range:274.4,damage:6.6,fireInterval:.09,barrels:1},3:{range:298.9,damage:7.975,fireInterval:.0864,barrels:2}},
  missile:{2:{range:672.6,damage:110.7,fireInterval:2.115,splashRadius:102.5,salvo:1},3:{range:729.6,damage:127.1,fireInterval:1.845,splashRadius:110.7,salvo:2}},
  dronebay:{2:{range:350.75,damage:10,fireInterval:.5264,drones:2},3:{range:390.4,damage:11.6,fireInterval:.4592,drones:3}},
});

export function compareConfigParity() {
  const mismatches = [];
  for (const [id, expected] of Object.entries(LEGACY_EFFECTIVE_SNAPSHOT.units)) {
    compareArray(mismatches, 'unit', id, expected, unitComparable(UNIT_CONFIG[id]), ['hp','speed','cost','radius','range','damage','fireInterval','movement']);
  }
  for (const [id, expected] of Object.entries(LEGACY_EFFECTIVE_SNAPSHOT.enemies)) {
    compareArray(mismatches, 'enemy', id, expected, enemyComparable(ENEMY_CONFIG[id]), ['baseHp','hpPerLevel','baseSpeed','speedPerLevel','radius','baseDamage','bountyGold','movement','hordeHpMultiplier','hordeDamageMultiplier']);
  }
  for (const [id, expected] of Object.entries(LEGACY_EFFECTIVE_SNAPSHOT.towers)) {
    compareArray(mismatches, 'tower', id, expected, towerComparable(TOWER_CONFIG[id]), ['hp','cost','placementRadius','collisionRadius','range','damage','fireInterval','targeting']);
    for (const level of [2,3]) {
      const actual = getTowerLevelStats(id, level), levelExpected = TOWER_LEVEL_EXPECTED[id][level];
      for (const [field, value] of Object.entries(levelExpected)) addMismatch(mismatches, 'towerUpgrade', `${id}:${level}`, field, value, actual[field]);
    }
  }
  for (const [id, expected] of Object.entries(LEGACY_EFFECTIVE_SNAPSHOT.buildings)) {
    const c = BUILDING_CONFIG[id];
    addMismatch(mismatches,'building',id,'enabled',expected.enabled,c.enabled);
    addMismatch(mismatches,'building',id,'hp',expected.hp,c.maxHp);
    addMismatch(mismatches,'building',id,'cost',expected.cost,c.cost);
    addMismatch(mismatches,'building',id,'placementRadius',expected.placementRadius,c.placementRadius);
    addMismatch(mismatches,'building',id,'collisionRadius',expected.collisionRadius,c.collisionRadius);
    if ('capacity' in expected) addMismatch(mismatches,'building',id,'capacity',expected.capacity,c.storage?.levels ?? c.storageCapacity);
    if ('hpPer100' in expected) addMismatch(mismatches,'building',id,'hpPer100',expected.hpPer100,c.wall?.hpPer100);
  }

  addMismatch(mismatches,'game','game','startingGold',125,GAME_CONFIG.game.startingGold);
  addMismatch(mismatches,'game','game','startingMetal',0,GAME_CONFIG.game.startingMetal);
  addMismatch(mismatches,'game','camera','minZoom',.18,GAME_CONFIG.camera.minZoom);
  addMismatch(mismatches,'game','camera','defaultZoom',.65,GAME_CONFIG.camera.defaultZoom);
  addMismatch(mismatches,'game','director','enemySpeedMultiplier',.30,GAME_CONFIG.director.enemySpeedMultiplier);
  addMismatch(mismatches,'game','fog','cellSize',96,GAME_CONFIG.fog.cellSize);
  addMismatch(mismatches,'economy','crystal','goldPerExportedCrystal',4,ECONOMY_CONFIG.crystal.goldPerExportedCrystal);
  addMismatch(mismatches,'enemySpecial','acidlobber','damage',6.3,ENEMY_CONFIG.acidlobber.acidAttack.damage);
  addMismatch(mismatches,'enemySpecial','crusher','chargeDamage',104.4,ENEMY_CONFIG.crusher.charge.damage);

  return Object.freeze({ ok: mismatches.length === 0, mismatches: Object.freeze(mismatches) });
}
