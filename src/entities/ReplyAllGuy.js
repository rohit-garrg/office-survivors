import { ChaosAgent } from './ChaosAgent.js';
import CONFIG from '../config/gameConfig.js';
import { OBSTACLES, TASK_SPAWN_POINTS, DEPARTMENT_COLORS } from '../config/mapData.js';
import { randomFrom, tileToPixel, distance } from '../utils/helpers.js';

/**
 * The Reply-All Guy: walks to desks/printers, pauses, then bursts tasks.
 *
 * - Walks to a random desk/printer position at REPLYALL_SPEED (65 px/s)
 * - Pauses 1 second on arrival
 * - Spawns REPLYALL_TASK_BURST (3) tasks at spawn points 160px+ from player
 * - Cooldown of REPLYALL_COOLDOWN (10s) between bursts
 * - Visual: email particle burst on explosion
 */
export class ReplyAllGuy extends ChaosAgent {
  constructor(scene, x, y) {
    const texture = scene.textures.exists('agent-replyall') ? 'agent-replyall' : 'agent_replyallguy';
    super(scene, x, y, texture, 'reply_all_guy');
    this.speed = CONFIG.REPLYALL_SPEED;
    this.animPrefix = scene.textures.exists('agent-replyall') ? 'replyall' : null;

    // Education properties
    this.displayName = 'Reply-All Guy';
    this.description = 'Walks to desks and bursts 3 extra tasks. Watch the desk areas.';
    this.speechLines = [
      'RE: RE: RE: RE: FW:',
      'Adding everyone...',
      '+whole-company@',
      'Per my last email...',
      'Bumping this thread!',
      'Oops wrong thread!',
    ];

    /** @type {number} Timestamp of last burst */
    this.lastBurstTime = 0;

    /** @type {boolean} Whether currently pausing at a desk */
    this._isPausing = false;

    /** @type {number} Time remaining in pause */
    this._pauseTimer = 0;

    /** @type {boolean} Whether on cooldown between bursts */
    this._onCooldown = false;

    /** @type {number} Cooldown time remaining */
    this._cooldownTimer = 0;

    // Enrage: 2 min after spawn — larger burst size
    this.enrageTime = CONFIG.ENRAGE_REPLYALL_TIME;
  }

  /** Escalate stats on enrage */
  onEnrage() {
    console.debug('[ReplyAllGuy] enraged: burst size increased');
  }

  /** Get current burst count (enraged = more tasks) */
  getBurstCount() {
    return this.isEnraged ? CONFIG.ENRAGE_REPLYALL_BURST : CONFIG.REPLYALL_TASK_BURST;
  }

  /** Walk to desk, pause, burst tasks, repeat */
  update(time, delta) {
    if (!this.isActive) return;

    // Handle cooldown
    if (this._onCooldown) {
      this._cooldownTimer -= delta;
      if (this._cooldownTimer <= 0) {
        this._onCooldown = false;
        this.pickNextTarget();
      }
      // Still move during cooldown — wander to next desk
      super.update(time, delta);
      return;
    }

    // Handle pause at desk
    if (this._isPausing) {
      this._pauseTimer -= delta;
      if (this.body) this.body.setVelocity(0, 0);
      if (this._pauseTimer <= 0) {
        this._isPausing = false;
        this.burstTasks(time);
      }
      this.updateEducationVisuals(delta);
      return;
    }

    // If no target, pick one
    if (!this.target) {
      this.pickNextTarget();
    }

    super.update(time, delta);
  }

  /** When stuck navigating to a desk, pick a different one */
  onStuck() {
    console.debug('[ReplyAllGuy] stuck, picking new target desk');
    this.pickNextTarget();
  }

  /** Called when arriving at a desk/printer target */
  onArrived() {
    // Start the pause before bursting
    this._isPausing = true;
    this._pauseTimer = CONFIG.REPLYALL_PAUSE_DURATION;
    this.target = null;
    console.debug('[ReplyAllGuy] arrived at desk, pausing 1s');
  }

  /**
   * Pick a desk/printer obstacle near the player as the next target.
   * Sorts obstacles by distance to player and picks randomly from the
   * REPLYALL_NEAR_PLAYER_COUNT (3) closest. Falls back to fully random
   * if player is unavailable.
   */
  pickNextTarget() {
    if (OBSTACLES.length === 0) return;

    let obs;
    const player = this.scene.player;

    if (player && OBSTACLES.length > CONFIG.REPLYALL_NEAR_PLAYER_COUNT) {
      // Sort obstacles by distance to player (ascending)
      const sorted = [...OBSTACLES].sort((a, b) => {
        const posA = tileToPixel(a.x + a.width / 2, a.y + a.height / 2, CONFIG.TILE_SIZE);
        const posB = tileToPixel(b.x + b.width / 2, b.y + b.height / 2, CONFIG.TILE_SIZE);
        const distA = distance(posA.x, posA.y, player.x, player.y);
        const distB = distance(posB.x, posB.y, player.x, player.y);
        return distA - distB;
      });
      obs = randomFrom(sorted.slice(0, CONFIG.REPLYALL_NEAR_PLAYER_COUNT));
    } else {
      obs = randomFrom(OBSTACLES);
    }

    // Target center of obstacle
    const pos = tileToPixel(
      obs.x + obs.width / 2,
      obs.y + obs.height / 2,
      CONFIG.TILE_SIZE
    );

    // Stand next to the obstacle (offset slightly so we don't collide into it)
    const offsetX = (Math.random() > 0.5 ? 1 : -1) * CONFIG.TILE_SIZE;
    this.setTarget(pos.x + offsetX, pos.y);
  }

  /**
   * Spawn burst of tasks at spawn points far from player.
   * Uses the TaskManager pool — tasks count toward TASK_MAX_ON_MAP.
   */
  burstTasks(time) {
    const taskManager = this.scene.taskManager;
    const player = this.scene.player;
    if (!taskManager || !player) return;

    // Find spawn points at least 160px from player
    const validPoints = TASK_SPAWN_POINTS.filter((point) => {
      const pos = tileToPixel(point.x, point.y, CONFIG.TILE_SIZE);
      return distance(pos.x, pos.y, player.x, player.y) >= CONFIG.REPLYALL_MIN_SPAWN_DIST;
    });

    if (validPoints.length === 0) {
      console.debug('[ReplyAllGuy] no valid spawn points far enough from player');
      this.startCooldown();
      return;
    }

    let spawned = 0;
    const deptIds = Object.keys(DEPARTMENT_COLORS);

    for (let i = 0; i < this.getBurstCount(); i++) {
      // Allow overcap: Reply-All can push 2 tasks above the normal cap
      const overcapLimit = CONFIG.TASK_MAX_ON_MAP + CONFIG.REPLYALL_OVERCAP;
      if (taskManager.getActiveCount() >= overcapLimit) {
        console.debug('[ReplyAllGuy] overcap reached, stopping burst');
        break;
      }

      const task = taskManager.getFromPool();
      if (!task) break;

      const point = randomFrom(validPoints);
      const pos = tileToPixel(point.x, point.y, CONFIG.TILE_SIZE);
      const dept = randomFrom(deptIds);

      task.spawn({
        name: 'Reply-All Thread',
        department: dept,
        route: null,
        stops: 1,
        x: pos.x,
        y: pos.y,
        spawnTime: time,
        isDecoy: false,
        isReplyAll: true,
      });

      taskManager.activeTasks.push(task);
      this.scene.events.emit('task-spawned', { task });
      spawned++;
    }

    console.debug(`[ReplyAllGuy] burst ${spawned} tasks`);

    // Email particle burst visual
    this.showEmailBurst();

    this.scene.events.emit('agent-disruption', {
      type: 'reply_all_guy',
      effect: 'task_burst',
      position: { x: this.x, y: this.y },
    });

    this.startCooldown();
  }

  /** Start cooldown between bursts */
  startCooldown() {
    this._onCooldown = true;
    this._cooldownTimer = CONFIG.REPLYALL_COOLDOWN;
    this.pickNextTarget(); // Wander during cooldown
  }

  /** Visual: simple particle burst of white dots (email icons) */
  showEmailBurst() {
    const count = CONFIG.REPLYALL_BURST_PARTICLE_COUNT;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count;
      const speed = 60 + Math.random() * 40;
      const dot = this.scene.add.circle(
        this.x, this.y, 3, 0xffffff, 1
      ).setDepth(20);

      this.scene.tweens.add({
        targets: dot,
        x: this.x + Math.cos(angle) * speed,
        y: this.y + Math.sin(angle) * speed,
        alpha: 0,
        scale: 0.3,
        duration: CONFIG.REPLYALL_BURST_ANIMATION_DURATION,
        ease: 'Power2',
        onComplete: () => dot.destroy(),
      });
    }
  }
}
