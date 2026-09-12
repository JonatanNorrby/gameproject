import test from 'node:test';
import assert from 'node:assert/strict';
import { TOWER_CONFIG, getTowerConfig } from '../js/towers/towerConfig.js';
import { assertTowerCombatCoverage, updateTowerCombat } from '../js/combat/towerCombat.js';
import { getEffectiveTowerStats } from '../js/combat/towerStats.js';
import { findTowerTarget } from '../js/combat/towerTargeting.js';

function createGame() {
  return {
    config: { enemies: {} },
    state: {
      entities: { structures: [], enemies: [], projectiles: [], effects: [] },
      modifiers: { laserRate: 1, burnDuration: 1 },
    },
    services: { random: () => 0.5, now: () => 850 },
  };
}

function createTower(type, level = 1) {
  const definition = getTowerConfig(type);
  return { id: `tower-${type}`, type, x: 0, y: 0, hp: definition.maxHp, maxHp: definition.maxHp, built: true, level, cool: 0 };
}

function createEnemy(type = 'ravager', x = 100, y = 0, hp = 1000) {
  return { id: `enemy-${type}-${x}-${y}-${Math.random()}`, type, x, y, hp, maxHp: hp, r: type === 'flyer' ? 9 : 6, burn: 0, burnTick: 0, slowFactor: 1, slowTime: 0, markTime: 0, markMult: 1 };
}

function nearly(actual, expected, epsilon = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);
}

test('every canonical tower has one clean combat handler', () => {
  assert.equal(assertTowerCombatCoverage(), true);
  assert.equal(Object.keys(TOWER_CONFIG).length, 10);
});

const levelExpectations = {
  laser: [[400, 72, 1.42, 0], [460, 100.8, 1.278, 45], [500, 126, 1.1644, 70]],
  flame: [[160, undefined, .11, 0], [185.6, undefined, .11, 35], [204.8, undefined, .099, 55]],
  railgun: [[620, 145, 3.2, 0], [713, 210.25, 3.2, 75], [775, 268.25, 2.624, 115]],
  tesla: [[250, 21, .85, 0], [285, 26.04, .85, 60], [310, 31.92, .6205, 90]],
  antiair: [[370, 14, .38, 0], [407, 15.12, .361, 40], [436.6, 17.08, .3344, 65]],
  cryo: [[235, 5, .82, 0], [277.3, 6.25, .779, 50], [300.8, 9, .7052, 75]],
  mortar: [[520, 42, 2.35, 0], [551.2, 54.6, 2.209, 65], [598, 69.3, 2.021, 95]],
  minigun: [[245, 5.5, .12, 0], [274.4, 6.6, .09, 55], [298.9, 7.975, .0864, 80]],
  missile: [[570, 82, 2.25, 0], [672.6, 110.7, 2.115, 75], [729.6, 127.1, 1.845, 105]],
  dronebay: [[305, 8, .56, 0], [350.75, 10, .5264, 70], [390.4, 11.6, .4592, 100]],
};

for (const [type, levels] of Object.entries(levelExpectations)) {
  test(`${type} effective stats match legacy levels 1/3, 2/3 and 3/3`, () => {
    for (let level = 1; level <= 3; level++) {
      const stats = getEffectiveTowerStats(createTower(type, level));
      const expected = levels[level - 1];
      nearly(stats.range, expected[0]);
      if (expected[1] !== undefined) nearly(stats.damage, expected[1]);
      nearly(stats.fireInterval, expected[2]);
      assert.equal(stats.upgradeCost, expected[3]);
      assert.equal(stats.level, level);
      assert.equal(stats.maxLevel, 3);
    }
  });
}

test('Laser upgrade semantics are 1 target, 1 target, then 2-target prism', () => {
  assert.equal(getEffectiveTowerStats(createTower('laser', 1)).pierce, 1);
  assert.equal(getEffectiveTowerStats(createTower('laser', 2)).pierce, 1);
  assert.equal(getEffectiveTowerStats(createTower('laser', 3)).pierce, 2);
});

test('Anti-Air accepts Flyer and rejects ground enemy', () => {
  const game = createGame(), tower = createTower('antiair'), flyer = createEnemy('flyer'), ground = createEnemy('ravager');
  game.state.entities.structures = [tower];
  game.state.entities.enemies = [ground, flyer];
  assert.equal(findTowerTarget(game, tower, { stats: getEffectiveTowerStats(tower), targeting: 'air', inclusiveMax: true, replaceOnEqual: true }), flyer);
  game.state.entities.enemies = [ground];
  assert.equal(findTowerTarget(game, tower, { stats: getEffectiveTowerStats(tower), targeting: 'air', inclusiveMax: true }), null);
});

test('dual-target Laser accepts both ground and flying enemies', () => {
  const game = createGame(), tower = createTower('laser'), ground = createEnemy('ravager'), flyer = createEnemy('flyer', 120);
  game.state.entities.structures = [tower];
  game.state.entities.enemies = [ground];
  assert.equal(findTowerTarget(game, tower, { stats: getEffectiveTowerStats(tower), targeting: 'any', inclusiveMax: false }), ground);
  game.state.entities.enemies = [flyer];
  assert.equal(findTowerTarget(game, tower, { stats: getEffectiveTowerStats(tower), targeting: 'any', inclusiveMax: false }), flyer);
});

test('Laser 1/3 emits current projectile while Laser 3/3 resolves prism line', () => {
  const game = createGame(), level1 = createTower('laser'), enemy = createEnemy();
  game.state.entities.structures = [level1]; game.state.entities.enemies = [enemy];
  assert.equal(updateTowerCombat(game, 0), 1);
  assert.equal(game.state.entities.projectiles.length, 1);
  assert.equal(game.state.entities.projectiles[0].dmg, 72);
  assert.equal(level1.cool, 1.42);
  const game3 = createGame(), level3 = createTower('laser', 3), a = createEnemy('ravager', 100), b = createEnemy('ravager', 200);
  game3.state.entities.structures = [level3]; game3.state.entities.enemies = [a, b];
  updateTowerCombat(game3, 0);
  assert.equal(a.hp, 874); assert.equal(b.hp, 874); assert.equal(game3.state.entities.projectiles.length, 0);
});

test('Flame applies burn without immediate direct damage', () => {
  const game = createGame(), tower = createTower('flame'), enemy = createEnemy();
  game.state.entities.structures = [tower]; game.state.entities.enemies = [enemy];
  updateTowerCombat(game, 0);
  assert.equal(enemy.hp, 1000); nearly(enemy.burn, 3.1); nearly(tower.cool, .11);
});

test('Railgun preserves nearest-line penetration count and damage', () => {
  const game = createGame(), tower = createTower('railgun'), enemies = [100, 200, 300, 400].map(x => createEnemy('ravager', x));
  game.state.entities.structures = [tower]; game.state.entities.enemies = enemies;
  updateTowerCombat(game, 0);
  assert.deepEqual(enemies.map(enemy => enemy.hp), [855, 855, 855, 1000]);
});

test('Tesla preserves chained decaying damage', () => {
  const game = createGame(), tower = createTower('tesla'), enemies = [100, 200, 300, 400].map(x => createEnemy('ravager', x));
  game.state.entities.structures = [tower]; game.state.entities.enemies = enemies;
  updateTowerCombat(game, 0);
  nearly(enemies[0].hp, 979);
  assert.ok(enemies.slice(1).every(enemy => enemy.hp < 1000));
});

test('Anti-Air 3/3 fires three rounds and flak damages nearby Flyers only', () => {
  const game = createGame(), tower = createTower('antiair', 3), first = createEnemy('flyer', 100), second = createEnemy('flyer', 120), ground = createEnemy('ravager', 120);
  game.state.entities.structures = [tower]; game.state.entities.enemies = [first, second, ground];
  updateTowerCombat(game, 0);
  assert.equal(game.state.entities.projectiles.length, 3);
  assert.ok(second.hp < 1000); assert.equal(ground.hp, 1000);
});

test('Cryo 3/3 damages and slows four nearest valid targets', () => {
  const game = createGame(), tower = createTower('cryo', 3), enemies = [100, 120, 140, 160, 180].map((x, i) => createEnemy(i === 1 ? 'flyer' : 'ravager', x));
  game.state.entities.structures = [tower]; game.state.entities.enemies = enemies;
  updateTowerCombat(game, 0);
  assert.equal(enemies.filter(enemy => enemy.hp === 991).length, 4);
  assert.equal(enemies.filter(enemy => enemy.slowFactor === .48).length, 4);
});

test('Mortar preserves minimum range, ground-only target/splash and current cooldown', () => {
  const game = createGame(), tower = createTower('mortar'), close = createEnemy('ravager', 80), ground = createEnemy('ravager', 200), flyer = createEnemy('flyer', 205);
  game.state.entities.structures = [tower]; game.state.entities.enemies = [close, ground, flyer];
  updateTowerCombat(game, 0);
  assert.equal(close.hp, 1000); assert.equal(ground.hp, 958); assert.equal(flyer.hp, 1000); nearly(tower.cool, 2.35);
});

test('Minigun 3/3 emits two current-speed/current-damage rounds per update', () => {
  const game = createGame(), tower = createTower('minigun', 3), enemy = createEnemy();
  game.state.entities.structures = [tower]; game.state.entities.enemies = [enemy];
  updateTowerCombat(game, 0);
  assert.equal(game.state.entities.projectiles.length, 2);
  nearly(game.state.entities.projectiles[0].dmg, 7.975);
  nearly(Math.hypot(game.state.entities.projectiles[0].vx, game.state.entities.projectiles[0].vy), 900);
});

test('Missile 3/3 preserves two-target salvo and overlapping immediate splash', () => {
  const game = createGame(), tower = createTower('missile', 3), first = createEnemy('ravager', 100), second = createEnemy('flyer', 120);
  game.state.entities.structures = [tower]; game.state.entities.enemies = [first, second];
  updateTowerCombat(game, 0);
  assert.ok(first.hp < 1000 - 127.1); assert.ok(second.hp < 1000 - 127.1);
});

test('Drone Bay 3/3 emits from three moving orbit points rather than spawning persistent drones', () => {
  const game = createGame(), tower = createTower('dronebay', 3), enemy = createEnemy();
  game.state.entities.structures = [tower]; game.state.entities.enemies = [enemy];
  updateTowerCombat(game, 0);
  assert.equal(game.state.entities.projectiles.length, 3);
  nearly(tower.cool, .4592);
  for (const projectile of game.state.entities.projectiles) nearly(Math.hypot(projectile.x, projectile.y), 34);
});

test('Scout/Spotter mark multiplier is reused by direct tower hits', () => {
  const game = createGame(), tower = createTower('railgun'), enemy = createEnemy('ravager', 100);
  enemy.markTime = 1; enemy.markMult = 1.2;
  game.state.entities.structures = [tower]; game.state.entities.enemies = [enemy];
  updateTowerCombat(game, 0);
  assert.equal(enemy.hp, 826);
});

test('tower cooldown prevents duplicate firing before ready', () => {
  const game = createGame(), tower = createTower('minigun'), enemy = createEnemy();
  game.state.entities.structures = [tower]; game.state.entities.enemies = [enemy];
  updateTowerCombat(game, 0); updateTowerCombat(game, .01);
  assert.equal(game.state.entities.projectiles.length, 1);
});
