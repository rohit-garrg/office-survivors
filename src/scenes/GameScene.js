import Phaser from 'phaser';
import CONFIG from '../config/gameConfig.js';
import { DEPARTMENTS, OBSTACLES, ROOM_WALLS, PLAYER_START } from '../config/mapData.js';
import { Player } from '../entities/Player.js';
import { TASK_STATES } from '../entities/Task.js';
import { TaskManager } from '../systems/TaskManager.js';
import { StressManager } from '../systems/StressManager.js';
import { ProgressionManager } from '../systems/ProgressionManager.js';
import { UpgradeManager } from '../systems/UpgradeManager.js';
import { WaveManager } from '../systems/WaveManager.js';
import { ParticleManager } from '../systems/ParticleManager.js';
import { SoundManager } from '../systems/SoundManager.js';
import { tileToPixel, formatTime } from '../utils/helpers.js';
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

      // Always grant the passive stress decay bonus
      this.stressManager.addMilestoneDecay(CONFIG.MILESTONE_STRESS_DECAY_BONUS);

      // Get upgrade options — if pool is empty, skip popup
      const upgrades = this.upgradeManager.getUpgradeOptions(this.progressionManager.level);
      if (!upgrades || upgrades.length === 0) {
        console.debug('[GameScene] CEO milestone #' + data.milestoneNumber + ' — no upgrades, silent stress bonus');
        this.events.emit('milestone-bonus', { milestoneNumber: data.milestoneNumber });
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
        console.debug('[GameScene] CEO milestone #' + data.milestoneNumber + ' — all upgrades stale, silent stress bonus');
        this.events.emit('milestone-bonus', { milestoneNumber: data.milestoneNumber });
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

    // Create vignette overlay (4 edge rectangles, hidden by default)
    this.createVignette();

    // Wire particle + sound events
    this.wirePolishEvents();

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

      // Visual zone (tiled)
      for (let x = 0; x < dept.size.width; x++) {
        for (let y = 0; y < dept.size.height; y++) {
          this.add.image(
            px + x * ts + ts / 2,
            py + y * ts + ts / 2,
            `zone_${dept.id}`
          ).setDepth(1);
        }
      }

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

    // Room walls from mapData
    for (const wall of ROOM_WALLS) {
      for (let x = wall.x; x < wall.x + wall.width; x++) {
        for (let y = wall.y; y < wall.y + wall.height; y++) {
          if (x === 0 || x === CONFIG.MAP_WIDTH_TILES - 1 ||
              y === 0 || y === CONFIG.MAP_HEIGHT_TILES - 1) continue;
          this.addWall(x, y);
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
    decor(20, 7, 'env-water-dispenser');
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

    // Posters on internal walls
    decor(2, 7, 'poster-1', 6);
    decor(5, 7, 'poster-2', 6);
    decor(2, 17, 'poster-3', 6);
    decor(5, 17, 'poster-4', 6);
    decor(34, 7, 'poster-1', 6);
    decor(37, 7, 'poster-3', 6);
    decor(34, 17, 'poster-2', 6);
    decor(37, 17, 'poster-4', 6);

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

  /** Helper to add a wall tile at grid position */
  addWall(tileX, tileY) {
    const ts = CONFIG.TILE_SIZE;
    const wall = this.wallGroup.create(
      tileX * ts + ts / 2, tileY * ts + ts / 2, 'wall'
    );
    wall.setDepth(5);
    wall.refreshBody();
  }

  /** Initialize physics groups for walls, tasks, zones, agents */
  createPhysicsGroups() {
    // Task physics group — tasks added by TaskManager
    this.taskGroup = this.physics.add.group();
  }

  /** Set up camera: zoom to show entire map, centered (no follow) */
  setupCamera() {
    const cam = this.cameras.main;
    cam.setZoom(CONFIG.CAMERA_ZOOM);
    cam.centerOn(this.mapWidth / 2, this.mapHeight / 2);
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

  /** Create vignette overlay: 4 edge rectangles for stress feedback */
  createVignette() {
    const w = CONFIG.CANVAS_WIDTH;
    const h = CONFIG.CANVAS_HEIGHT;
    const vw = CONFIG.EFFECTS.VIGNETTE_WIDTH;

    // Top, bottom, left, right edge overlays
    this.vignetteTop = this.add.rectangle(w / 2, vw / 2, w, vw, 0xff0000, 0)
      .setScrollFactor(0).setDepth(400);
    this.vignetteBottom = this.add.rectangle(w / 2, h - vw / 2, w, vw, 0xff0000, 0)
      .setScrollFactor(0).setDepth(400);
    this.vignetteLeft = this.add.rectangle(vw / 2, h / 2, vw, h, 0xff0000, 0)
      .setScrollFactor(0).setDepth(400);
    this.vignetteRight = this.add.rectangle(w - vw / 2, h / 2, vw, h, 0xff0000, 0)
      .setScrollFactor(0).setDepth(400);

    this.vignetteEdges = [this.vignetteTop, this.vignetteBottom, this.vignetteLeft, this.vignetteRight];
    this.vignettePulseTween = null;
  }

  /**
   * Update vignette appearance based on stress threshold.
   * @param {string|null} level - 'yellow', 'orange', 'red', or null (clear)
   */
  updateVignette(level) {
    const fx = CONFIG.EFFECTS;

    // Stop any existing pulse tween
    if (this.vignettePulseTween) {
      this.vignettePulseTween.stop();
      this.vignettePulseTween = null;
    }

    if (!level) {
      // Clear vignette
      for (const edge of this.vignetteEdges) {
        edge.setAlpha(0);
      }
      return;
    }

    let color, alpha;
    switch (level) {
      case 'yellow':
        color = 0xddcc00;
        alpha = fx.VIGNETTE_YELLOW_ALPHA;
        break;
      case 'orange':
        color = 0xff8800;
        alpha = fx.VIGNETTE_ORANGE_ALPHA;
        break;
      case 'red':
        color = 0xff2222;
        alpha = fx.VIGNETTE_RED_ALPHA_MIN;
        break;
      default:
        return;
    }

    for (const edge of this.vignetteEdges) {
      edge.setFillStyle(color);
      edge.setAlpha(alpha);
    }

    // Pulsing for red threshold
    if (level === 'red') {
      this.vignettePulseTween = this.tweens.add({
        targets: this.vignetteEdges,
        alpha: { from: fx.VIGNETTE_RED_ALPHA_MIN, to: fx.VIGNETTE_RED_ALPHA_MAX },
        duration: fx.VIGNETTE_PULSE_DURATION,
        yoyo: true,
        repeat: -1,
      });
    }
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

    // Stress threshold — vignette + warning sound
    this._onPolishStressThreshold = (data) => {
      this.updateVignette(data.level);
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
    this.input.once('pointerdown', () => {
      this.soundManager.resume();
      this.soundManager.startBGM();
    });

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

  /** Handle pause/resume */
  togglePause() {
    if (this.isGameOver) return;

    this.isPaused = !this.isPaused;

    if (this.isPaused) {
      this.physics.pause();
      this.showPauseOverlay();
    } else {
      this.physics.resume();
      this.hidePauseOverlay();
    }
  }

  /** Show pause overlay */
  showPauseOverlay() {
    if (this.pauseOverlay) return;

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
    addPauseElement(this.add.rectangle(cx, cy, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT, 0x000000, 0.6));

    // PAUSED text
    addPauseElement(this.add.text(cx, cy - 60, 'PAUSED', {
      fontSize: '40px',
      fontFamily: 'monospace',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5));

    // Resume button
    const resumeBg = addPauseElement(
      this.add.rectangle(cx, cy, 160, 36, 0x4169E1)
        .setInteractive({ useHandCursor: true })
    );
    addPauseElement(this.add.text(cx, cy, 'Resume (P)', {
      fontSize: '16px', fontFamily: 'monospace', color: '#ffffff',
    }).setOrigin(0.5));
    resumeBg.on('pointerdown', () => this.togglePause());

    // How to Play button
    const htpBg = addPauseElement(
      this.add.rectangle(cx, cy + 50, 160, 36, 0x555555)
        .setInteractive({ useHandCursor: true })
    );
    addPauseElement(this.add.text(cx, cy + 50, 'How to Play (H)', {
      fontSize: '16px', fontFamily: 'monospace', color: '#ffffff',
    }).setOrigin(0.5));
    htpBg.on('pointerdown', () => this.showHowToPlay());

    // Restart button
    const restartBg = addPauseElement(
      this.add.rectangle(cx, cy + 100, 160, 36, 0x555555)
        .setInteractive({ useHandCursor: true })
    );
    addPauseElement(this.add.text(cx, cy + 100, 'Restart (R)', {
      fontSize: '16px', fontFamily: 'monospace', color: '#ffffff',
    }).setOrigin(0.5));
    restartBg.on('pointerdown', () => this.pauseRestart());

    // Quit button
    const quitBg = addPauseElement(
      this.add.rectangle(cx, cy + 150, 160, 36, 0x555555)
        .setInteractive({ useHandCursor: true })
    );
    addPauseElement(this.add.text(cx, cy + 150, 'Quit to Menu (Q)', {
      fontSize: '16px', fontFamily: 'monospace', color: '#ffffff',
    }).setOrigin(0.5));
    quitBg.on('pointerdown', () => this.pauseQuit());

    // Sound hint
    addPauseElement(this.add.text(cx, cy + 200, 'M to toggle sound', {
      fontSize: '11px', fontFamily: 'monospace', color: '#888888',
    }).setOrigin(0.5));

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

      // "STRESS OVERLOAD" text centered on screen
      const overloadText = this.add.text(
        CONFIG.CANVAS_WIDTH / 2, CONFIG.CANVAS_HEIGHT / 2,
        'STRESS OVERLOAD', {
          fontSize: '36px',
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
      this.scene.launch('GameOverScene', { won, stats });
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
    this.events.off('stress-threshold', this._onPolishStressThreshold);

    // Stop vignette pulse tween
    if (this.vignettePulseTween) {
      this.vignettePulseTween.stop();
      this.vignettePulseTween = null;
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
