import Phaser from 'phaser';
import CONFIG from '../config/gameConfig.js';
import { DEPARTMENTS, OBSTACLES, ROOM_WALLS, PLAYER_START, DEPARTMENT_ABBREV } from '../config/mapData.js';
import { Player } from '../entities/Player.js';
import { TASK_STATES } from '../entities/Task.js';
import { TaskManager } from '../systems/TaskManager.js';
import { StressManager } from '../systems/StressManager.js';
import { ProgressionManager } from '../systems/ProgressionManager.js';
import { UpgradeManager } from '../systems/UpgradeManager.js';
import { WaveManager } from '../systems/WaveManager.js';
import { ParticleManager } from '../systems/ParticleManager.js';
import { SoundManager } from '../systems/SoundManager.js';
import { tileToPixel, formatTime, isTouchDevice } from '../utils/helpers.js';
import { trackEvent } from '../utils/analytics.js';

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
    console.log('[GameScene] initialized');
  }

  /** Initialize game world: map, player, systems, camera, physics groups */
  create() {
    console.log('[GameScene] create');

    // Map pixel dimensions
    this.mapWidth = CONFIG.MAP_WIDTH_TILES * CONFIG.TILE_SIZE;
    this.mapHeight = CONFIG.MAP_HEIGHT_TILES * CONFIG.TILE_SIZE;

    // Game state
    this.isPaused = false;
    this.isGameOver = false;
    this.gameTimer = CONFIG.GAME_DURATION; // seconds remaining
    this.elapsedTime = 0; // seconds elapsed
    this._timerAccumulator = 0; // ms accumulator for 1-second ticks

    // Build map
    this.createMap();

    // Create physics groups
    this.createPhysicsGroups();

    // Create player
    const startPos = tileToPixel(PLAYER_START.x, PLAYER_START.y, CONFIG.TILE_SIZE);
    this.player = new Player(this, startPos.x, startPos.y);
    this.player.init();

    // Initialize systems
    this.initSystems();

    // Set up camera
    this.setupCamera();

    // Set up input
    this.setupInput();

    // Set up collisions
    this.setupCollisions();

    // Launch UIScene in parallel
    this.scene.launch('UIScene');

    // Set up debug console
    this.setupDebugConsole();

    // Pause overlay elements (hidden by default)
    this.pauseOverlay = null;

    // Listen for stress-max to trigger game over
    this._onStressMax = () => {
      if (!this.isGameOver) {
        this.gameOver(false);
      }
    };
    this.events.on('stress-max', this._onStressMax);

    // Listen for level-up to pause game and show LevelUpScene
    this._onLevelUp = (data) => {
      if (this.isGameOver) return;

      // Switch player sprite variant on tier change
      if (this.player && this.player.switchVariant) {
        this.player.switchVariant(data.tier);
      }

      // Pause game
      this.isPaused = true;
      this.physics.pause();

      // Get upgrade options from UpgradeManager
      const upgrades = this.upgradeManager.getUpgradeOptions(data.level);

      // Launch LevelUpScene overlay
      this.scene.launch('LevelUpScene', {
        level: data.level,
        tier: data.tier,
        isPromotion: data.isPromotion,
        upgrades,
      });
    };
    this.events.on('level-up', this._onLevelUp);

    // Listen for post-CEO milestones to show bonus upgrade popup (or silent bonus)
    this._onCeoMilestone = (data) => {
      if (this.isGameOver) return;

      // Grant cumulative XP multiplier bonus
      this.progressionManager.addMilestoneXPBonus(CONFIG.MILESTONE_XP_MULTIPLIER_BONUS);

      // IPO Bell celebration at milestone 3
      const isIPOBell = data.milestoneNumber === CONFIG.MILESTONE_IPO_BELL;
      const currentMult = this.progressionManager.getMilestoneXPMultiplier();

      // Get upgrade options — if pool is empty, skip popup
      const upgrades = this.upgradeManager.getUpgradeOptions(this.progressionManager.level);
      if (!upgrades || upgrades.length === 0) {
        console.debug('[GameScene] CEO milestone #' + data.milestoneNumber + ' — no upgrades, silent XP bonus');
        this.events.emit('milestone-bonus', {
          milestoneNumber: data.milestoneNumber,
          xpMultiplier: currentMult,
          isIPOBell,
        });
        return;
      }

      // Check if all available upgrades are "stale" (timed and currently active, or charge-based with charges remaining)
      const allStale = upgrades.every((u) => {
        // Timed upgrade that is currently running
        if (typeof u.duration === 'number' && this.upgradeManager.isActive(u.id)) return true;
        // Fast Tracker still has charges
        if (u.uses && this.upgradeManager.fastTrackerCharges > 0 && u.id === 'fast_tracker') return true;
        return false;
      });

      if (allStale) {
        console.debug('[GameScene] CEO milestone #' + data.milestoneNumber + ' — all upgrades stale, silent XP bonus');
        this.events.emit('milestone-bonus', {
          milestoneNumber: data.milestoneNumber,
          xpMultiplier: currentMult,
          isIPOBell,
        });
        return;
      }

      // Pause game and show LevelUpScene with milestone flag
      this.isPaused = true;
      this.physics.pause();

      this.scene.launch('LevelUpScene', {
        level: this.progressionManager.level,
        tier: this.progressionManager.currentTier,
        isPromotion: false,
        isMilestone: true,
        upgrades,
      });
    };
    this.events.on('ceo-milestone', this._onCeoMilestone);

    // NPC assistant reference (set by UpgradeManager when spawned)
    this.assistant = null;

    // Initialize ParticleManager + SoundManager
    this.particleManager = new ParticleManager(this);
    this.particleManager.init();

    this.soundManager = new SoundManager(this);
    this.soundManager.init();

    // Set up touch input if device supports it (after soundManager so mute button works)
    if (isTouchDevice()) {
      this.input.addPointer(1); // 3-pointer multi-touch (joystick + sprint + extra)
      this.createMobileJoystick();
      this.createMobileSprintButton();
      this.createMobilePauseButton();
      this.createMobileMuteButton();
      this.createDepartmentIndicators();
      this.player.useTouchInput = true;
      this.player.useJoystickInput = true;
    }

    // Create vignette overlay (4 edge rectangles, hidden by default)
    this.createVignetteGlow();

    // Wire particle + sound events
    this.wirePolishEvents();

    // Orientation change handler for mobile (auto-pause on portrait rotation)
    if (isTouchDevice()) {
      this._orientationHandler = () => {
        const isPortrait = window.matchMedia('(orientation: portrait)').matches;
        if (isPortrait && !this.isPaused && !this.isGameOver) {
          this.togglePause();
          const overlay = document.getElementById('orientation-overlay');
          if (overlay) overlay.style.display = 'flex';
        } else if (!isPortrait) {
          const overlay = document.getElementById('orientation-overlay');
          if (overlay) overlay.style.display = 'none';
        }
      };
      window.addEventListener('resize', this._orientationHandler);
    }

    // Register shutdown lifecycle
    this.events.once('shutdown', this.shutdown, this);

    console.log('[GameScene] ready');
  }

  /** Core game loop: player input, system updates, collision checks */
  update(time, delta) {
    if (this.isPaused || this.isGameOver) return;

    // Update player
    this.player.update(time, delta);

    // Update systems
    this.taskManager.update(time, delta);
    this.stressManager.update(time, delta);
    this.upgradeManager.update(time, delta);
    this.waveManager.update(time, delta);

    // Update NPC assistant if spawned
    if (this.assistant && this.assistant.isActive) {
      this.assistant.update(time, delta);
    }

    // Check task pickups (overlap-based in setupCollisions, but also manual check)
    this.checkTaskPickups();

    // Check department deliveries
    this.checkDepartmentDeliveries();

    // Check water cooler interaction
    this.checkWaterCooler();

    // Update mobile department indicators
    if (this.deptIndicators) {
      this.updateDepartmentIndicators();
    }

    // Game timer
    this._timerAccumulator += delta;
    if (this._timerAccumulator >= 1000) {
      this._timerAccumulator -= 1000;
      this.elapsedTime++;
      this.gameTimer = CONFIG.GAME_DURATION - this.elapsedTime;

      this.events.emit('game-timer-tick', {
        remaining: this.gameTimer,
        elapsed: this.elapsedTime,
      });

      // Win condition
      if (this.gameTimer <= 0) {
        this.gameOver(true);
      }
    }
  }

  /** Set up the tilemap: floor, walls, departments, obstacles, decoration */
  createMap() {
    const ts = CONFIG.TILE_SIZE;

    // Floor: light beige base
    this.add.rectangle(
      this.mapWidth / 2, this.mapHeight / 2,
      this.mapWidth, this.mapHeight,
      0xF5F0E8
    ).setDepth(0);

    // Subtle floor grid lines for depth
    const floorGfx = this.add.graphics().setDepth(0);
    floorGfx.lineStyle(1, 0xe8e0d0, 0.3);
    for (let x = 0; x <= CONFIG.MAP_WIDTH_TILES; x++) {
      floorGfx.lineBetween(x * ts, 0, x * ts, this.mapHeight);
    }
    for (let y = 0; y <= CONFIG.MAP_HEIGHT_TILES; y++) {
      floorGfx.lineBetween(0, y * ts, this.mapWidth, y * ts);
    }

    // Draw department zones (semi-transparent colored areas)
    this.departmentZones = [];
    for (const dept of DEPARTMENTS) {
      const px = dept.position.x * ts;
      const py = dept.position.y * ts;
      const pw = dept.size.width * ts;
      const ph = dept.size.height * ts;

      // Visual zone (single rectangle — avoids tile seam artifacts)
      const color = parseInt(dept.color.replace('#', ''), 16);
      this.add.rectangle(px + pw / 2, py + ph / 2, pw, ph, color, 0.18)
        .setDepth(1);

      // Department label
      this.add.text(px + pw / 2, py + ph / 2, dept.name, {
        fontSize: '20px',
        fontFamily: 'monospace',
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 4,
      }).setOrigin(0.5).setDepth(2);

      // Physics zone for overlap detection (invisible)
      const zone = this.add.zone(px + pw / 2, py + ph / 2, pw, ph);
      this.physics.add.existing(zone, true);
      zone.deptId = dept.id;
      this.departmentZones.push(zone);
    }

    // Draw walls
    this.wallGroup = this.physics.add.staticGroup();

    // Perimeter walls
    for (let x = 0; x < CONFIG.MAP_WIDTH_TILES; x++) {
      this.addWall(x, 0);
      this.addWall(x, CONFIG.MAP_HEIGHT_TILES - 1);
    }
    for (let y = 1; y < CONFIG.MAP_HEIGHT_TILES - 1; y++) {
      this.addWall(0, y);
      this.addWall(CONFIG.MAP_WIDTH_TILES - 1, y);
    }

    // Room walls from mapData (department walls get tinted textures)
    for (const wall of ROOM_WALLS) {
      const textureKey = wall.deptId ? `wall_${wall.deptId}` : 'wall';
      for (let x = wall.x; x < wall.x + wall.width; x++) {
        for (let y = wall.y; y < wall.y + wall.height; y++) {
          if (x === 0 || x === CONFIG.MAP_WIDTH_TILES - 1 ||
              y === 0 || y === CONFIG.MAP_HEIGHT_TILES - 1) continue;
          this.addWall(x, y, textureKey);
        }
      }
    }

    // Obstacles (desks, printers) — use real furniture sprites if available
    this.obstacleGroup = this.physics.add.staticGroup();
    const deskTextures = ['furniture-desk-monitor', 'furniture-desk-items'];
    const printerTextures = ['furniture-printer-large', 'furniture-printer-modern'];
    let obstacleIdx = 0;

    for (const obs of OBSTACLES) {
      for (let x = obs.x; x < obs.x + obs.width; x++) {
        for (let y = obs.y; y < obs.y + obs.height; y++) {
          let textureKey;
          if (obs.type === 'printer') {
            const pt = printerTextures[obstacleIdx % printerTextures.length];
            textureKey = this.textures.exists(pt) ? pt : 'printer';
          } else {
            const dt = deskTextures[obstacleIdx % deskTextures.length];
            textureKey = this.textures.exists(dt) ? dt : 'desk';
          }
          const img = this.obstacleGroup.create(
            x * ts + ts / 2, y * ts + ts / 2, textureKey
          );
          img.setDepth(3);
          img.refreshBody();
          obstacleIdx++;
        }
      }
    }

    // === Environment decoration (non-collidable) ===
    this.placeDecoration();

    // Interactive water cooler
    this.createWaterCooler();
  }

  /** Place decorative environment objects around the office */
  placeDecoration() {
    const ts = CONFIG.TILE_SIZE;
    const half = ts / 2;

    // Helper: place an image if texture exists, skip otherwise
    const decor = (tileX, tileY, textureKey, depth = 3) => {
      if (!this.textures.exists(textureKey)) return;
      this.add.image(tileX * ts + half, tileY * ts + half, textureKey)
        .setDepth(depth);
    };

    // Helper for 16x16 items (half-tile)
    const decorSmall = (tileX, tileY, textureKey, depth = 3) => {
      if (!this.textures.exists(textureKey)) return;
      this.add.image(tileX * ts + half, tileY * ts + half, textureKey)
        .setDepth(depth);
    };

    // === Plants (moved OFF department door gaps) ===
    // CEO door gap at x=7, y=3-4 → plant against CEO top wall
    decor(8, 1, 'env-plant-large');
    // Marketing door gap at x=7, y=9-10 → plant against Marketing bottom wall
    decor(8, 12, 'env-plant-large');
    // Engineering door gap at x=7, y=19-20 → plant against Engineering top wall
    decor(8, 17, 'env-plant-large');
    // Finance door gap at x=32, y=9-10 → plant against Finance bottom wall
    decor(31, 12, 'env-plant-large');
    // HR door gap at x=32, y=19-20 → plant against HR top wall
    decor(31, 17, 'env-plant-large');

    // Corridor plants — moved from mid-floor to against top perimeter wall
    decor(15, 1, 'env-plant-large');
    decor(24, 1, 'env-plant-large');

    // Small plants on desks/corners
    decorSmall(9, 7, 'env-plant-small');
    decorSmall(30, 7, 'env-plant-small');

    // === Water cooler / coffee / vending ===
    // Note: water dispenser at (20,7) is now an interactive cooler, not decoration
    decorSmall(21, 7, 'env-coffee-machine');
    decor(19, 22, 'env-vending-machine');

    // === Filing cabinets — symmetric pairs flanking each department door ===
    // CEO door (y=3-4): one above gap, one below
    decor(8, 2, 'furniture-filing-cabinet');
    decor(8, 5, 'furniture-filing-cabinet');
    // Marketing door (y=9-10): one above gap, one below
    decor(8, 8, 'furniture-filing-cabinet');
    decor(8, 11, 'furniture-filing-cabinet');
    // Engineering door (y=19-20): one above gap, one below
    decor(8, 18, 'furniture-filing-cabinet');
    decor(8, 21, 'furniture-filing-cabinet');
    // Finance door (y=9-10): one above gap, one below
    decor(31, 8, 'furniture-filing-cabinet');
    decor(31, 11, 'furniture-filing-cabinet');
    // HR door (y=19-20): one above gap, one below
    decor(31, 18, 'furniture-filing-cabinet');
    decor(31, 21, 'furniture-filing-cabinet');

    // === Bookshelves — against department wall edges, not floating ===
    decor(8, 6, 'furniture-bookshelf');
    decor(31, 6, 'furniture-bookshelf');

    // === Chairs near desks ===
    decor(13, 9, 'furniture-chair');
    decor(13, 10, 'furniture-chair');
    decor(19, 9, 'furniture-chair');
    decor(19, 10, 'furniture-chair');
    decor(2, 13, 'furniture-chair');
    decor(36, 13, 'furniture-chair');

    // Boss desk + chair inside CEO office
    decor(3, 3, 'furniture-desk-boss');
    decor(4, 4, 'furniture-chair-boss');

    // === Wall decorations (on wall tiles, depth above walls) ===
    decor(10, 0, 'decor-whiteboard', 6);
    decor(25, 0, 'decor-notice-board', 6);
    decor(18, 0, 'decor-calendar', 6);

    // Wall clocks and graphs on perimeter
    decorSmall(12, 0, 'decor-wall-clock', 6);
    decorSmall(28, 0, 'decor-wall-graph', 6);

    // === Small desk items — ON existing desk obstacles, not on open floor ===
    // These sit on top of desk obstacle tiles so they can't be confused with pickupable tasks
    decorSmall(14, 9, 'decor-papers');
    decorSmall(18, 9, 'decor-folders');
    decorSmall(14, 10, 'decor-books');
    decorSmall(18, 10, 'decor-documents');

    // Trash bins near printers
    decorSmall(16, 14, 'decor-trash-bin');
    decorSmall(23, 14, 'decor-trash-bin');

    // Boxes against bottom wall
    decor(10, 22, 'env-box-closed');
    decor(29, 22, 'env-box-closed');

    // === Inside department rooms ===
    // CEO office interior
    decor(5, 3, 'furniture-computer');
    decorSmall(2, 5, 'decor-documents-blue');

    // Marketing
    decor(3, 9, 'furniture-desk-monitor');
    decor(5, 10, 'furniture-computer');
    decorSmall(2, 11, 'decor-folders');

    // Engineering
    decor(3, 19, 'furniture-desk-monitor');
    decor(5, 20, 'furniture-computer');
    decor(2, 19, 'furniture-computer');

    // Finance
    decor(35, 9, 'furniture-desk-items');
    decor(37, 10, 'furniture-filing-cabinet');
    decorSmall(36, 11, 'decor-documents');

    // HR
    decor(35, 19, 'furniture-desk-items');
    decorSmall(37, 20, 'decor-papers');
    decor(36, 21, 'furniture-sofa');
  }

  /** Create interactive water cooler zones (supports multiple coolers) */
  createWaterCooler() {
    const ts = CONFIG.TILE_SIZE;
    const positions = CONFIG.WATER_COOLER_POSITIONS;
    const textureKey = this.textures.exists('env-water-dispenser')
      ? 'env-water-dispenser' : null;

    this.waterCoolers = [];

    // Speech bubble system — periodic hints
    this._waterCoolerSpeechLines = [
      'Take a break!',
      'Hydrate & de-stress',
      'Refill stamina here',
      'Feeling stressed? Come here!',
      'Water break?',
      '-Stress +Stamina',
    ];
    this._waterCoolerSpeechTimer = null;

    for (const pos of positions) {
      const px = pos.x * ts + ts / 2;
      const py = pos.y * ts + ts / 2;

      // Visual sprite
      let sprite;
      if (textureKey) {
        sprite = this.add.image(px, py, textureKey).setDepth(3);
      } else {
        sprite = this.add.rectangle(px, py, 28, 28, 0x4488cc).setDepth(3);
      }

      // Interaction zone
      const zone = this.add.zone(px, py, ts, ts);
      this.physics.add.existing(zone, true);

      // Pulsing glow aura
      const glow = this.add.circle(px, py, 22, 0x44ccff, 0.18).setDepth(2);
      this.tweens.add({
        targets: glow,
        alpha: { from: 0.18, to: 0.06 },
        scaleX: { from: 1, to: 1.3 },
        scaleY: { from: 1, to: 1.3 },
        yoyo: true,
        repeat: -1,
        duration: 1500,
        ease: 'Sine.easeInOut',
      });

      // Sparkle dot
      const sparkle = this.add.circle(px, py - 16, 3, 0xffffff, 0.7).setDepth(4);
      this.tweens.add({
        targets: sparkle,
        alpha: { from: 0.7, to: 0 },
        y: py - 22,
        yoyo: true,
        repeat: -1,
        duration: 1000,
      });

      this.waterCoolers.push({
        sprite, zone, glow, sparkle,
        px, py,
        available: true,
        cooldownTimer: null,
        speechBubble: null,
      });
    }

    // First hint after 15s, then every 20-35s
    this._scheduleWaterCoolerSpeech(15000);
  }

  /** Schedule the next water cooler speech bubble */
  _scheduleWaterCoolerSpeech(delay) {
    this._waterCoolerSpeechTimer = this.time.delayedCall(delay, () => {
      if (this.isGameOver || this.isPaused) {
        this._scheduleWaterCoolerSpeech(5000);
        return;
      }
      this._showWaterCoolerSpeech();
      // Next one in 20-35s
      const next = 20000 + Math.random() * 15000;
      this._scheduleWaterCoolerSpeech(next);
    });
  }

  /** Show a speech bubble above the closest available water cooler */
  _showWaterCoolerSpeech() {
    // Find an available cooler closest to the player
    let bestCooler = null;
    let bestDist = Infinity;
    for (const cooler of this.waterCoolers) {
      if (!cooler.available) continue;
      const dist = Phaser.Math.Distance.Between(
        this.player.x, this.player.y, cooler.px, cooler.py
      );
      if (dist < bestDist) {
        bestDist = dist;
        bestCooler = cooler;
      }
    }
    if (!bestCooler) return;

    // Clean up previous bubble on this cooler
    if (bestCooler.speechBubble) {
      bestCooler.speechBubble.destroy();
      bestCooler.speechBubble = null;
    }

    // Pick a random line
    const line = this._waterCoolerSpeechLines[
      Math.floor(Math.random() * this._waterCoolerSpeechLines.length)
    ];

    const label = this.add.text(0, 0, line, {
      fontSize: '11px',
      fontFamily: 'monospace',
      color: '#225588',
      resolution: 3,
    }).setOrigin(0.5);

    const bgWidth = label.width + 12;
    const bgHeight = label.height + 8;
    const bg = this.add.rectangle(0, 0, bgWidth, bgHeight, 0xffffff, 0.9)
      .setStrokeStyle(1, 0x88bbdd);

    const bubble = this.add.container(bestCooler.px, bestCooler.py - 28, [bg, label])
      .setDepth(24).setAlpha(0);
    bestCooler.speechBubble = bubble;

    // Fade in, hold, fade out
    this.tweens.add({
      targets: bubble,
      alpha: 1,
      duration: 300,
      onComplete: () => {
        this.time.delayedCall(3500, () => {
          if (bestCooler.speechBubble === bubble) {
            this.tweens.add({
              targets: bubble,
              alpha: 0,
              duration: 500,
              onComplete: () => {
                if (bestCooler.speechBubble === bubble) {
                  bubble.destroy();
                  bestCooler.speechBubble = null;
                }
              },
            });
          }
        });
      },
    });
  }

  /** Check if player overlaps any available water cooler zone */
  checkWaterCooler() {
    if (!this.waterCoolers) return;

    const playerBody = this.player.body;

    for (const cooler of this.waterCoolers) {
      if (!cooler.available) continue;

      const zoneBody = cooler.zone.body;
      const overlap = Phaser.Geom.Intersects.RectangleToRectangle(
        new Phaser.Geom.Rectangle(
          playerBody.x, playerBody.y, playerBody.width, playerBody.height
        ),
        new Phaser.Geom.Rectangle(
          zoneBody.x, zoneBody.y, zoneBody.width, zoneBody.height
        )
      );

      if (overlap) {
        this.useWaterCooler(cooler);
        break; // Only use one per frame
      }
    }
  }

  /** Use a specific water cooler: reduce stress, restore stamina, start cooldown */
  useWaterCooler(cooler) {
    cooler.available = false;

    // Apply stress relief
    const stressRelief = CONFIG.WATER_COOLER_STRESS_RELIEF;
    this.stressManager.relieveStress(stressRelief);

    // Apply stamina restore
    const staminaRestore = CONFIG.WATER_COOLER_STAMINA_RESTORE;
    this.player.stamina = Math.min(
      this.player.stamina + staminaRestore,
      CONFIG.PLAYER_STAMINA_MAX
    );

    // Emit event for UIScene floating text
    this.events.emit('water-cooler-used', { stressRelief, staminaRestore });

    // Play pickup sound as feedback
    if (this.soundManager) {
      this.soundManager.playPickup();
    }

    // Dim sprite and hide glow/sparkle/speech during cooldown
    if (cooler.sprite) cooler.sprite.setAlpha(0.5);
    if (cooler.glow) cooler.glow.setVisible(false);
    if (cooler.sparkle) cooler.sparkle.setVisible(false);
    if (cooler.speechBubble) {
      cooler.speechBubble.destroy();
      cooler.speechBubble = null;
    }

    // Cooldown timer (Deep Breaths upgrade halves cooldown)
    let cooldownMs = CONFIG.WATER_COOLER_COOLDOWN;
    if (this.upgradeManager && this.upgradeManager.isActive('deep_breaths')) {
      cooldownMs = Math.round(cooldownMs * 0.5);
    }
    cooler.cooldownTimer = this.time.delayedCall(
      cooldownMs,
      () => {
        cooler.available = true;
        if (cooler.sprite) cooler.sprite.setAlpha(1);
        if (cooler.glow) cooler.glow.setVisible(true);
        if (cooler.sparkle) cooler.sparkle.setVisible(true);
      }
    );

    console.debug('[GameScene] water cooler used');
  }

  /** Helper to add a wall tile at grid position */
  addWall(tileX, tileY, textureKey = 'wall') {
    const ts = CONFIG.TILE_SIZE;
    const wall = this.wallGroup.create(
      tileX * ts + ts / 2, tileY * ts + ts / 2, textureKey
    );
    wall.setDepth(5);
    wall.refreshBody();
  }

  /** Initialize physics groups for walls, tasks, zones, agents */
  createPhysicsGroups() {
    // Task physics group — tasks added by TaskManager
    this.taskGroup = this.physics.add.group();
  }

  /** Set up camera: zoomed follow on mobile, full-map static on desktop */
  setupCamera() {
    const cam = this.cameras.main;
    if (isTouchDevice()) {
      cam.setZoom(CONFIG.MOBILE_CAMERA_ZOOM);
      cam.setBounds(0, 0, this.mapWidth, this.mapHeight);
      cam.startFollow(this.player, true,
        CONFIG.MOBILE_CAMERA_LERP, CONFIG.MOBILE_CAMERA_LERP);
      cam.setDeadzone(CONFIG.MOBILE_CAMERA_DEADZONE_WIDTH,
        CONFIG.MOBILE_CAMERA_DEADZONE_HEIGHT);
    } else {
      cam.setZoom(CONFIG.CAMERA_ZOOM);
      cam.centerOn(this.mapWidth / 2, this.mapHeight / 2);
    }
  }

  /** Register keyboard input handlers */
  setupInput() {
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys({
      W: Phaser.Input.Keyboard.KeyCodes.W,
      A: Phaser.Input.Keyboard.KeyCodes.A,
      S: Phaser.Input.Keyboard.KeyCodes.S,
      D: Phaser.Input.Keyboard.KeyCodes.D,
    });
    this.shiftKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);

    // Pause keys
    this.input.keyboard.on('keydown-P', () => this.togglePause());
    this.input.keyboard.on('keydown-ESC', () => this.togglePause());
  }

  /** Set up overlap/collision checks between game objects */
  setupCollisions() {
    // Player collides with walls
    this.physics.add.collider(this.player, this.wallGroup);

    // Player collides with obstacles
    this.physics.add.collider(this.player, this.obstacleGroup);
  }

  /** Initialize all manager systems */
  initSystems() {
    this.progressionManager = new ProgressionManager(this);
    this.progressionManager.init();

    this.taskManager = new TaskManager(this);
    this.taskManager.init();

    this.stressManager = new StressManager(this);
    this.stressManager.init();

    this.upgradeManager = new UpgradeManager(this);
    this.upgradeManager.init();

    this.waveManager = new WaveManager(this);
    this.waveManager.init();
  }

  /** Check if player overlaps any spawned tasks for auto-pickup */
  checkTaskPickups() {
    const activeTasks = [...this.taskManager.getActiveTasks()]; // Copy to avoid mutation during iteration
    for (const task of activeTasks) {
      if (task.state !== TASK_STATES.SPAWNED) continue;

      const dist = Phaser.Math.Distance.Between(
        this.player.x, this.player.y, task.x, task.y
      );

      if (dist <= this.player.pickupRadius) {
        if (this.player.tryPickup(task)) {
          // Remove from active tasks on map
          const idx = this.taskManager.activeTasks.indexOf(task);
          if (idx !== -1) this.taskManager.activeTasks.splice(idx, 1);

          task.state = TASK_STATES.CARRIED;
          task.setVisible(false);
          task.setActive(false);
          if (task.body) task.body.enable = false;

          // Decoy task: waste carry slot for 3s, then vanish + 2% stress
          if (task.isDecoy) {
            this.handleDecoyPickup(task);
            continue;
          }

          // Fast Tracker: skip last stop on multi-stop tasks
          if (task.totalStops > 1 && this.upgradeManager && this.upgradeManager.fastTrackerCharges > 0) {
            task.totalStops--;
            if (task.route && task.route.length > 1) {
              task.route.pop(); // Remove last destination
            }
            this.upgradeManager.useFastTrackerCharge();
            console.debug(`[GameScene] Fast Tracker: reduced "${task.taskName}" to ${task.totalStops} stops`);
          }

          this.events.emit('task-picked-up', {
            task,
            player: this.player,
          });

          console.debug(`[GameScene] picked up: "${task.taskName}"`);
        } else if (this.player.inventory.length >= this.player.taskCapacity) {
          this.events.emit('task-pickup-failed', { task, player: this.player, reason: 'capacity' });
        }
      }
    }
  }

  /**
   * Handle picking up a decoy task: waste carry slot for 3s, then vanish + stress.
   * @param {import('../entities/Task.js').Task} task
   */
  handleDecoyPickup(task) {
    console.debug('[GameScene] picked up decoy task!');

    this.events.emit('task-picked-up', {
      task,
      player: this.player,
    });

    // After DECOY_CARRY_DURATION (3s): remove from inventory, add stress, return to pool
    this.time.delayedCall(CONFIG.DECOY_CARRY_DURATION, () => {
      const invIdx = this.player.inventory.indexOf(task);
      if (invIdx !== -1) {
        this.player.inventory.splice(invIdx, 1);
      }
      task.deactivate();

      // Add stress penalty
      if (this.stressManager) {
        this.stressManager.addInstantStress(CONFIG.STRESS_DECOY_PICKUP, 'decoy-pickup');
      }

      this.events.emit('agent-disruption', {
        type: 'slack_pinger',
        effect: 'decoy_picked_up',
        position: { x: this.player.x, y: this.player.y },
      });
    });
  }

  /** Check if player overlaps any department zone for auto-delivery */
  checkDepartmentDeliveries() {
    if (this.player.inventory.length === 0) return;

    for (const zone of this.departmentZones) {
      if (this.player.inventory.length === 0) break;

      // Check overlap manually using zone bounds
      const zoneBody = zone.body;
      const playerBody = this.player.body;

      let overlap = Phaser.Geom.Intersects.RectangleToRectangle(
        new Phaser.Geom.Rectangle(
          playerBody.x, playerBody.y, playerBody.width, playerBody.height
        ),
        new Phaser.Geom.Rectangle(
          zoneBody.x, zoneBody.y, zoneBody.width, zoneBody.height
        )
      );

      // Corner Office: auto-deliver within proximity of chosen department
      if (!overlap && this.upgradeManager &&
          this.upgradeManager.isActive('corner_office') &&
          this.upgradeManager.cornerOfficeDept === zone.deptId) {
        const zoneCenterX = zoneBody.x + zoneBody.width / 2;
        const zoneCenterY = zoneBody.y + zoneBody.height / 2;
        const dist = Phaser.Math.Distance.Between(
          this.player.x, this.player.y, zoneCenterX, zoneCenterY
        );
        if (dist <= CONFIG.CORNER_OFFICE_AUTO_DELIVER_RANGE) {
          overlap = true;
        }
      }

      if (overlap) {
        // Check if department is blocked by Meeting Scheduler
        if (this.waveManager && this.waveManager.meetingScheduler &&
            this.waveManager.meetingScheduler.isDeptBlocked(zone.deptId)) {
          continue; // Skip — delivery blocked. Soft-lock handled by MeetingScheduler.
        }

        // Find a task matching this department
        const index = this.player.inventory.findIndex(
          (task) => task.getCurrentDepartment() === zone.deptId
        );
        if (index === -1) continue;

        const task = this.player.inventory[index];

        // Check if this is the last stop (or single-stop)
        const isLastStop = task.currentStop >= task.totalStops - 1;

        // Remove from inventory before handleDelivery
        this.player.inventory.splice(index, 1);

        // handleDelivery advances the stop and may re-add to inventory for multi-stop
        this.taskManager.handleDelivery(task, zone.deptId);

        // If multi-stop and not done, task stays in inventory (handleDelivery doesn't re-add anymore)
        if (!isLastStop && task.state !== TASK_STATES.DONE) {
          this.player.inventory.push(task);

          this.events.emit('task-partial-delivery', {
            task,
            department: zone.deptId,
            currentStop: task.currentStop,
            totalStops: task.totalStops,
          });
        }
      }
    }
  }

  /** Create vignette glow overlay: single canvas texture with edge gradients */
  createVignetteGlow() {
    const zoom = isTouchDevice() ? CONFIG.MOBILE_CAMERA_ZOOM : 1;
    const w = Math.ceil(CONFIG.CANVAS_WIDTH / zoom);
    const h = Math.ceil(CONFIG.CANVAS_HEIGHT / zoom);
    const gw = Math.ceil(CONFIG.EFFECTS.VIGNETTE_GLOW_WIDTH / zoom);

    // Remove stale texture if scene restarts
    if (this.textures.exists('vignette-glow')) {
      this.textures.remove('vignette-glow');
    }

    const canvasTex = this.textures.createCanvas('vignette-glow', w, h);
    const ctx = canvasTex.context;

    // Ensure canvas starts fully transparent
    ctx.clearRect(0, 0, w, h);

    // Top edge
    let grad = ctx.createLinearGradient(0, 0, 0, gw);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, gw);

    // Bottom edge
    grad = ctx.createLinearGradient(0, h, 0, h - gw);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, h - gw, w, gw);

    // Left edge
    grad = ctx.createLinearGradient(0, 0, gw, 0);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, gw, h);

    // Right edge
    grad = ctx.createLinearGradient(w, 0, w - gw, 0);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(w - gw, 0, gw, h);

    canvasTex.refresh();

    // Position at canvas center (zoom fixed-point), not texture center
    this.vignetteImage = this.add.image(CONFIG.CANVAS_WIDTH / 2, CONFIG.CANVAS_HEIGHT / 2, 'vignette-glow')
      .setScrollFactor(0)
      .setDepth(400)
      .setAlpha(0);

    this.vignettePulseTween = null;
    this._vignetteInRedZone = false;
  }

  /**
   * Update vignette glow continuously based on stress percent.
   * Called every stress-changed event (each frame stress moves).
   * @param {number} percent - stress percentage 0-100
   */
  updateVignetteGlow(percent) {
    const fx = CONFIG.EFFECTS;

    if (!this.vignetteImage) return;

    // Below minimum: invisible
    if (percent < fx.VIGNETTE_MIN_STRESS) {
      this.vignetteImage.setAlpha(0);
      this._stopVignettePulse();
      return;
    }

    let tint, alpha;

    if (percent < 40) {
      // Green zone (5-39%): subtle green glow
      const t = (percent - fx.VIGNETTE_MIN_STRESS) / (40 - fx.VIGNETTE_MIN_STRESS);
      tint = 0x44aa44;
      alpha = Phaser.Math.Linear(0, fx.VIGNETTE_GREEN_ALPHA_MAX, t);
    } else if (percent < 65) {
      // Yellow zone (40-64%): transition green -> yellow
      const t = (percent - 40) / 25;
      const green = Phaser.Display.Color.ValueToColor(0x44aa44);
      const yellow = Phaser.Display.Color.ValueToColor(0xddcc00);
      const blended = Phaser.Display.Color.Interpolate.ColorWithColor(green, yellow, 1, t);
      tint = Phaser.Display.Color.GetColor(blended.r, blended.g, blended.b);
      alpha = Phaser.Math.Linear(fx.VIGNETTE_GREEN_ALPHA_MAX, fx.VIGNETTE_YELLOW_ALPHA_MAX, t);
    } else if (percent < 85) {
      // Orange zone (65-84%): transition yellow -> orange
      const t = (percent - 65) / 20;
      const yellow = Phaser.Display.Color.ValueToColor(0xddcc00);
      const orange = Phaser.Display.Color.ValueToColor(0xff8800);
      const blended = Phaser.Display.Color.Interpolate.ColorWithColor(yellow, orange, 1, t);
      tint = Phaser.Display.Color.GetColor(blended.r, blended.g, blended.b);
      alpha = Phaser.Math.Linear(fx.VIGNETTE_YELLOW_ALPHA_MAX, fx.VIGNETTE_ORANGE_ALPHA_MAX, t);
    } else {
      // Red zone (85-100%): transition orange -> red
      const t = Math.min((percent - 85) / 15, 1);
      const orange = Phaser.Display.Color.ValueToColor(0xff8800);
      const red = Phaser.Display.Color.ValueToColor(0xff2222);
      const blended = Phaser.Display.Color.Interpolate.ColorWithColor(orange, red, 1, t);
      tint = Phaser.Display.Color.GetColor(blended.r, blended.g, blended.b);
      alpha = Phaser.Math.Linear(fx.VIGNETTE_RED_ALPHA_MIN, fx.VIGNETTE_RED_ALPHA_MAX, t);
    }

    this.vignetteImage.setTint(tint);

    // Pulse effect in red zone
    if (percent >= 85) {
      if (!this._vignetteInRedZone) {
        this._vignetteInRedZone = true;
        this.vignettePulseTween = this.tweens.add({
          targets: this.vignetteImage,
          alpha: { from: fx.VIGNETTE_RED_ALPHA_MIN, to: fx.VIGNETTE_RED_ALPHA_MAX },
          duration: fx.VIGNETTE_PULSE_DURATION,
          yoyo: true,
          repeat: -1,
        });
      }
    } else {
      if (this._vignetteInRedZone) {
        this._stopVignettePulse();
      }
      this.vignetteImage.setAlpha(alpha);
    }
  }

  /** Stop vignette pulse tween and reset red zone flag */
  _stopVignettePulse() {
    if (this.vignettePulseTween) {
      this.vignettePulseTween.stop();
      this.vignettePulseTween = null;
    }
    this._vignetteInRedZone = false;
  }

  /** Wire particle and sound events to game events */
  wirePolishEvents() {
    // Task pickup — sparkles + ding (skip decoys)
    this._onPolishPickup = (data) => {
      if (data.task.isDecoy) {
        this.soundManager.playDecoyPickup();
        return;
      }
      const dept = data.task.getCurrentDepartment();
      this.particleManager.taskPickup(data.task.x || data.player.x, data.task.y || data.player.y, dept);
      this.soundManager.playPickup();
    };
    this.events.on('task-picked-up', this._onPolishPickup);

    // Task delivery — burst + chime
    this._onPolishDelivery = (data) => {
      const player = this.player;
      if (player) {
        this.particleManager.taskDelivery(player.x, player.y, data.department);
      }
      this.soundManager.playDelivery();
    };
    this.events.on('task-delivered', this._onPolishDelivery);

    // Task expiry — grey poof
    this._onPolishExpiry = (data) => {
      if (data.task) {
        this.particleManager.taskExpiry(data.task.x || 0, data.task.y || 0);
      }
    };
    this.events.on('task-expired', this._onPolishExpiry);

    // Level up — confetti or promotion
    this._onPolishLevelUp = (data) => {
      const player = this.player;
      if (!player) return;

      if (data.isPromotion) {
        this.particleManager.promotion(player.x, player.y);
        this.soundManager.playPromotion();
      } else {
        this.particleManager.levelUp(player.x, player.y);
        this.soundManager.playLevelUp();
      }
    };
    this.events.on('level-up', this._onPolishLevelUp);

    // Agent disruption — camera shake + sound
    this._onPolishDisruption = (data) => {
      if (data.effect === 'freeze' || data.effect === 'slow' || data.effect === 'task_burst') {
        this.particleManager.agentDisruption();
      }

      switch (data.effect) {
        case 'freeze':
          this.soundManager.playFreeze();
          break;
        case 'slow':
        case 'task_burst':
        case 'department_blocked':
          this.soundManager.playThud();
          break;
      }
    };
    this.events.on('agent-disruption', this._onPolishDisruption);

    // Stress changed — continuous vignette glow update
    this._onVignetteStressChanged = (data) => {
      this.updateVignetteGlow(data.percent);
    };
    this.events.on('stress-changed', this._onVignetteStressChanged);

    // Stress threshold — warning sound only
    this._onPolishStressThreshold = (data) => {
      if (data.level) {
        this.soundManager.playStressWarning();
      }
    };
    this.events.on('stress-threshold', this._onPolishStressThreshold);

    // M key — mute toggle
    this.input.keyboard.on('keydown-M', () => {
      this.soundManager.toggleMute();
    });

    // Resume audio context and start BGM on first interaction (autoplay policy)
    // Listen on both pointerdown and pointerup for mobile compatibility.
    // On iOS, resume() plays a silent buffer to unlock the context, then we start BGM.
    const resumeAudio = () => {
      this.input.off('pointerdown', resumeAudio);
      this.input.off('pointerup', resumeAudio);
      const sm = this.soundManager;
      sm.resume().then(() => {
        sm.startBGM();
      }).catch(() => {
        // Fallback: retry after a short delay (some iOS versions are slow to unlock)
        setTimeout(() => { sm.resume(); sm.startBGM(); }, 200);
      });
    };
    this.input.on('pointerdown', resumeAudio);
    this.input.on('pointerup', resumeAudio);

    // Also start BGM immediately if context is already running (e.g., replay)
    if (this.soundManager.ctx && this.soundManager.ctx.state === 'running') {
      this.soundManager.startBGM();
    }
  }

  /** Expose debug commands on window.game */
  setupDebugConsole() {
    window.game = {
      addXP: (amount) => this.progressionManager.addXP(amount),
      setStress: (percent) => {
        this.stressManager.currentStress = percent;
      },
      setLevel: (level) => {
        this.progressionManager.level = level;
        this.progressionManager.currentTier = this.progressionManager.getTierForLevel(level);
      },
      toggleGodMode: () => {
        CONFIG.DEBUG.GOD_MODE = !CONFIG.DEBUG.GOD_MODE;
        console.log(`[Debug] God mode: ${CONFIG.DEBUG.GOD_MODE}`);
      },
      skipToTime: (seconds) => {
        this.elapsedTime = seconds;
        this.gameTimer = CONFIG.GAME_DURATION - seconds;
      },
      listCarriedTasks: () => this.player.inventory.map((t) => ({
        name: t.taskName,
        dept: t.getCurrentDepartment(),
        stops: `${t.currentStop}/${t.totalStops}`,
      })),
      grantUpgrade: (id) => this.upgradeManager.applyUpgrade(id),
      listActiveUpgrades: () => ({
        permanent: [...this.upgradeManager.permanentUpgrades],
        timed: this.upgradeManager.activeTimedUpgrades.map((u) => ({
          id: u.id,
          remaining: Math.ceil(u.remaining / 1000) + 's',
        })),
        fastTracker: this.upgradeManager.fastTrackerCharges,
      }),
      getStats: () => {
        const prog = this.progressionManager.getStats();
        return {
          stress: this.stressManager.currentStress.toFixed(1),
          level: prog.level,
          tier: prog.tier,
          xp: `${prog.currentXP}/${prog.neededXP}`,
          totalXP: prog.totalXP,
          milestones: prog.milestones,
          timer: formatTime(this.gameTimer),
          activeTasks: this.taskManager.getActiveCount(),
          carriedTasks: this.player.inventory.length,
          delivered: this.taskManager.tasksDelivered,
          agents: this.waveManager ? this.waveManager.getAllActiveAgents().map((a) => a.agentType) : [],
        };
      },
      spawnAgent: (type) => {
        if (!this.waveManager) return 'WaveManager not initialized';
        const agent = this.waveManager.spawnAgent(type);
        return agent ? `Spawned ${type}` : `Failed to spawn ${type}`;
      },
      listActiveAgents: () => {
        if (!this.waveManager) return [];
        return this.waveManager.getAllActiveAgents().map((a) => ({
          type: a.agentType,
          pos: `(${Math.round(a.x)}, ${Math.round(a.y)})`,
          active: a.isActive,
        }));
      },
      killAllAgents: () => {
        if (!this.waveManager) return;
        for (const agent of this.waveManager.getAllActiveAgents()) {
          this.waveManager.removeAgent(agent);
        }
        console.log('[Debug] All agents killed');
      },
    };
  }

  /** Convert desired screen position to game coords for scrollFactor(0) objects under camera zoom.
   *  Phaser zooms about the canvas center, so: screenX = (gameX - cx) * zoom + cx.
   *  Inverse: gameX = cx + (screenX - cx) / zoom. At zoom=1 this is the identity. */
  screenToFixed(screenX, screenY) {
    const zoom = this.cameras.main.zoom;
    const cx = CONFIG.CANVAS_WIDTH / 2;
    const cy = CONFIG.CANVAS_HEIGHT / 2;
    return {
      x: cx + (screenX - cx) / zoom,
      y: cy + (screenY - cy) / zoom,
    };
  }

  /** Create virtual joystick for mobile (bottom-left) */
  createMobileJoystick() {
    const zoom = CONFIG.MOBILE_CAMERA_ZOOM;
    // Desired screen position: (100, 450) — bottom-left
    const pos = this.screenToFixed(
      CONFIG.MOBILE_JOYSTICK_X,
      CONFIG.CANVAS_HEIGHT + CONFIG.MOBILE_JOYSTICK_Y_OFFSET
    );
    const baseX = pos.x;
    const baseY = pos.y;
    const baseRadius = CONFIG.MOBILE_JOYSTICK_BASE_RADIUS / zoom;
    const thumbRadius = CONFIG.MOBILE_JOYSTICK_THUMB_RADIUS / zoom;
    const maxDist = CONFIG.MOBILE_JOYSTICK_MAX_DISTANCE / zoom;
    const deadzone = maxDist * 0.15;

    // Outer ring (base) — light cyan with outline for visibility on any background
    const base = this.add.circle(baseX, baseY, baseRadius, 0xaaddff, CONFIG.MOBILE_JOYSTICK_BASE_ALPHA)
      .setStrokeStyle(2 / zoom, 0x335577, 0.6)
      .setScrollFactor(0).setDepth(450);

    // Inner thumb
    const thumb = this.add.circle(baseX, baseY, thumbRadius, 0xddeeff, CONFIG.MOBILE_JOYSTICK_THUMB_ALPHA)
      .setStrokeStyle(1.5 / zoom, 0x335577, 0.8)
      .setScrollFactor(0).setDepth(451);

    // Invisible hit zone (larger for easier finger acquisition)
    const hitZone = this.add.circle(baseX, baseY, baseRadius + 20 / zoom, 0x000000, 0)
      .setScrollFactor(0).setDepth(452)
      .setInteractive();

    // Joystick state
    this.joystick = {
      base, thumb, hitZone,
      baseX, baseY,
      dirX: 0,
      dirY: 0,
      active: false,
      pointerId: null,
    };

    hitZone.on('pointerdown', (pointer) => {
      this.joystick.active = true;
      this.joystick.pointerId = pointer.id;
      this._updateJoystickThumb(pointer);
    });

    this.input.on('pointermove', (pointer) => {
      if (!this.joystick.active || pointer.id !== this.joystick.pointerId) return;
      this._updateJoystickThumb(pointer);
    });

    this.input.on('pointerup', (pointer) => {
      if (!this.joystick.active || pointer.id !== this.joystick.pointerId) return;
      this.joystick.active = false;
      this.joystick.pointerId = null;
      this.joystick.dirX = 0;
      this.joystick.dirY = 0;
      thumb.setPosition(baseX, baseY);
    });
  }

  /** Update joystick thumb position and direction from pointer */
  _updateJoystickThumb(pointer) {
    const js = this.joystick;
    const zoom = CONFIG.MOBILE_CAMERA_ZOOM;
    const maxDist = CONFIG.MOBILE_JOYSTICK_MAX_DISTANCE / zoom;
    const deadzone = maxDist * 0.15;

    // Convert pointer from canvas coords to game coords (same space as joystick base)
    const cx = CONFIG.CANVAS_WIDTH / 2;
    const cy = CONFIG.CANVAS_HEIGHT / 2;
    const px = cx + (pointer.x - cx) / zoom;
    const py = cy + (pointer.y - cy) / zoom;
    const dx = px - js.baseX;
    const dy = py - js.baseY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < deadzone) {
      // Inside deadzone — no movement
      js.dirX = 0;
      js.dirY = 0;
      js.thumb.setPosition(js.baseX + dx, js.baseY + dy);
    } else if (dist > maxDist) {
      // Clamp to max distance
      const nx = dx / dist;
      const ny = dy / dist;
      js.thumb.setPosition(js.baseX + nx * maxDist, js.baseY + ny * maxDist);
      js.dirX = nx;
      js.dirY = ny;
    } else {
      // Normal range — set thumb and normalize direction
      js.thumb.setPosition(js.baseX + dx, js.baseY + dy);
      js.dirX = dx / dist;
      js.dirY = dy / dist;
    }
  }

  /** Create sprint button for mobile (bottom-right) */
  createMobileSprintButton() {
    const zoom = CONFIG.MOBILE_CAMERA_ZOOM;
    // Desired screen position: (860, 450) — bottom-right
    const pos = this.screenToFixed(
      CONFIG.CANVAS_WIDTH + CONFIG.MOBILE_SPRINT_BTN_X_OFFSET,
      CONFIG.CANVAS_HEIGHT + CONFIG.MOBILE_SPRINT_BTN_Y_OFFSET
    );
    const btnX = pos.x;
    const btnY = pos.y;
    const radius = CONFIG.MOBILE_SPRINT_BTN_RADIUS / zoom;

    // Gold circle
    const circle = this.add.circle(btnX, btnY, radius, 0xFFD700, CONFIG.MOBILE_SPRINT_BTN_ALPHA)
      .setScrollFactor(0).setDepth(450);

    // "RUN" label (scale font for zoom)
    const label = this.add.text(btnX, btnY, 'RUN', {
      fontSize: `${Math.round(13 / zoom)}px`,
      fontFamily: 'monospace',
      fontStyle: 'bold',
      color: '#000000',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(451);

    // Invisible hit zone (larger)
    const hitZone = this.add.circle(btnX, btnY, radius + 15 / zoom, 0x000000, 0)
      .setScrollFactor(0).setDepth(452)
      .setInteractive();

    this.sprintButton = {
      circle, label, hitZone,
      active: false,
      pointerId: null,
    };

    hitZone.on('pointerdown', (pointer) => {
      this.sprintButton.active = true;
      this.sprintButton.pointerId = pointer.id;
      circle.setAlpha(CONFIG.MOBILE_SPRINT_BTN_ACTIVE_ALPHA);
      // Visual feedback: green when sprinting
      circle.setFillStyle(0x44ff44);
      label.setColor('#115511');
    });

    this.input.on('pointerup', (pointer) => {
      if (this.sprintButton.pointerId !== null && pointer.id === this.sprintButton.pointerId) {
        this.sprintButton.active = false;
        this.sprintButton.pointerId = null;
        circle.setAlpha(CONFIG.MOBILE_SPRINT_BTN_ALPHA);
        // Revert to gold
        circle.setFillStyle(0xFFD700);
        label.setColor('#000000');
      }
    });
  }

  /** Create a visible pause button for mobile (top-right corner) */
  createMobilePauseButton() {
    const zoom = CONFIG.MOBILE_CAMERA_ZOOM;
    const hitSize = CONFIG.MOBILE_PAUSE_HIT_SIZE / zoom;
    // Desired screen position: (910, 30) — top-right
    const pos = this.screenToFixed(CONFIG.CANVAS_WIDTH - 50, 30);
    const x = pos.x;
    const y = pos.y;

    // Semi-transparent dark circle for contrast
    const bgCircle = this.add.circle(x, y, 20 / zoom, 0x000000, 0.5)
      .setScrollFactor(0).setDepth(500);

    // Invisible hit area (larger touch target)
    const hitArea = this.add.rectangle(x, y, hitSize, hitSize, 0x000000, 0)
      .setScrollFactor(0).setDepth(502)
      .setInteractive({ useHandCursor: true });

    // Visible pause icon (two bars)
    const gfx = this.add.graphics().setScrollFactor(0).setDepth(501);
    gfx.fillStyle(0xffffff, 0.9);
    gfx.fillRect(x - 8 / zoom, y - 10 / zoom, 6 / zoom, 20 / zoom);
    gfx.fillRect(x + 2 / zoom, y - 10 / zoom, 6 / zoom, 20 / zoom);

    hitArea.on('pointerdown', () => this.togglePause());

    this.mobilePauseBtn = { hitArea, gfx, bgCircle };
  }

  /** Create a mute/unmute toggle button for mobile (left of pause button) */
  createMobileMuteButton() {
    const zoom = CONFIG.MOBILE_CAMERA_ZOOM;
    // Desired screen position: (860, 30) — top-right, left of pause
    const pos = this.screenToFixed(CONFIG.CANVAS_WIDTH - 100, 30);
    const x = pos.x;
    const y = pos.y;
    const hitSize = CONFIG.MOBILE_PAUSE_HIT_SIZE / zoom;

    // Semi-transparent dark circle background
    const bgCircle = this.add.circle(x, y, 20 / zoom, 0x000000, 0.5)
      .setScrollFactor(0).setDepth(500);

    // Hit area
    const hitArea = this.add.rectangle(x, y, hitSize, hitSize, 0x000000, 0)
      .setScrollFactor(0).setDepth(502)
      .setInteractive({ useHandCursor: true });

    // Text icon: musical note for unmuted, X for muted
    const icon = this.add.text(x, y, this.soundManager.muted ? 'x' : '♪', {
      fontSize: `${Math.round(20 / zoom)}px`, fontFamily: 'monospace', color: '#ffffff',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(501);

    hitArea.on('pointerdown', () => {
      this.soundManager.resume();
      this.soundManager.toggleMute();
      icon.setText(this.soundManager.muted ? 'x' : '♪');
    });

    this.mobileMuteBtn = { hitArea, bgCircle, icon };
  }

  /** Create off-screen department direction indicators for mobile */
  createDepartmentIndicators() {
    const ts = CONFIG.TILE_SIZE;
    const zoom = CONFIG.MOBILE_CAMERA_ZOOM;
    this.deptIndicators = [];

    for (const dept of DEPARTMENTS) {
      // Department center in world coordinates
      const worldX = (dept.position.x + dept.size.width / 2) * ts;
      const worldY = (dept.position.y + dept.size.height / 2) * ts;
      const color = parseInt(dept.color.replace('#', ''), 16);
      const abbrev = DEPARTMENT_ABBREV[dept.id] || dept.id;

      // Triangle pointing right (will be rotated toward department)
      const gfx = this.add.graphics().setScrollFactor(0).setDepth(300);
      const sz = CONFIG.MOBILE_DEPT_INDICATOR_SIZE / zoom;
      gfx.fillStyle(color, 1);
      gfx.fillTriangle(sz, 0, -sz * 0.6, -sz * 0.7, -sz * 0.6, sz * 0.7);
      gfx.lineStyle(1.5 / zoom, 0xffffff, 0.8);
      gfx.strokeTriangle(sz, 0, -sz * 0.6, -sz * 0.7, -sz * 0.6, sz * 0.7);

      // Abbreviation label
      const label = this.add.text(0, 0, abbrev, {
        fontSize: `${Math.round(10 / zoom)}px`,
        fontFamily: 'monospace',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 2 / zoom,
      }).setOrigin(0.5).setScrollFactor(0).setDepth(301);

      // Container holds both
      const container = this.add.container(0, 0, [gfx, label])
        .setScrollFactor(0).setDepth(300).setVisible(false);

      this.deptIndicators.push({
        container, gfx, label,
        worldX, worldY,
        deptId: dept.id,
        color,
        pulseTween: null,
        isPulsing: false,
      });
    }
  }

  /** Update off-screen department indicators each frame */
  updateDepartmentIndicators() {
    const cam = this.cameras.main;
    const view = cam.worldView;
    const zoom = CONFIG.MOBILE_CAMERA_ZOOM;
    const margin = CONFIG.MOBILE_DEPT_INDICATOR_MARGIN / zoom;
    // Game-coord center and half-extents for scrollFactor(0) positioning
    const centerX = CONFIG.CANVAS_WIDTH / 2;
    const centerY = CONFIG.CANVAS_HEIGHT / 2;
    const halfW = CONFIG.CANVAS_WIDTH / (2 * zoom) - margin;
    const halfH = CONFIG.CANVAS_HEIGHT / (2 * zoom) - margin;

    // Determine which departments the player's carried tasks need
    const neededDepts = new Set();
    if (this.player && this.player.inventory) {
      for (const task of this.player.inventory) {
        if (task.isDecoy) continue;
        const dept = task.getCurrentDepartment();
        if (dept) neededDepts.add(dept);
      }
    }

    for (const ind of this.deptIndicators) {
      // Check if department center is within camera view
      const inView = view.contains(ind.worldX, ind.worldY);

      if (inView) {
        ind.container.setVisible(false);
        this._stopIndicatorPulse(ind);
        continue;
      }

      ind.container.setVisible(true);

      // Calculate angle from camera center to department
      const camCenterX = view.x + view.width / 2;
      const camCenterY = view.y + view.height / 2;
      const angle = Math.atan2(ind.worldY - camCenterY, ind.worldX - camCenterX);

      // Rotate indicator triangle to point toward department
      ind.gfx.setRotation(angle);
      // Counter-rotate label so text stays upright
      ind.label.setRotation(-angle);

      // Ray-rect intersection: find t where ray hits edge of visible area
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      let t = Infinity;
      if (cos !== 0) t = Math.min(t, Math.abs(halfW / cos));
      if (sin !== 0) t = Math.min(t, Math.abs(halfH / sin));

      const sx = centerX + cos * t;
      const sy = centerY + sin * t;

      // Clamp within visible bounds
      const cx = Phaser.Math.Clamp(sx, centerX - halfW, centerX + halfW);
      const cy = Phaser.Math.Clamp(sy, centerY - halfH, centerY + halfH);
      ind.container.setPosition(cx, cy);

      // Pulse if department matches a carried task destination
      const isNeeded = neededDepts.has(ind.deptId);
      if (isNeeded && !ind.isPulsing) {
        ind.isPulsing = true;
        ind.pulseTween = this.tweens.add({
          targets: ind.container,
          alpha: { from: 1, to: 0.3 },
          duration: CONFIG.MOBILE_DEPT_INDICATOR_PULSE_MS,
          yoyo: true,
          repeat: -1,
        });
      } else if (!isNeeded && ind.isPulsing) {
        this._stopIndicatorPulse(ind);
      }

      // Non-task departments shown dimmer
      if (!isNeeded) {
        ind.container.setAlpha(0.7);
      }
    }
  }

  /** Stop pulse tween on a department indicator */
  _stopIndicatorPulse(ind) {
    if (ind.pulseTween) {
      ind.pulseTween.stop();
      ind.pulseTween = null;
    }
    ind.isPulsing = false;
    ind.container.setAlpha(1);
  }

  /** Handle pause/resume */
  togglePause() {
    if (this.isGameOver) return;

    this.isPaused = !this.isPaused;

    if (this.isPaused) {
      this.physics.pause();
      // Reset joystick and sprint button on pause
      if (this.joystick) {
        this.joystick.active = false;
        this.joystick.pointerId = null;
        this.joystick.dirX = 0;
        this.joystick.dirY = 0;
        this.joystick.thumb.setPosition(this.joystick.baseX, this.joystick.baseY);
      }
      if (this.sprintButton) {
        this.sprintButton.active = false;
        this.sprintButton.pointerId = null;
        if (this.sprintButton.circle) {
          this.sprintButton.circle.setAlpha(CONFIG.MOBILE_SPRINT_BTN_ALPHA);
        }
      }
      this.showPauseOverlay();
    } else {
      this.physics.resume();
      this.hidePauseOverlay();
    }
  }

  /** Show pause overlay */
  showPauseOverlay() {
    if (this.pauseOverlay) return;

    const isTouch = isTouchDevice();
    const zoom = isTouch ? CONFIG.MOBILE_CAMERA_ZOOM : 1;
    // Canvas center is always the fixed-point of the zoom transform
    const cx = CONFIG.CANVAS_WIDTH / 2;
    const cy = CONFIG.CANVAS_HEIGHT / 2;

    // All pause elements stored for cleanup
    this.pauseElements = [];

    const addPauseElement = (element) => {
      element.setScrollFactor(0).setDepth(500);
      this.pauseElements.push(element);
      return element;
    };

    // Dim background
    addPauseElement(this.add.rectangle(cx, cy, CONFIG.CANVAS_WIDTH / zoom, CONFIG.CANVAS_HEIGHT / zoom, 0x000000, 0.6));

    // Scale spacing and sizes for zoom
    const s = (v) => v / zoom;

    // PAUSED text
    addPauseElement(this.add.text(cx, cy - s(60), 'PAUSED', {
      fontSize: `${Math.round(s(40))}px`,
      fontFamily: 'monospace',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5));

    // Resume button
    const resumeBg = addPauseElement(
      this.add.rectangle(cx, cy, s(160), s(36), 0x4169E1)
        .setInteractive({ useHandCursor: true })
    );
    const resumeText = addPauseElement(this.add.text(cx, cy, isTouch ? 'Resume' : 'Resume (P)', {
      fontSize: `${Math.round(s(16))}px`, fontFamily: 'monospace', color: '#ffffff',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }));
    resumeBg.on('pointerdown', () => this.togglePause());
    resumeText.on('pointerdown', () => this.togglePause());

    // How to Play button
    const htpBg = addPauseElement(
      this.add.rectangle(cx, cy + s(50), s(160), s(36), 0x555555)
        .setInteractive({ useHandCursor: true })
    );
    const htpText = addPauseElement(this.add.text(cx, cy + s(50), isTouch ? 'How to Play' : 'How to Play (H)', {
      fontSize: `${Math.round(s(16))}px`, fontFamily: 'monospace', color: '#ffffff',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }));
    htpBg.on('pointerdown', () => this.showHowToPlay());
    htpText.on('pointerdown', () => this.showHowToPlay());

    // Restart button
    const restartBg = addPauseElement(
      this.add.rectangle(cx, cy + s(100), s(160), s(36), 0x555555)
        .setInteractive({ useHandCursor: true })
    );
    const restartText = addPauseElement(this.add.text(cx, cy + s(100), isTouch ? 'Restart' : 'Restart (R)', {
      fontSize: `${Math.round(s(16))}px`, fontFamily: 'monospace', color: '#ffffff',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }));
    restartBg.on('pointerdown', () => this.pauseRestart());
    restartText.on('pointerdown', () => this.pauseRestart());

    // Quit button
    const quitBg = addPauseElement(
      this.add.rectangle(cx, cy + s(150), s(160), s(36), 0x555555)
        .setInteractive({ useHandCursor: true })
    );
    const quitText = addPauseElement(this.add.text(cx, cy + s(150), isTouch ? 'Quit to Menu' : 'Quit to Menu (Q)', {
      fontSize: `${Math.round(s(16))}px`, fontFamily: 'monospace', color: '#ffffff',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }));
    quitBg.on('pointerdown', () => this.pauseQuit());
    quitText.on('pointerdown', () => this.pauseQuit());

    // Sound toggle — tappable button on mobile, static hint on desktop
    if (isTouch) {
      const soundLabel = this.soundManager.muted ? 'Sound: OFF' : 'Sound: ON';
      addPauseElement(
        this.add.rectangle(cx, cy + s(200), s(160), s(36), 0x2E8B57)
      );
      const soundText = addPauseElement(this.add.text(cx, cy + s(200), soundLabel, {
        fontSize: `${Math.round(s(14))}px`, fontFamily: 'monospace', color: '#ffffff',
      }).setOrigin(0.5).setInteractive({ useHandCursor: true }));
      const toggleSound = () => {
        this.soundManager.resume();
        this.soundManager.toggleMute();
        soundText.setText(this.soundManager.muted ? 'Sound: OFF' : 'Sound: ON');
        if (this.mobileMuteBtn && this.mobileMuteBtn.icon) {
          this.mobileMuteBtn.icon.setText(this.soundManager.muted ? 'x' : '♪');
        }
      };
      soundText.on('pointerdown', toggleSound);
    } else {
      addPauseElement(this.add.text(cx, cy + s(200), 'M to toggle sound', {
        fontSize: `${Math.round(s(11))}px`, fontFamily: 'monospace', color: '#888888',
      }).setOrigin(0.5));
    }

    // Keyboard shortcuts for pause menu
    this._pauseKeyR = (e) => { if (this.isPaused) this.pauseRestart(); };
    this._pauseKeyQ = (e) => { if (this.isPaused) this.pauseQuit(); };
    this._pauseKeyH = (e) => { if (this.isPaused) this.showHowToPlay(); };
    this.input.keyboard.on('keydown-R', this._pauseKeyR);
    this.input.keyboard.on('keydown-Q', this._pauseKeyQ);
    this.input.keyboard.on('keydown-H', this._pauseKeyH);

    this.pauseOverlay = true;
  }

  /** Restart game from pause menu */
  pauseRestart() {
    this.isPaused = false;
    this.physics.resume();
    this.hidePauseOverlay();
    this.scene.stop('UIScene');
    this.scene.restart();
  }

  /** Quit to title from pause menu */
  pauseQuit() {
    this.isPaused = false;
    this.physics.resume();
    this.hidePauseOverlay();
    this.scene.stop('UIScene');
    this.scene.start('TitleScene');
  }

  /** Hide pause overlay */
  hidePauseOverlay() {
    if (this.pauseOverlay && this.pauseElements) {
      for (const el of this.pauseElements) {
        el.destroy();
      }
      this.pauseElements = [];
      this.pauseOverlay = null;

      // Clean up pause key listeners
      if (this._pauseKeyR) {
        this.input.keyboard.off('keydown-R', this._pauseKeyR);
        this._pauseKeyR = null;
      }
      if (this._pauseKeyQ) {
        this.input.keyboard.off('keydown-Q', this._pauseKeyQ);
        this._pauseKeyQ = null;
      }
      if (this._pauseKeyH) {
        this.input.keyboard.off('keydown-H', this._pauseKeyH);
        this._pauseKeyH = null;
      }
    }
  }

  /** Open How to Play from pause menu */
  showHowToPlay() {
    this.hidePauseOverlay();
    this.scene.launch('HowToPlayScene', { source: 'pause' });
  }

  /** Trigger game over sequence with visual polish */
  gameOver(won) {
    if (this.isGameOver) return;
    this.isGameOver = true;

    console.log(`[GameScene] Game Over - ${won ? 'WIN' : 'LOSE'}`);

    // Stop background music
    if (this.soundManager) this.soundManager.stopBGM();

    // Pause physics
    this.physics.pause();

    const stats = {
      tier: this.progressionManager.currentTier,
      level: this.progressionManager.level,
      timeSurvived: formatTime(this.elapsedTime),
      tasksDelivered: this.taskManager.tasksDelivered,
      peakStress: this.stressManager.peakStress,
      totalXP: this.progressionManager.totalXP,
      milestones: this.progressionManager.milestoneCount,
      rangIPOBell: this.progressionManager.milestoneCount >= CONFIG.MILESTONE_IPO_BELL,
    };

    this.events.emit('game-over', { won, stats });

    trackEvent('game_over', {
      result: won ? 'win' : 'loss',
      final_tier: stats.tier,
      final_level: stats.level,
      time_survived: this.elapsedTime,
      tasks_delivered: stats.tasksDelivered,
    });

    const fx = CONFIG.EFFECTS;

    if (won) {
      // Victory: golden flash + confetti
      this.particleManager.screenFlash(fx.FLASH_ALPHA, fx.FLASH_DURATION * 2, 0xFFD700);
      if (this.player) {
        this.particleManager.promotion(this.player.x, this.player.y);
      }
      this.soundManager.playVictory();
    } else {
      // Loss: red flash + shake + "STRESS OVERLOAD" text
      this.particleManager.screenFlash(fx.FLASH_ALPHA, fx.FLASH_DURATION * 2, 0xff2222);
      this.cameras.main.shake(fx.SHAKE_DURATION * 1.5, fx.SHAKE_INTENSITY * 2);
      this.soundManager.playGameOver();

      // "STRESS OVERLOAD" text centered on screen (canvas center is zoom fixed-point)
      const olZoom = isTouchDevice() ? CONFIG.MOBILE_CAMERA_ZOOM : 1;
      const overloadText = this.add.text(
        CONFIG.CANVAS_WIDTH / 2, CONFIG.CANVAS_HEIGHT / 2,
        'STRESS OVERLOAD', {
          fontSize: `${Math.round(36 / olZoom)}px`,
          fontFamily: 'monospace',
          color: '#ff2222',
          fontStyle: 'bold',
          stroke: '#000000',
          strokeThickness: 4,
        }
      ).setOrigin(0.5).setScrollFactor(0).setDepth(500).setAlpha(0);

      // Fade in the overload text
      this.tweens.add({
        targets: overloadText,
        alpha: 1,
        duration: fx.GAME_OVER_TEXT_FADE,
      });
    }

    // Launch game over scene after delay (allows flash/shake to play out)
    this.time.delayedCall(CONFIG.GAME_OVER_DELAY, () => {
      // Disable GameScene input so it can't intercept keys (e.g. ESC → togglePause)
      this.input.enabled = false;
      this.input.keyboard.enabled = false;

      this.scene.launch('GameOverScene', { won, stats });
      this.scene.bringToTop('GameOverScene');
    });
  }

  /** Clean up event listeners and systems */
  shutdown() {
    this.events.off('stress-max', this._onStressMax);
    this.events.off('level-up', this._onLevelUp);
    this.events.off('ceo-milestone', this._onCeoMilestone);

    // Polish event cleanup
    this.events.off('task-picked-up', this._onPolishPickup);
    this.events.off('task-delivered', this._onPolishDelivery);
    this.events.off('task-expired', this._onPolishExpiry);
    this.events.off('level-up', this._onPolishLevelUp);
    this.events.off('agent-disruption', this._onPolishDisruption);
    this.events.off('stress-changed', this._onVignetteStressChanged);
    this.events.off('stress-threshold', this._onPolishStressThreshold);

    // Stop vignette pulse tween and destroy glow image
    this._stopVignettePulse();
    if (this.vignetteImage) {
      this.vignetteImage.destroy();
      this.vignetteImage = null;
    }
    if (this.textures.exists('vignette-glow')) {
      this.textures.remove('vignette-glow');
    }

    // Orientation handler cleanup
    if (this._orientationHandler) {
      window.removeEventListener('resize', this._orientationHandler);
    }

    // Mobile joystick cleanup
    if (this.joystick) {
      this.joystick.base.destroy();
      this.joystick.thumb.destroy();
      this.joystick.hitZone.destroy();
      this.joystick = null;
    }

    // Mobile sprint button cleanup
    if (this.sprintButton) {
      this.sprintButton.circle.destroy();
      this.sprintButton.label.destroy();
      this.sprintButton.hitZone.destroy();
      this.sprintButton = null;
    }

    // Department indicator cleanup
    if (this.deptIndicators) {
      for (const ind of this.deptIndicators) {
        if (ind.pulseTween) ind.pulseTween.stop();
        ind.container.destroy();
      }
      this.deptIndicators = null;
    }

    if (this.taskManager) this.taskManager.destroy();
    if (this.stressManager) this.stressManager.destroy();
    if (this.progressionManager) this.progressionManager.destroy();
    if (this.upgradeManager) this.upgradeManager.destroy();
    if (this.waveManager) this.waveManager.destroy();
    if (this.particleManager) this.particleManager.destroy();
    if (this.soundManager) this.soundManager.destroy();
    if (window.game) delete window.game;
  }
}
