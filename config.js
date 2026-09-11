// Alien Planet Defense - CONFIG
// ------------------------------------------------------------
// Main balance variables. Edit these values by hand to tune the game.
// Lower enemy values and higher defense values generally make the game easier.
// ------------------------------------------------------------

const CONFIG = {

  // ==========================================================
  // GENERAL RUN
  // ==========================================================
  GAME: {
    STARTING_CREDITS: 350,
    STARTING_BASE_HP: 250
  },

  // ==========================================================
  // LARGE WORLD / CAMERA
  // ==========================================================
  WORLD: {
    WIDTH: 3200,
    HEIGHT: 2400,
    BASE_RADIUS: 68,
    CAMERA_SPEED: 760
  },

  // ==========================================================
  // MULTI-WAVE RISK / REWARD
  // ==========================================================
  MULTI_WAVE: {
    BONUS_PER_EXTRA_ACTIVE_WAVE: 0.35
  },

  // ==========================================================
  // FIRE SQUADS
  // ==========================================================
  SOLDIER: {
    COST: 30,
    RANGE: 205,
    MEMBERS: 6,
    FIRE_INTERVAL: 0.48,
    DAMAGE: 1.35,
    BULLET_SPEED: 740,
    MOVE_SPEED: 155              // World pixels per second while moving to a clicked destination
  },

  LASER: { COST:70, RANGE:390, FIRE_INTERVAL:1.45, DAMAGE:68, BULLET_SPEED:1050 },
  FLAME: { COST:55, RANGE:155, FIRE_INTERVAL:0.11, BURN_TICK_DAMAGE:4.1, BURN_TICK_INTERVAL:0.28, BURN_DURATION:3.0 },
  BLOCKADE: { COST:20, HP:380, WIDTH:78, HEIGHT:22, ENEMY_DAMAGE_MULTIPLIER:0.48, COLLISION_SPEED_MULTIPLIER:0.12 },

  // ==========================================================
  // WAVE SIZE / SPAWNING
  // ==========================================================
  SPAWN: {
    BASE_ENEMIES_PER_WAVE:18,
    EXTRA_ENEMIES_PER_ABSOLUTE_WAVE:5,
    BASE_CLUSTER_SIZE:5,
    RANDOM_CLUSTER_SIZE:7,
    EXTRA_CLUSTER_SIZE_PER_TWO_WAVES:1,
    BASE_CLUSTER_DELAY:0.78,
    CLUSTER_DELAY_REDUCTION_PER_WAVE:0.006,
    MIN_CLUSTER_DELAY:0.34,
    SWARM_CHANCE:0.64,
    RUNNER_CHANCE_CUTOFF:0.94
  },

  // ==========================================================
  // ENEMIES
  // ==========================================================
  SWARM:{ BASE_HP:3.5, HP_PER_WAVE:0.32, BASE_SPEED:78, SPEED_PER_WAVE:0.9, RADIUS:4.7, BASE_DAMAGE:1, CREDIT_REWARD:4 },
  RUNNER:{ BASE_HP:5.5, HP_PER_WAVE:0.48, BASE_SPEED:108, SPEED_PER_WAVE:1.2, RADIUS:6.2, BASE_DAMAGE:2, CREDIT_REWARD:6 },
  BRUTE:{ BASE_HP:34, HP_PER_WAVE:3.0, BASE_SPEED:36, SPEED_PER_WAVE:0.45, RADIUS:14, BASE_DAMAGE:8, CREDIT_REWARD:22 },

  // ==========================================================
  // DEFENSE SURVIVABILITY
  // ==========================================================
  TOWER_DURABILITY:{ SOLDIER_HP:145, LASER_HP:180, FLAME_HP:165, MELEE_ATTACK_RANGE:20, MELEE_DAMAGE_MULTIPLIER:1.1 },
  SAFE_SPOT:{ COST:40, RADIUS:31, PLACEMENT_CLEARANCE:48 },

  // ==========================================================
  // RANGED ALIEN
  // ==========================================================
  RANGED_ALIEN:{
    SPAWN_CHANCE:0.025,
    BASE_HP:18,
    HP_PER_WAVE:1.4,
    BASE_SPEED:40,
    SPEED_PER_WAVE:0.35,
    RADIUS:10,
    BASE_DAMAGE:3,
    CREDIT_REWARD:15,
    ATTACK_RANGE:190,
    SHOT_DAMAGE:7,
    FIRE_INTERVAL:1.8,
    PROJECTILE_SPEED:285
  },

  TERRAIN:{ MIN_OBSTACLES:7, EXTRA_OBSTACLES_RANDOM:5, MIN_RADIUS:24, MAX_RADIUS:48, BUILD_CLEARANCE:9, ENEMY_STEER_STRENGTH:250, SPAWN_TOP_CLEARANCE:75, BASE_CLEARANCE:95 },
  CARD_RARITY:{ COMMON:58, UNCOMMON:28, RARE:11, EPIC:3 }
};
