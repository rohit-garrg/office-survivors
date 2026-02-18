import Phaser from 'phaser';
import CONFIG from '../config/gameConfig.js';

/**
 * Task states: SPAWNED (on map) -> CARRIED (in inventory) ->
 *              DELIVERING (multi-stop, partially complete) -> DONE
 */
export const TASK_STATES = {
  IDLE: 'IDLE',       // In object pool, inactive
  SPAWNED: 'SPAWNED', // On the map, waiting for pickup
  CARRIED: 'CARRIED', // In player inventory
  DELIVERING: 'DELIVERING', // Multi-stop, partially complete
  DONE: 'DONE',       // Delivered, ready to return to pool
};

export class Task extends Phaser.GameObjects.Sprite {
  constructor(scene, x, y) {
    // Use a default texture — will be changed on spawn()
    super(scene, x, y, 'task_CEO');
    console.debug('[Task] pool entity created');

    this.scene = scene;

    /** @type {string} Current state */
    this.state = TASK_STATES.IDLE;

    /** @type {string} Task display name */
    this.taskName = '';

    /** @type {string|null} Target department ID (single-stop) */
    this.department = null;

    /** @type {string[]|null} Ordered route for multi-stop tasks */
    this.route = null;

    /** @type {number} Total stops required */
    this.totalStops = 1;

    /** @type {number} Current stop index (0-based) */
    this.currentStop = 0;

    /** @type {number} Timestamp when task was spawned (for expiry) */
    this.spawnTime = 0;

    /** @type {boolean} Whether this is a decoy task */
    this.isDecoy = false;

    /** @type {boolean} Whether this is a Reply-All "junk mail" task */
    this.isReplyAll = false;

    /** @type {boolean} Flash toggle for warning state */
    this._flashVisible = true;

    /** @type {number} Flash timer accumulator */
    this._flashTimer = 0;

    // Start inactive
    this.setActive(false);
    this.setVisible(false);
  }

  /**
   * Activate this task from the pool with the given data.
   * @param {object} data - { name, department, route, stops, x, y, spawnTime, isDecoy }
   */
  spawn(data) {
    this.taskName = data.name;
    this.department = data.department || null;
    this.route = data.route || null;
    this.totalStops = data.stops || 1;
    this.currentStop = 0;
    this.spawnTime = data.spawnTime;
    this.isDecoy = data.isDecoy || false;
    this.isReplyAll = data.isReplyAll || false;

    // Position on map
    this.setPosition(data.x, data.y);

    // Set texture based on target department color
    const deptId = this.getCurrentDepartment();
    const textureKey = this.isDecoy ? `task_decoy_${deptId}` : `task_${deptId}`;
    this.setTexture(textureKey);

    this.state = TASK_STATES.SPAWNED;
    this.setActive(true);
    this.setVisible(true);
    this.setAlpha(1);
    this._flashVisible = true;
    this._flashTimer = 0;
    this.setDepth(8); // Above furniture (3) but below player (10)

    // Subtle visual tell for Reply-All junk tasks (slightly desaturated)
    if (this.isReplyAll) {
      this.setTint(0xccccff); // faint blue-grey tint — noticeable if you look for it
    } else {
      this.clearTint();
    }

    // Enable physics body if it exists
    if (this.body) {
      this.body.enable = true;
    }

    // Vertical bob tween (3px up/down)
    this._bobBaseY = data.y;
    this.scene.tweens.add({
      targets: this,
      y: data.y - CONFIG.TASK_BOB_AMPLITUDE,
      duration: CONFIG.TASK_BOB_DURATION,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    });

    // Scale pulse tween (1.0 -> 1.15)
    this.scene.tweens.add({
      targets: this,
      scaleX: CONFIG.TASK_PULSE_SCALE,
      scaleY: CONFIG.TASK_PULSE_SCALE,
      duration: CONFIG.TASK_PULSE_DURATION,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    });

    console.debug(`[Task] spawned: "${this.taskName}" -> ${deptId}`);
  }

  /** Return this task to the pool */
  deactivate() {
    // Kill bob/pulse tweens to prevent stacking on pool reuse
    this.scene.tweens.killTweensOf(this);
    this.setScale(1);

    this.state = TASK_STATES.IDLE;
    this.setActive(false);
    this.setVisible(false);
    this.taskName = '';
    this.department = null;
    this.route = null;
    this.totalStops = 1;
    this.currentStop = 0;
    this.spawnTime = 0;
    this.isDecoy = false;
    this.isReplyAll = false;
    this.clearTint();

    if (this.body) {
      this.body.enable = false;
    }

    // Move off-screen
    this.setPosition(-100, -100);
  }

  /** Advance to next stop on multi-stop task */
  advanceStop() {
    this.currentStop++;
    if (this.currentStop >= this.totalStops) {
      this.state = TASK_STATES.DONE;
    } else {
      this.state = TASK_STATES.DELIVERING;
      // Update texture to match new target department
      const deptId = this.getCurrentDepartment();
      this.setTexture(`task_${deptId}`);
    }
  }

  /**
   * Get the current destination department ID.
   * @returns {string} Department ID
   */
  getCurrentDepartment() {
    if (this.route && this.route.length > 0) {
      return this.route[this.currentStop] || this.route[0];
    }
    return this.department;
  }

  /**
   * Check if task has expired.
   * @param {number} currentTime - Current game time in ms
   * @returns {boolean}
   */
  isExpired(currentTime) {
    if (this.state !== TASK_STATES.SPAWNED) return false;
    const expiryTime = this.isReplyAll ? CONFIG.REPLYALL_TASK_EXPIRY_TIME : CONFIG.TASK_EXPIRY_TIME;
    return (currentTime - this.spawnTime) >= expiryTime;
  }

  /**
   * Check if task should be flashing (warning state).
   * @param {number} currentTime - Current game time in ms
   * @returns {boolean}
   */
  isWarning(currentTime) {
    if (this.state !== TASK_STATES.SPAWNED) return false;
    // Reply-All tasks flash at 75% of their shorter expiry time
    const warningTime = this.isReplyAll
      ? CONFIG.REPLYALL_TASK_EXPIRY_TIME * 0.75
      : CONFIG.TASK_WARNING_TIME;
    return (currentTime - this.spawnTime) >= warningTime;
  }

  /** Update visual state (flashing when warning) */
  update(time, delta) {
    if (this.state !== TASK_STATES.SPAWNED) return;

    // Flash when in warning state
    if (this.isWarning(time)) {
      this._flashTimer += delta;
      if (this._flashTimer >= CONFIG.TASK_FLASH_INTERVAL) {
        this._flashTimer = 0;
        this._flashVisible = !this._flashVisible;
        this.setAlpha(this._flashVisible ? 1 : CONFIG.TASK_FLASH_ALPHA);
      }
    }
  }
}
