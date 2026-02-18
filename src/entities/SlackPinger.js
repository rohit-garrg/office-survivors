import { ChaosAgent } from './ChaosAgent.js';
import CONFIG from '../config/gameConfig.js';
import { TASK_SPAWN_POINTS, DEPARTMENT_COLORS } from '../config/mapData.js';
import { randomFrom, randomInt, tileToPixel } from '../utils/helpers.js';
import { TASK_STATES } from '../entities/Task.js';
import Phaser from 'phaser';

/**
 * The Slack Pinger: wanders and spawns decoy tasks.
 *
 * - Wanders like Chatty Colleague (random direction, 2-4s changes)
 * - Every DECOY_SPAWN_INTERVAL (8s), spawns 1 decoy task at random spawn point
 * - Decoys: 50% opacity, subtle pulse animation
 * - Picking up a decoy wastes 1 carry slot for 3s, then vanishes + 2% stress
 * - Unpicked decoys vanish after DECOY_LIFETIME (6s), no stress penalty
 * - Reply-All Filter upgrade: decoys glow bright red (obvious tell)
 */
export class SlackPinger extends ChaosAgent {
  constructor(scene, x, y) {
    const texture = scene.textures.exists('agent-slack') ? 'agent-slack' : 'agent_slackpinger';
    super(scene, x, y, texture, 'slack_pinger');
    this.animPrefix = scene.textures.exists('agent-slack') ? 'slack' : null;
    this.speed = CONFIG.SLACKPINGER_SPEED;

    // Education properties
    this.displayName = 'Slack Pinger';
    this.description = 'Spawns fake pulsing tasks. Picking one wastes time + adds stress.';
    this.speechLines = [
      '@channel',
      'Anyone online?',
      '*typing...*',
      'Check DMs!',
      'New thread started',
      'Emoji react = yes',
    ];

    /** @type {number} Time until next decoy spawn */
    this._decoyTimer = CONFIG.DECOY_SPAWN_INTERVAL;

    /** @type {number} Time until next direction change */
    this._directionTimer = 0;

    /** @type {{x: number, y: number}} Current wander direction */
    this._wanderDir = { x: 0, y: 0 };

    /** @type {Array} Active decoy tasks on the map (for cleanup tracking) */
    this._activeDecoys = [];

    // Enrage: 2 min after spawn — faster decoys + larger stress aura
    this.enrageTime = CONFIG.ENRAGE_SLACKPINGER_TIME;
  }

  /** Escalate stats on enrage */
  onEnrage() {
    console.debug('[SlackPinger] enraged: faster decoy spawn + larger aura');
  }

  /** Get current decoy spawn interval (enraged = faster) */
  getDecoyInterval() {
    return this.isEnraged ? CONFIG.ENRAGE_SLACKPINGER_DECOY_INTERVAL : CONFIG.DECOY_SPAWN_INTERVAL;
  }

  /** Get current aura range (enraged = larger) */
  getAuraRange() {
    return this.isEnraged ? CONFIG.ENRAGE_SLACKPINGER_AURA_RANGE : CONFIG.SLACKPINGER_AURA_RANGE;
  }

  /** Wander and periodically spawn decoy tasks */
  update(time, delta) {
    if (!this.isActive) return;

    // Wander: change direction periodically
    this._directionTimer -= delta;
    if (this._directionTimer <= 0) {
      this.changeDirection();
    }

    // Move in current wander direction
    const effectiveSpeed = this.getEffectiveSpeed();
    const vx = this._wanderDir.x * effectiveSpeed;
    const vy = this._wanderDir.y * effectiveSpeed;
    if (this.body) {
      this.body.setVelocity(vx, vy);
    }
    this.updateAgentAnimation(vx, vy);

    // Keep within map bounds
    this.clampToMap();

    // Stuck detection: force direction change if blocked by furniture
    if (this.checkWanderStuck(delta)) {
      this.changeDirection();
    }

    // Stress aura: player gains stress when within range
    this.applyStressAura(delta);

    // Decoy spawn timer
    this._decoyTimer -= delta;
    if (this._decoyTimer <= 0) {
      this.spawnDecoy(time);
      this._decoyTimer = this.getDecoyInterval();
    }

    // Check decoy lifetimes (remove expired ones)
    this.updateDecoys(time);

    // Base class handles education visuals (name label, periodic speech, info panel)
    this.updateEducationVisuals(delta);
  }

  /**
   * Apply stress to the player when within aura range.
   * AirPods does NOT counter this (aura is stress, not movement impairment).
   */
  applyStressAura(delta) {
    const player = this.scene.player;
    if (!player) return;

    const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
    if (dist <= this.getAuraRange()) {
      const stressManager = this.scene.stressManager;
      if (stressManager) {
        const stressAmount = CONFIG.SLACKPINGER_AURA_STRESS_RATE * (delta / 1000);
        stressManager.addInstantStress(stressAmount, 'slack-pinger-aura');
      }
    }
  }

  /**
   * Pick a wander direction with player-seeking bias.
   * AGENT_WANDER_SEEK_CHANCE (35%) → compass direction closest to player.
   * Otherwise → random direction excluding the current one.
   */
  changeDirection() {
    const directions = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
      { x: 1, y: 1 },
      { x: -1, y: -1 },
      { x: 1, y: -1 },
      { x: -1, y: 1 },
    ];

    let dir;
    const player = this.scene.player;

    if (player && Math.random() < CONFIG.AGENT_WANDER_SEEK_CHANCE) {
      // Pick the compass direction closest to the player (dot product)
      const dx = player.x - this.x;
      const dy = player.y - this.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const nx = dx / len;
      const ny = dy / len;

      let bestDot = -Infinity;
      let bestDir = directions[0];
      for (const d of directions) {
        const mag = Math.sqrt(d.x * d.x + d.y * d.y);
        const dot = (d.x / mag) * nx + (d.y / mag) * ny;
        if (dot > bestDot) {
          bestDot = dot;
          bestDir = d;
        }
      }
      dir = bestDir;
    } else {
      // Random direction excluding the current one
      const currentX = this._wanderDir.x;
      const currentY = this._wanderDir.y;
      const filtered = directions.filter((d) => {
        const mag = Math.sqrt(d.x * d.x + d.y * d.y);
        return !(Math.abs(d.x / mag - currentX) < 0.01 && Math.abs(d.y / mag - currentY) < 0.01);
      });
      dir = randomFrom(filtered.length > 0 ? filtered : directions);
    }

    const mag = Math.sqrt(dir.x * dir.x + dir.y * dir.y);
    this._wanderDir = { x: dir.x / mag, y: dir.y / mag };
    this._directionTimer = randomInt(CONFIG.AGENT_WANDER_DIR_CHANGE_MIN, CONFIG.AGENT_WANDER_DIR_CHANGE_MAX);
  }

  /** Keep agent within playable map area */
  clampToMap() {
    const margin = CONFIG.TILE_SIZE * 2;
    const maxX = CONFIG.MAP_WIDTH_TILES * CONFIG.TILE_SIZE - margin;
    const maxY = CONFIG.MAP_HEIGHT_TILES * CONFIG.TILE_SIZE - margin;

    if (this.x < margin || this.x > maxX || this.y < margin || this.y > maxY) {
      this._wanderDir.x = -this._wanderDir.x;
      this._wanderDir.y = -this._wanderDir.y;
    }
  }

  /**
   * Spawn a decoy task at a random spawn point.
   * Decoys look like real tasks but at 50% opacity with a pulse.
   */
  spawnDecoy(time) {
    const taskManager = this.scene.taskManager;
    if (!taskManager) return;

    // Respect task cap
    if (taskManager.getActiveCount() >= CONFIG.TASK_MAX_ON_MAP) {
      console.debug('[SlackPinger] task cap reached, skipping decoy');
      return;
    }

    const task = taskManager.getFromPool();
    if (!task) return;

    const point = randomFrom(TASK_SPAWN_POINTS);
    const pos = tileToPixel(point.x, point.y, CONFIG.TILE_SIZE);
    const deptIds = Object.keys(DEPARTMENT_COLORS);
    const dept = randomFrom(deptIds);

    task.spawn({
      name: 'Slack Notification',
      department: dept,
      route: null,
      stops: 1,
      x: pos.x,
      y: pos.y,
      spawnTime: time,
      isDecoy: true,
    });

    // Visual: 65% alpha with pulse tween (was 50% — subtler, harder to spot)
    task.setAlpha(0.65);

    // Reply-All Filter upgrade: decoys glow bright red
    if (this.scene.upgradeManager && this.scene.upgradeManager.isActive('reply_all_filter')) {
      task.setTint(0xff0000);
    }

    // Pulse animation
    const pulseTween = this.scene.tweens.add({
      targets: task,
      alpha: { from: 0.5, to: 0.8 },
      duration: 500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    taskManager.activeTasks.push(task);
    this.scene.events.emit('task-spawned', { task });

    // Track decoy for lifetime management
    this._activeDecoys.push({
      task,
      spawnTime: time,
      pulseTween,
    });

    this.scene.events.emit('agent-disruption', {
      type: 'slack_pinger',
      effect: 'decoy_spawned',
      position: { x: pos.x, y: pos.y },
    });

    console.debug(`[SlackPinger] spawned decoy at (${Math.round(pos.x)}, ${Math.round(pos.y)})`);
  }

  /** Check decoy lifetimes and remove expired ones */
  updateDecoys(time) {
    const expired = [];
    for (const entry of this._activeDecoys) {
      // Skip if already picked up (state !== SPAWNED)
      if (entry.task.state !== TASK_STATES.SPAWNED) {
        expired.push(entry);
        continue;
      }

      // Check lifetime
      const age = time - entry.spawnTime;
      if (age >= CONFIG.DECOY_LIFETIME) {
        expired.push(entry);
      }
    }

    for (const entry of expired) {
      // Stop pulse tween
      if (entry.pulseTween) entry.pulseTween.stop();

      // Only despawn if still on map (not picked up)
      if (entry.task.state === TASK_STATES.SPAWNED) {
        const idx = this.scene.taskManager.activeTasks.indexOf(entry.task);
        if (idx !== -1) this.scene.taskManager.activeTasks.splice(idx, 1);
        entry.task.deactivate();
        console.debug('[SlackPinger] decoy expired (no stress)');
      }

      const decoyIdx = this._activeDecoys.indexOf(entry);
      if (decoyIdx !== -1) this._activeDecoys.splice(decoyIdx, 1);
    }
  }

  /** Clean up on deactivation */
  deactivate() {
    // Remove all active decoys
    for (const entry of this._activeDecoys) {
      if (entry.pulseTween) entry.pulseTween.stop();
      if (entry.task.state === TASK_STATES.SPAWNED) {
        const idx = this.scene.taskManager.activeTasks.indexOf(entry.task);
        if (idx !== -1) this.scene.taskManager.activeTasks.splice(idx, 1);
        entry.task.deactivate();
      }
    }
    this._activeDecoys = [];
    super.deactivate();
  }
}
