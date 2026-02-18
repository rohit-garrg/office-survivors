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
  TASK_EXPIRY_STRESS_CAP: 20, // max % stress from expiry in any rolling window
  TASK_EXPIRY_STRESS_CAP_WINDOW: 5000, // ms rolling window for expiry stress cap

  // === TASK XP ===
  TASK_XP_SINGLE_BASE: 20, // +5 per tier
  TASK_XP_MULTI_2_BASE: 45, // +10 per tier above Manager
  TASK_XP_MULTI_3_BASE: 80, // +10 per tier above Director

  // === TASK STRESS RELIEF ===
  TASK_RELIEF_SINGLE: 5, // % (reverted to spec — late game needs real stress pressure)
  TASK_RELIEF_MULTI_2: 8, // % (reverted to spec)
  TASK_RELIEF_MULTI_3: 12, // % (reverted to spec)

  // === STRESS ===
  STRESS_MAX: 100,
  STRESS_RATE_INTERN: 0.02, // %/sec per undelivered task (was 0.03 — ~30% reduction)
  STRESS_RATE_ASSOCIATE: 0.035, // was 0.05
  STRESS_RATE_MANAGER: 0.065, // was 0.055 — steeper late-game ramp
  STRESS_RATE_DIRECTOR: 0.10, // was 0.08
  STRESS_RATE_CEO: 0.14, // was 0.10
  STRESS_MEETING_BLOCK: 3, // instant %
  STRESS_DECOY_PICKUP: 4, // instant % (was 2 — doubled to punish decoy mistakes)
  STRESS_PASSIVE_DECAY_THRESHOLD: 50, // % stress above which passive decay kicks in
  STRESS_PASSIVE_DECAY_RATE: 0.40, // %/sec base passive decay (was 0.65 — reduced so CEO stress actually threatens)
  STRESS_BALL_DECAY_BONUS: 0.25, // extra %/sec from Stress Ball upgrade (was 0.35)
  STRESS_VISUAL_YELLOW: 40, // threshold %
  STRESS_VISUAL_ORANGE: 65,
  STRESS_VISUAL_RED: 85,

  // === CHAOS AGENTS: SHARED ===
  AGENT_ARRIVAL_THRESHOLD: 8, // px — distance to consider "arrived" at target
  AGENT_STUCK_THRESHOLD: 4, // px — distance moved below which agent is "stuck" (was 2)
  AGENT_STUCK_CHECK_INTERVAL: 1000, // ms between stuck checks (was 500 — longer window = more meaningful)
  AGENT_STUCK_IDLE_DURATION: 500, // ms to idle when stuck before retrying
  AGENT_STUCK_MAX_RETRIES: 3,       // nudge attempts before calling onStuck()
  AGENT_STUCK_NUDGE_DURATION: 1200,  // ms to move perpendicular when stuck (was 400 — 3x longer to clear walls)
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

  // === CHAOS AGENTS: ENRAGE ===
  // After enrageTime minutes since spawn, agents escalate once
  ENRAGE_MICROMANAGER_TIME: 180000,       // 3 min after spawn
  ENRAGE_MICROMANAGER_RANGE: 128,         // px (was 96)
  ENRAGE_MICROMANAGER_STRESS_RATE: 0.5,   // %/sec (was 0.3)
  ENRAGE_REPLYALL_TIME: 120000,           // 2 min after spawn
  ENRAGE_REPLYALL_BURST: 6,              // tasks per burst (was 4)
  ENRAGE_MEETING_TIME: 120000,            // 2 min after spawn
  ENRAGE_MEETING_MAX_BLOCKS: 2,           // can block 2 depts simultaneously
  ENRAGE_CHATTY_TIME: 90000,              // 90s after spawn
  ENRAGE_CHATTY_FREEZE_DURATION: 3500,    // ms (was 2500)
  ENRAGE_CHATTY_COOLDOWN: 4000,           // ms (was 6000)
  ENRAGE_SLACKPINGER_TIME: 120000,        // 2 min after spawn
  ENRAGE_SLACKPINGER_DECOY_INTERVAL: 3000, // ms (was 5000)
  ENRAGE_SLACKPINGER_AURA_RANGE: 160,     // px (was 120)

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
  REPLYALL_TASK_EXPIRY_TIME: 20000, // ms — shorter window to decide (was 30000)
  REPLYALL_TASK_EXPIRY_STRESS: 6, // % stress on junk mail expiry (was 4 — 24% total if full burst ignored)
  REPLYALL_CHAIN_WINDOW: 10000,    // ms — deliver 2+ junk tasks within this window for full XP
  REPLYALL_CHAIN_XP_MULT: 1.0,     // XP multiplier for 2nd+ junk task in chain (full XP)
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
  CHATTY_FREEZE_IMMUNITY_WINDOW: 2000, // ms — immunity after any freeze ends (prevents chain-freezing)
  CHATTY_FREEZE_OVERLAP_DIST: 24, // px — overlap distance to trigger freeze
  CHATTY_WALK_AWAY_DURATION: 2000, // ms to walk away after freezing

  // === CHAOS AGENTS: SLACK PINGER ===
  SLACKPINGER_SPEED: 80,
  DECOY_SPAWN_INTERVAL: 5000, // was 8000 — more decoys on map
  DECOY_LIFETIME: 6000,
  DECOY_CARRY_DURATION: 3000, // ms before decoy vanishes from inventory
  SLACKPINGER_AURA_RANGE: 120, // px — stress aura radius
  SLACKPINGER_AURA_STRESS_RATE: 0.8, // %/sec stress while player in aura

  // === PRESSURE BONUS ===
  PRESSURE_AGENT_RANGE: 128,          // px — agent within this range during delivery
  PRESSURE_AGENT_XP_BONUS: 0.5,       // +50% XP
  PRESSURE_STRESS_THRESHOLD: 65,       // % stress above which bonus applies
  PRESSURE_STRESS_XP_BONUS: 0.25,     // +25% XP
  PRESSURE_HOT_ZONE_XP_BONUS: 0.75,   // +75% XP for recently-unblocked dept
  PRESSURE_HOT_ZONE_DURATION: 30000,   // ms duration of hot zone after dept unblock
  PRESSURE_MAX_MULTIPLIER: 3.0,        // cap total pressure multiplier

  // === UPGRADE TUNING ===
  CORNER_OFFICE_AUTO_DELIVER_RANGE: 80, // px — proximity auto-deliver for chosen dept
  FAST_TRACKER_STRESS_RELIEF: 3, // % stress relief per skip
  DEPT_FAVORITE_XP_MULT: 2.0, // XP multiplier for favorite dept deliveries
  DEPT_FAVORITE_RELIEF_MULT: 2.0, // stress relief multiplier for favorite dept
  MEETING_BLOCKER_DURATION_MULT: 0.5, // halve meeting block durations
  MEETING_BLOCKER_BLOCKED_XP_MULT: 0.75, // 75% XP when delivering through blocks
  EXECUTIVE_PRESENCE_SLOW_FACTOR: 0.6, // agents at 60% speed when EP active (delivery-triggered)
  EXECUTIVE_PRESENCE_DURATION: 8000,    // ms duration of delivery-triggered agent slow

  // === ASSISTANT ===
  ASSISTANT_SPEED: 80,
  ASSISTANT_SPAWN_OFFSET: 40,
  ASSISTANT_PICKUP_RANGE: 28, // px — how close to pick up a task
  ASSISTANT_WAYPOINT_RANGE: 20, // px — how close to a waypoint to advance
  ASSISTANT_WANDER_ARRIVAL_RANGE: 16, // px — how close to wander target before picking new one
  ASSISTANT_FETCH_TIMEOUT: 15000, // ms before giving up on fetch
  ASSISTANT_DELIVER_TIMEOUT: 20000, // ms before force-completing delivery
  ASSISTANT_SEEK_DELAY: 5000, // ms between task seek attempts
  ASSISTANT_DELIVERY_INTERVAL: 30000, // ms between delivery cycles (was 45000 — 45s too slow to feel useful)
  ASSISTANT_STUCK_CHECK_INTERVAL: 2000, // ms between stuck checks
  ASSISTANT_STUCK_MOVE_THRESHOLD: 8, // px — distance below which assistant is "stuck"

  // === PROGRESSION ===
  XP_PER_LEVEL: [80, 120, 180, 240, 340, 520, 680, 840], // 8 entries for levels 2-9 (steepened: total 3000 XP to CEO, ~7.5-8 min)
  TIER_THRESHOLDS: {
    INTERN: { minLevel: 1, maxLevel: 2 },
    ASSOCIATE: { minLevel: 3, maxLevel: 4 },
    MANAGER: { minLevel: 5, maxLevel: 6 },
    DIRECTOR: { minLevel: 7, maxLevel: 8 },
    CEO: { minLevel: 9, maxLevel: 9 },
  },
  TIER_ORDER: ['INTERN', 'ASSOCIATE', 'MANAGER', 'DIRECTOR', 'CEO'],
  POST_CEO_MILESTONE_XP_BASE: 500,       // first post-CEO milestone cost (was 300 — slow the flood)
  POST_CEO_MILESTONE_XP_INCREMENT: 200,   // each subsequent costs this much more (was 100)
  MILESTONE_XP_MULTIPLIER_BONUS: 0.1,     // +0.1x XP multiplier per milestone (was 0.5 — kills feedback loop)
  MILESTONE_XP_MULTIPLIER_CAP: 0.3,       // max cumulative bonus from milestones (caps at 1.3x)
  MILESTONE_IPO_BELL: 3,                   // milestone number that triggers IPO Bell celebration

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
  FLOATING_TEXT_DURATION: 3000,    // ms before fade-out (was 2500 — half-second longer for readability)
  FLOATING_TEXT_FONT_SIZE: '12px', // pickup popup size (was hardcoded '11px')
  TASK_STRIP_MAX_NAME_LENGTH: 70,  // chars before truncation in bottom strip (960px canvas fits ~120 chars at 13px mono)

  // === HUD ===
  HUD_MAX_TASK_SLOTS: 4, // max task info lines (matches max carry capacity with Extra Hands)
  HUD_BADGE_WIDTH: 34,   // px — task badge width in top bar
  HUD_BADGE_HEIGHT: 12,  // px — task badge height in top bar
  HUD_BADGE_GAP: 3,      // px — gap between task badges
  STAMINA_LOW_THRESHOLD: 0.2, // ratio — stamina bar turns red
  STAMINA_WARN_THRESHOLD: 0.4, // ratio — stamina bar turns yellow

  // === TOASTS ===
  TOAST_DURATION: 4000,       // ms hold time
  TOAST_FADE_IN: 300,         // ms
  TOAST_FADE_OUT: 500,        // ms
  SPRINT_HINT_STRESS_THRESHOLD: 50,  // % stress to trigger sprint hint
  TUTORIAL_IDLE_DELAY: 3000,          // ms before showing move hint for idle players

  // === SOUND PROMPT ===
  SOUND_PROMPT_DELAY: 5000,   // ms after game start before sound prompt

  // === WATER COOLER ===
  WATER_COOLER_STRESS_RELIEF: 8,     // % stress reduced on use
  WATER_COOLER_STAMINA_RESTORE: 20,  // stamina points restored on use
  WATER_COOLER_COOLDOWN: 20000,      // ms before it can be used again
  WATER_COOLER_POSITIONS: [
    { x: 37, y: 4 },   // Break Room area (upper-right)
    { x: 20, y: 7 },   // Center-top corridor (high visibility)
    { x: 20, y: 19 },  // Center-south corridor (covers bottom half of map)
  ],

  // === SHARE ===
  SHARE_CARD_WIDTH: 1200,
  SHARE_CARD_HEIGHT: 630,
  SHARE_URL: 'https://rohitgarrg.com/projects/office-survivors',

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

  // === MOBILE ===
  MOBILE_TAP_MARKER_DURATION: 500,    // ms tap destination marker visible
  MOBILE_SPRINT_HOLD_THRESHOLD: 200,  // ms before long-press triggers sprint
  MOBILE_PAUSE_BUTTON_SIZE: 32,       // game px
  MOBILE_PAUSE_HIT_SIZE: 48,          // game px (larger touch target)

  // Mobile camera
  MOBILE_CAMERA_ZOOM: 1.6,           // ~1/4.5 of map visible
  MOBILE_CAMERA_LERP: 0.1,
  MOBILE_CAMERA_DEADZONE_WIDTH: 80,
  MOBILE_CAMERA_DEADZONE_HEIGHT: 60,

  // Virtual joystick (bottom-left)
  MOBILE_JOYSTICK_X: 100,
  MOBILE_JOYSTICK_Y_OFFSET: -90,     // from canvas bottom
  MOBILE_JOYSTICK_BASE_RADIUS: 50,
  MOBILE_JOYSTICK_THUMB_RADIUS: 22,
  MOBILE_JOYSTICK_BASE_ALPHA: 0.2,
  MOBILE_JOYSTICK_THUMB_ALPHA: 0.5,
  MOBILE_JOYSTICK_MAX_DISTANCE: 45,

  // Sprint button (bottom-right)
  MOBILE_SPRINT_BTN_X_OFFSET: -100,  // from canvas right
  MOBILE_SPRINT_BTN_Y_OFFSET: -90,
  MOBILE_SPRINT_BTN_RADIUS: 30,
  MOBILE_SPRINT_BTN_ALPHA: 0.4,
  MOBILE_SPRINT_BTN_ACTIVE_ALPHA: 0.7,

  // Off-screen department indicators
  MOBILE_DEPT_INDICATOR_SIZE: 14,
  MOBILE_DEPT_INDICATOR_MARGIN: 40,
  MOBILE_DEPT_INDICATOR_PULSE_MS: 800,

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

    // Vignette glow
    VIGNETTE_GLOW_WIDTH: 100,           // px - how far gradient extends from edge
    VIGNETTE_MIN_STRESS: 5,             // % - below this, no glow at all
    VIGNETTE_GREEN_ALPHA_MAX: 0.06,     // max alpha in green zone (5-39%)
    VIGNETTE_YELLOW_ALPHA_MAX: 0.10,    // max alpha in yellow zone (40-64%)
    VIGNETTE_ORANGE_ALPHA_MAX: 0.15,    // max alpha in orange zone (65-84%)
    VIGNETTE_RED_ALPHA_MIN: 0.15,       // red zone base alpha
    VIGNETTE_RED_ALPHA_MAX: 0.25,       // red zone pulse peak
    VIGNETTE_PULSE_DURATION: 800,       // ms per pulse cycle

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
