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
    STARTING_CREDITS: 180,       // Credits available at the start of a run
    STARTING_BASE_HP: 100,       // Base HP at the start of a run
    WAVES_PER_STAGE: 3,          // Number of waves in each stage before the stage changes
    STAGE_CLEAR_BONUS: 75,       // Flat credits awarded when entering a new stage
    STAGE_CLEAR_BONUS_PER_STAGE: 10 // Extra credits per stage number
  },

  // ==========================================================
  // MULTI-WAVE BONUS
  // ==========================================================
  MULTI_WAVE: {
    BONUS_PER_EXTRA_ACTIVE_WAVE: 0.25
    // 0.25 = +25% credits per additional active wave.
    // Example:
    // 1 active wave = +0%
    // 2 active waves = +25%
    // 3 active waves = +50%
  },

  // ==========================================================
  // SOLDIER SQUAD
  // ==========================================================
  SOLDIER: {
    COST: 40,
    RANGE: 175,
    MEMBERS: 6,                  // Starting soldiers in each squad
    FIRE_INTERVAL: 0.56,         // Seconds between shots for each soldier
    DAMAGE: 0.95,                // Damage per soldier bullet
    BULLET_SPEED: 700
  },

  // ==========================================================
  // LASER SNIPER
  // ==========================================================
  LASER: {
    COST: 90,
    RANGE: 340,
    FIRE_INTERVAL: 1.65,         // Higher = slower
    DAMAGE: 52,
    BULLET_SPEED: 1000
  },

  // ==========================================================
  // FLAMETHROWER
  // ==========================================================
  FLAME: {
    COST: 70,
    RANGE: 130,
    FIRE_INTERVAL: 0.12,
    BURN_TICK_DAMAGE: 3.2,
    BURN_TICK_INTERVAL: 0.28,
    BURN_DURATION: 2.6
  },

  // ==========================================================
  // BLOCKADE
  // ==========================================================
  BLOCKADE: {
    COST: 30,
    HP: 240,
    WIDTH: 78,
    HEIGHT: 22,
    ENEMY_DAMAGE_MULTIPLIER: 0.72, // How strongly aliens damage a blockade while colliding
    COLLISION_SPEED_MULTIPLIER: 0.14 // How much enemies slow while pushing against one
  },

  // ==========================================================
  // ROVER / PLAYER VEHICLE
  // ==========================================================
  ROVER: {
    MOVE_SPEED: 245,
    STARTING_WEAPON: "pistol",

    PISTOL: {
      RANGE: 240,
      DAMAGE: 5,
      FIRE_INTERVAL: 0.42,
      BULLET_SPEED: 760
    },

    TWIN: {
      RANGE: 240,
      DAMAGE_MULTIPLIER: 0.8,
      FIRE_INTERVAL: 0.32,
      BULLET_SPEED: 780
    },

    SHOTGUN: {
      RANGE: 155,
      PELLETS: 5,
      DAMAGE_MULTIPLIER_PER_PELLET: 0.7,
      FIRE_INTERVAL: 0.62,
      BULLET_SPEED: 680,
      SPREAD_RADIANS: 0.30
    },

    PULSE: {
      RANGE: 240,
      DAMAGE_MULTIPLIER: 1.8,
      FIRE_INTERVAL: 0.20,
      BULLET_SPEED: 900
    }
  },

  // ==========================================================
  // ENEMY HORDE SIZE / SPAWNING
  // ==========================================================
  SPAWN: {
    BASE_ENEMIES_PER_WAVE: 34,
    EXTRA_ENEMIES_PER_ABSOLUTE_WAVE: 16,

    BASE_CLUSTER_SIZE: 9,
    RANDOM_CLUSTER_SIZE: 13,
    EXTRA_CLUSTER_SIZE_PER_TWO_WAVES: 1,

    BASE_CLUSTER_DELAY: 0.62,
    CLUSTER_DELAY_REDUCTION_PER_WAVE: 0.01,
    MIN_CLUSTER_DELAY: 0.22,

    SWARM_CHANCE: 0.60,
    RUNNER_CHANCE_CUTOFF: 0.91
    // Meaning:
    // random < 0.60 => swarm
    // random < 0.91 => runner
    // otherwise => brute
  },

  // ==========================================================
  // SWARM ALIEN
  // ==========================================================
  SWARM: {
    BASE_HP: 4,
    HP_PER_WAVE: 0.68,
    BASE_SPEED: 98,
    SPEED_PER_WAVE: 2.7,
    RADIUS: 4.7,
    BASE_DAMAGE: 2,
    CREDIT_REWARD: 3
  },

  // ==========================================================
  // RUNNER ALIEN
  // ==========================================================
  RUNNER: {
    BASE_HP: 6.5,
    HP_PER_WAVE: 0.9,
    BASE_SPEED: 140,
    SPEED_PER_WAVE: 3.0,
    RADIUS: 6.2,
    BASE_DAMAGE: 3,
    CREDIT_REWARD: 4
  },

  // ==========================================================
  // BRUTE ALIEN
  // ==========================================================
  BRUTE: {
    BASE_HP: 42,
    HP_PER_WAVE: 6.5,
    BASE_SPEED: 46,
    SPEED_PER_WAVE: 1.1,
    RADIUS: 14,
    BASE_DAMAGE: 15,
    CREDIT_REWARD: 16
  },

  // ==========================================================
  // TOWER DURABILITY / MONSTER ATTACKS
  // ==========================================================
  TOWER_DURABILITY: {
    SOLDIER_HP: 85,              // Hit points for a Soldier Squad
    LASER_HP: 110,               // Hit points for a Laser Sniper
    FLAME_HP: 100,               // Hit points for a Flamethrower

    MELEE_ATTACK_RANGE: 20,      // How close a normal alien must get before attacking a tower
    MELEE_DAMAGE_MULTIPLIER: 2.0 // Multiplies an alien's normal BASE_DAMAGE while hitting towers
  },

  // ==========================================================
  // TOWER SAFE SPOT
  // ==========================================================
  SAFE_SPOT: {
    COST: 60,                    // Cost to place a protected tower pad
    RADIUS: 31,                  // Tower snaps to pad center when placed inside this radius
    PLACEMENT_CLEARANCE: 48      // Minimum separation between safe spots
    // A tower on a Safe Spot cannot be attacked by normal melee monsters.
    // Ranged monsters can still target and destroy it.
  },

  // ==========================================================
  // RANGED ALIEN ("SPITTER")
  // ==========================================================
  RANGED_ALIEN: {
    SPAWN_CHANCE: 0.055,         // Chance each spawned alien becomes a ranged alien
    BASE_HP: 24,
    HP_PER_WAVE: 2.8,
    BASE_SPEED: 48,
    SPEED_PER_WAVE: 0.8,
    RADIUS: 10,
    BASE_DAMAGE: 5,              // Damage to the base if it reaches the bottom
    CREDIT_REWARD: 12,

    ATTACK_RANGE: 210,           // Can fire at towers inside this range
    SHOT_DAMAGE: 12,             // Damage per ranged projectile against towers
    FIRE_INTERVAL: 1.45,         // Seconds between shots
    PROJECTILE_SPEED: 310
    // Ranged aliens can target ordinary towers, blockades, AND towers on Safe Spots.
  },

  // ==========================================================
  // NATURAL TERRAIN
  // ==========================================================
  TERRAIN: {
    MIN_OBSTACLES: 7,            // Minimum rocks/crystals per stage
    EXTRA_OBSTACLES_RANDOM: 5,   // Adds 0..this many additional obstacles
    MIN_RADIUS: 24,
    MAX_RADIUS: 48,
    BUILD_CLEARANCE: 9,          // Extra no-build margin around each terrain obstacle
    ENEMY_STEER_STRENGTH: 250,   // Higher makes enemies turn around rocks more aggressively
    SPAWN_TOP_CLEARANCE: 75,     // Keep terrain away from the very top spawn edge
    BASE_CLEARANCE: 95           // Keep terrain away from the defended base line
  },

  // ==========================================================
  // CARD RARITY WEIGHTS
  // ==========================================================
  CARD_RARITY: {
    COMMON: 58,
    UNCOMMON: 28,
    RARE: 11,
    EPIC: 3
    // These should add up to 100 for intuitive percentages.
  }
};
