export default {
  // === DISPLAY ===
  CANVAS_WIDTH: 960,
  CANVAS_HEIGHT: 540,
  TILE_SIZE: 32,
  MAP_WIDTH_TILES: 40,
  MAP_HEIGHT_TILES: 24,

  // === GAME ===
  GAME_DURATION: 600, // 10 minutes in seconds

  // === PLAYER ===
  PLAYER_SPEED: 160, // px/sec
  PLAYER_SPRINT_MULTIPLIER: 1.6,
  PLAYER_STAMINA_MAX: 100,
  PLAYER_STAMINA_DRAIN: 20, // per second while sprinting
  PLAYER_STAMINA_REGEN: 15, // per second while not sprinting (was 12 — too slow)
  PLAYER_TASK_CAPACITY: 3,
  PLAYER_PICKUP_RADIUS: 36, // px (was 28 — felt too tight)
  PLAYER_DELIVERY_RADIUS: 0, // 0 = zone overlap (handled by Arcade Physics overlap)

  // === TASKS ===
  TASK_SPAWN_INTERVAL_BASE: 6000, // ms at game start (was 5000 — slower early ramp)
  TASK_SPAWN_INTERVAL_MIN: 2500, // ms at game end (was 1500)
  TASK_SPAWN_RAMP: 'linear', // 'linear' or 'exponential'
  TASK_MAX_ON_MAP: 15, // hard cap (was 25 — too much clutter)
  TASK_WARNING_TIME: 45000, // ms before flashing
  TASK_EXPIRY_TIME: 60000, // ms before despawn
  TASK_EXPIRY_STRESS: 2, // % stress on expiry (was 3 — clusters punished too hard)

  // === TASK XP ===
  TASK_XP_SINGLE_BASE: 20, // +5 per tier
  TASK_XP_MULTI_2_BASE: 45, // +10 per tier above Manager
  TASK_XP_MULTI_3_BASE: 80, // +10 per tier above Director

  // === TASK STRESS RELIEF ===
  TASK_RELIEF_SINGLE: 7, // % (was 5 — deliveries must feel rewarding)
  TASK_RELIEF_MULTI_2: 11, // % (was 8)
  TASK_RELIEF_MULTI_3: 16, // % (was 12)

  // === STRESS ===
  STRESS_MAX: 100,
  STRESS_RATE_INTERN: 0.02, // %/sec per undelivered task (was 0.03 — ~30% reduction)
  STRESS_RATE_ASSOCIATE: 0.035, // was 0.05
  STRESS_RATE_MANAGER: 0.055, // was 0.08
  STRESS_RATE_DIRECTOR: 0.08, // was 0.11
  STRESS_RATE_CEO: 0.10, // was 0.15
  STRESS_MEETING_BLOCK: 3, // instant %
  STRESS_DECOY_PICKUP: 4, // instant % (was 2 — doubled to punish decoy mistakes)
  STRESS_PASSIVE_DECAY_THRESHOLD: 50, // % stress above which passive decay kicks in
  STRESS_PASSIVE_DECAY_RATE: 0.5, // %/sec base passive decay (safety net)
  STRESS_BALL_DECAY_BONUS: 1.0, // extra %/sec from Stress Ball upgrade (stacks with base)
  STRESS_VISUAL_YELLOW: 40, // threshold %
  STRESS_VISUAL_ORANGE: 65,
  STRESS_VISUAL_RED: 85,

  // === CHAOS AGENTS: SHARED ===
  AGENT_ARRIVAL_THRESHOLD: 8, // px — distance to consider "arrived" at target
  AGENT_STUCK_THRESHOLD: 2, // px — distance moved below which agent is "stuck"
  AGENT_STUCK_CHECK_INTERVAL: 500, // ms between stuck checks
  AGENT_STUCK_IDLE_DURATION: 500, // ms to idle when stuck before retrying
  AGENT_STUCK_MAX_RETRIES: 3,       // nudge attempts before calling onStuck()
  AGENT_STUCK_NUDGE_DURATION: 400,  // ms to move perpendicular when stuck
  AGENT_PERPENDICULAR_SPEED_FACTOR: 0.5, // secondary axis speed when navigating around obstacles
  AGENT_WANDER_DIR_CHANGE_MIN: 2000, // ms min between wander direction changes
  AGENT_WANDER_DIR_CHANGE_MAX: 4000, // ms max between wander direction changes
  AGENT_SPEECH_INTERVAL_MIN: 12000, // ms min between periodic speech bubbles
  AGENT_SPEECH_INTERVAL_MAX: 20000, // ms max between periodic speech bubbles
  AGENT_SPEECH_DURATION: 3000, // ms speech bubble stays visible
  AGENT_INFO_PANEL_DURATION: 3000, // ms info panel stays visible on first spawn
  AGENT_WANDER_STUCK_THRESHOLD: 1.5, // px — per-frame movement below this = stuck
  AGENT_WANDER_STUCK_TIME: 300,      // ms — force direction change after stuck this long
  AGENT_WANDER_SEEK_CHANCE: 0.35,    // probability of picking player-facing direction

  // === CHAOS AGENTS: MICROMANAGER ===
  MICROMANAGER_SPEED: 110,
  MICROMANAGER_SLOW_FACTOR: 0.6,
  MICROMANAGER_RANGE: 96, // px (was 80 — slightly harder to dodge)
  MICROMANAGER_STRESS_RATE: 0.3, // %/sec while player is slowed

  // === CHAOS AGENTS: REPLY-ALL GUY ===
  REPLYALL_SPEED: 65,
  REPLYALL_TASK_BURST: 4, // was 3 — more pressure per burst
  REPLYALL_COOLDOWN: 8000, // was 10000 — more frequent bursts
  REPLYALL_TASK_XP_MULT: 0.5, // 50% XP for Reply-All "junk mail" tasks
  REPLYALL_TASK_EXPIRY_TIME: 30000, // ms — half normal expiry for junk mail
  REPLYALL_TASK_EXPIRY_STRESS: 4, // % stress on junk mail expiry (doubled)
  REPLYALL_OVERCAP: 2, // tasks allowed above TASK_MAX_ON_MAP
  REPLYALL_MIN_SPAWN_DIST: 160, // px from player (5 tiles)
  REPLYALL_PAUSE_DURATION: 1000, // ms pause at desk before bursting
  REPLYALL_BURST_PARTICLE_COUNT: 6, // email burst visual particles
  REPLYALL_BURST_ANIMATION_DURATION: 600, // ms particle animation
  REPLYALL_NEAR_PLAYER_COUNT: 3, // pick target desk from N nearest to player

  // === CHAOS AGENTS: MEETING SCHEDULER ===
  MEETING_SCHEDULER_SPEED: 75,
  MEETING_BLOCK_DURATION: 12000,
  MEETING_COOLDOWN: 20000,
  MEETING_IDLE_CHECK_INTERVAL: 2000, // ms to wait before re-checking departments

  // === CHAOS AGENTS: CHATTY COLLEAGUE ===
  CHATTY_SPEED: 75,
  CHATTY_FREEZE_DURATION: 2500,
  CHATTY_COOLDOWN: 6000,
  CHATTY_FREEZE_OVERLAP_DIST: 24, // px — overlap distance to trigger freeze
  CHATTY_WALK_AWAY_DURATION: 2000, // ms to walk away after freezing

  // === CHAOS AGENTS: SLACK PINGER ===
  SLACKPINGER_SPEED: 80,
  DECOY_SPAWN_INTERVAL: 5000, // was 8000 — more decoys on map
  DECOY_LIFETIME: 6000,
  DECOY_CARRY_DURATION: 3000, // ms before decoy vanishes from inventory
  SLACKPINGER_AURA_RANGE: 120, // px — stress aura radius
  SLACKPINGER_AURA_STRESS_RATE: 0.8, // %/sec stress while player in aura

  // === UPGRADE TUNING ===
  CORNER_OFFICE_AUTO_DELIVER_RANGE: 80, // px — proximity auto-deliver for chosen dept
  FAST_TRACKER_STRESS_RELIEF: 3, // % stress relief per skip
  DEPT_FAVORITE_XP_MULT: 2.0, // XP multiplier for favorite dept deliveries
  DEPT_FAVORITE_RELIEF_MULT: 2.0, // stress relief multiplier for favorite dept
  MEETING_BLOCKER_DURATION_MULT: 0.5, // halve meeting block durations
  MEETING_BLOCKER_BLOCKED_XP_MULT: 0.75, // 75% XP when delivering through blocks
  EXECUTIVE_PRESENCE_SLOW_FACTOR: 0.7, // all chaos agents move 30% slower

  // === ASSISTANT ===
  ASSISTANT_SPEED: 80,
  ASSISTANT_SPAWN_OFFSET: 40,
  ASSISTANT_PICKUP_RANGE: 28, // px — how close to pick up a task
  ASSISTANT_WAYPOINT_RANGE: 20, // px — how close to a waypoint to advance
  ASSISTANT_WANDER_ARRIVAL_RANGE: 16, // px — how close to wander target before picking new one
  ASSISTANT_FETCH_TIMEOUT: 15000, // ms before giving up on fetch
  ASSISTANT_DELIVER_TIMEOUT: 20000, // ms before force-completing delivery
  ASSISTANT_SEEK_DELAY: 5000, // ms between task seek attempts
  ASSISTANT_DELIVERY_INTERVAL: 45000, // ms between delivery cycles
  ASSISTANT_STUCK_CHECK_INTERVAL: 2000, // ms between stuck checks
  ASSISTANT_STUCK_MOVE_THRESHOLD: 8, // px — distance below which assistant is "stuck"

  // === PROGRESSION ===
  XP_PER_LEVEL: [80, 120, 160, 200, 260, 440, 540, 660], // 8 entries for levels 2-9 (late game increased to push CEO to ~7-8 min)
  TIER_THRESHOLDS: {
    INTERN: { minLevel: 1, maxLevel: 2 },
    ASSOCIATE: { minLevel: 3, maxLevel: 4 },
    MANAGER: { minLevel: 5, maxLevel: 6 },
    DIRECTOR: { minLevel: 7, maxLevel: 8 },
    CEO: { minLevel: 9, maxLevel: 9 },
  },
  TIER_ORDER: ['INTERN', 'ASSOCIATE', 'MANAGER', 'DIRECTOR', 'CEO'],
  POST_CEO_MILESTONE_XP_BASE: 400,       // first post-CEO milestone cost
  POST_CEO_MILESTONE_XP_INCREMENT: 200,   // each subsequent milestone costs this much more
  MILESTONE_STRESS_DECAY_BONUS: 0.3,      // permanent %/sec passive decay per milestone

  // === TIMER ===
  TIMER_WARNING_ORANGE: 120, // seconds remaining
  TIMER_WARNING_RED: 60,     // seconds remaining

  // === TASK VISUALS ===
  TASK_FLASH_INTERVAL: 300, // ms between flash toggles
  TASK_FLASH_ALPHA: 0.3,    // alpha when flashing "off"
  TASK_BOB_AMPLITUDE: 3,    // px vertical bob distance
  TASK_BOB_DURATION: 600,   // ms half-cycle for bob tween
  TASK_PULSE_SCALE: 1.15,   // max scale during pulse
  TASK_PULSE_DURATION: 800,  // ms half-cycle for pulse tween
  TASK_GLOW_ALPHA: 0.25,    // opacity of glow halo behind task icon
  FLOATING_TEXT_MAX_LENGTH: 45, // truncate floating text beyond this (was 30)
  FLOATING_TEXT_DURATION: 2500,    // ms before fade-out (was hardcoded 2000)
  FLOATING_TEXT_FONT_SIZE: '12px', // pickup popup size (was hardcoded '11px')
  TASK_STRIP_MAX_NAME_LENGTH: 70,  // chars before truncation in bottom strip (960px canvas fits ~120 chars at 13px mono)

  // === HUD ===
  HUD_MAX_TASK_SLOTS: 4, // max task info lines (matches max carry capacity with Extra Hands)
  STAMINA_LOW_THRESHOLD: 0.2, // ratio — stamina bar turns red
  STAMINA_WARN_THRESHOLD: 0.4, // ratio — stamina bar turns yellow

  // === LEVEL UP ===
  PROMOTION_POPUP_DURATION: 2000, // ms to show "PROMOTED!" text
  LEVELUP_NO_UPGRADES_CLOSE_DELAY: 1500, // ms before auto-closing when no upgrades available
  LEVELUP_SELECTION_CLOSE_DELAY: 400, // ms after selecting an upgrade before closing

  // === GAME OVER ===
  GAME_OVER_DELAY: 1500, // ms before showing game over screen (was 500 — allows flash/shake to play)

  // === CAMERA ===
  CAMERA_ZOOM: 0.703125,           // 540/768 — fits 40x24 tile map in viewport
  CAMERA_LERP: 0.08,
  CAMERA_DEADZONE_WIDTH: 200,
  CAMERA_DEADZONE_HEIGHT: 150,

  // === TASK TIER SELECTION WEIGHTS ===
  TASK_TIER_WEIGHT_CURRENT: 0.6,
  TASK_TIER_WEIGHT_BELOW: 0.3,
  TASK_TIER_WEIGHT_ABOVE: 0.1,

  // === EFFECTS ===
  EFFECTS: {
    // Particle counts
    PICKUP_PARTICLES: 4,
    DELIVERY_PARTICLES: 9,
    LEVEL_UP_PARTICLES: 18,
    PROMOTION_PARTICLES: 30,
    EXPIRY_PARTICLES: 5,
    VICTORY_CONFETTI_PARTICLES: 25,

    // Particle lifetimes (ms)
    PICKUP_LIFETIME: 300,
    DELIVERY_LIFETIME: 500,
    LEVEL_UP_LIFETIME: 1000,
    EXPIRY_LIFETIME: 300,

    // Screen flash
    FLASH_ALPHA: 0.35,
    FLASH_DURATION: 200, // ms

    // Camera shake
    SHAKE_INTENSITY: 0.003,
    SHAKE_DURATION: 300, // ms

    // Vignette
    VIGNETTE_WIDTH: 60, // px edge width
    VIGNETTE_YELLOW_ALPHA: 0.08,
    VIGNETTE_ORANGE_ALPHA: 0.12,
    VIGNETTE_RED_ALPHA_MIN: 0.10,
    VIGNETTE_RED_ALPHA_MAX: 0.18,
    VIGNETTE_PULSE_DURATION: 800, // ms per pulse cycle

    // Victory confetti
    VICTORY_CONFETTI_LIFETIME: 1500, // ms

    // Game over freeze (visual pause before scene transition)
    GAME_OVER_FREEZE: 1000, // ms
    GAME_OVER_TEXT_FADE: 300, // ms for "STRESS OVERLOAD" fade-in
  },

  // === SOUND ===
  SOUND: {
    ENABLED: true,
    MASTER_VOLUME: 0.3,
    BGM_VOLUME: 0.12, // background music volume (relative to master)
    BGM_TEMPO: 120, // bpm
  },

  // === DEBUG ===
  DEBUG: {
    SHOW_COLLISION_BODIES: false,
    GOD_MODE: false,
    START_LEVEL: 1,
    INFINITE_STAMINA: false,
    STRESS_FREEZE: false,
    FAST_SPAWN: false,
    SKIP_TITLE: false,
  },
};
