// Alien Planet Defense - CONFIG
// ------------------------------------------------------------
// Edit this file to rebalance the game without touching game.js.
// All values below are plain JavaScript variables grouped by system.
//
// Tip:
// - Higher damage = stronger weapons
// - Lower fire interval = faster firing
// - Higher speed = faster movement
// - Higher cost = more expensive defenses
// ------------------------------------------------------------

const CONFIG = {

  // ==========================================================
  // GENERAL GAME / STAGES
  // ==========================================================
  GAME: {
    STARTING_CREDITS: 180,
    STARTING_BASE_HP: 100,
    WAVES_PER_STAGE: 3,
    STAGE_CLEAR_BONUS: 75,
    STAGE_CLEAR_BONUS_PER_STAGE: 10
  },

  // ==========================================================
  // LARGE WORLD / CAMERA
  // ==========================================================
  WORLD: {
    WIDTH: 3200,                 // Total map width in world pixels
    HEIGHT: 2400,                // Total map height in world pixels
    BASE_RADIUS: 68,             // Temporary circular base radius
    CAMERA_SPEED: 760            // Arrow-key camera pan speed
  },

  // ==========================================================
  // MULTI-WAVE BONUS
  // ==========================================================
  MULTI_WAVE: {
    BONUS_PER_EXTRA_ACTIVE_WAVE: 0.25
  },

  SOLDIER: { COST:40, RANGE:175, MEMBERS:6, FIRE_INTERVAL:0.56, DAMAGE:0.95, BULLET_SPEED:700 },
  LASER: { COST:90, RANGE:340, FIRE_INTERVAL:1.65, DAMAGE:52, BULLET_SPEED:1000 },
  FLAME: { COST:70, RANGE:130, FIRE_INTERVAL:0.12, BURN_TICK_DAMAGE:3.2, BURN_TICK_INTERVAL:0.28, BURN_DURATION:2.6 },
  BLOCKADE: { COST:30, HP:240, WIDTH:78, HEIGHT:22, ENEMY_DAMAGE_MULTIPLIER:0.72, COLLISION_SPEED_MULTIPLIER:0.14 },

  ROVER: {
    MOVE_SPEED:245,
    STARTING_WEAPON:"pistol",
    PISTOL:{ RANGE:240, DAMAGE:5, FIRE_INTERVAL:0.42, BULLET_SPEED:760 },
    TWIN:{ RANGE:240, DAMAGE_MULTIPLIER:0.8, FIRE_INTERVAL:0.32, BULLET_SPEED:780 },
    SHOTGUN:{ RANGE:155, PELLETS:5, DAMAGE_MULTIPLIER_PER_PELLET:0.7, FIRE_INTERVAL:0.62, BULLET_SPEED:680, SPREAD_RADIANS:0.30 },
    PULSE:{ RANGE:240, DAMAGE_MULTIPLIER:1.8, FIRE_INTERVAL:0.20, BULLET_SPEED:900 }
  },

  SPAWN: {
    BASE_ENEMIES_PER_WAVE:34,
    EXTRA_ENEMIES_PER_ABSOLUTE_WAVE:16,
    BASE_CLUSTER_SIZE:9,
    RANDOM_CLUSTER_SIZE:13,
    EXTRA_CLUSTER_SIZE_PER_TWO_WAVES:1,
    BASE_CLUSTER_DELAY:0.62,
    CLUSTER_DELAY_REDUCTION_PER_WAVE:0.01,
    MIN_CLUSTER_DELAY:0.22,
    SWARM_CHANCE:0.60,
    RUNNER_CHANCE_CUTOFF:0.91
  },

  SWARM:{ BASE_HP:4, HP_PER_WAVE:0.68, BASE_SPEED:98, SPEED_PER_WAVE:2.7, RADIUS:4.7, BASE_DAMAGE:2, CREDIT_REWARD:3 },
  RUNNER:{ BASE_HP:6.5, HP_PER_WAVE:0.9, BASE_SPEED:140, SPEED_PER_WAVE:3.0, RADIUS:6.2, BASE_DAMAGE:3, CREDIT_REWARD:4 },
  BRUTE:{ BASE_HP:42, HP_PER_WAVE:6.5, BASE_SPEED:46, SPEED_PER_WAVE:1.1, RADIUS:14, BASE_DAMAGE:15, CREDIT_REWARD:16 },

  TOWER_DURABILITY:{ SOLDIER_HP:85, LASER_HP:110, FLAME_HP:100, MELEE_ATTACK_RANGE:20, MELEE_DAMAGE_MULTIPLIER:2.0 },
  SAFE_SPOT:{ COST:60, RADIUS:31, PLACEMENT_CLEARANCE:48 },
  RANGED_ALIEN:{ SPAWN_CHANCE:0.055, BASE_HP:24, HP_PER_WAVE:2.8, BASE_SPEED:48, SPEED_PER_WAVE:0.8, RADIUS:10, BASE_DAMAGE:5, CREDIT_REWARD:12, ATTACK_RANGE:210, SHOT_DAMAGE:12, FIRE_INTERVAL:1.45, PROJECTILE_SPEED:310 },
  TERRAIN:{ MIN_OBSTACLES:7, EXTRA_OBSTACLES_RANDOM:5, MIN_RADIUS:24, MAX_RADIUS:48, BUILD_CLEARANCE:9, ENEMY_STEER_STRENGTH:250, SPAWN_TOP_CLEARANCE:75, BASE_CLEARANCE:95 },
  CARD_RARITY:{ COMMON:58, UNCOMMON:28, RARE:11, EPIC:3 }
};
