import CONFIG from '../config/gameConfig.js';
import { clamp } from '../utils/helpers.js';

/**
 * StressManager: calculates stress per frame, triggers visual feedback.
 *
 * Stress rises from undelivered tasks (rate depends on tier).
 * Stress drops from deliveries.
 * Instant stress from task expiry, meeting blocks, decoy pickups.
 * Visual thresholds at 40%, 65%, 85%.
 * Game over at 100%.
 */
export class StressManager {
  constructor(scene) {
    console.log('[StressManager] initialized');

    /** @type {Phaser.Scene} */
    this.scene = scene;

    /** @type {number} Current stress level (0-100) */
    this.currentStress = 0;

    /** @type {string|null} Current visual threshold level */
    this.currentThreshold = null;

    /** @type {number} Peak stress reached this game */
    this.peakStress = 0;

    /** @type {boolean} Whether stress-max has been emitted */
    this.gameOverEmitted = false;

    /** @type {Array<{time: number, amount: number}>} Rolling window of expiry stress events */
    this._expiryStressLog = [];
  }

  /** Initialize stress system and register event listeners */
  init() {
    this.gameOverEmitted = false;
    // Listen for task delivery -> relieve stress
    this._onTaskDelivered = (data) => {
      this.relieveStress(data.stressRelief);
    };
    this.scene.events.on('task-delivered', this._onTaskDelivered);

    // Listen for task expiry -> add instant stress
    this._onTaskExpired = (data) => {
      this.addInstantStress(data.stressPenalty, 'task-expiry');
    };
    this.scene.events.on('task-expired', this._onTaskExpired);
  }

  /** Per-frame stress calculation */
  update(time, delta) {
    if (CONFIG.DEBUG.STRESS_FREEZE) return;
    if (CONFIG.DEBUG.GOD_MODE) return;

    const deltaSeconds = delta / 1000;

    // Count all undelivered tasks (on map + carried by player)
    const activeTasks = this.scene.taskManager
      ? this.scene.taskManager.getActiveTasks()
      : [];
    const carriedTasks = this.scene.player
      ? this.scene.player.inventory
      : [];

    // Multi-stop tasks count stress for EACH remaining stop
    const carriedStressUnits = carriedTasks.reduce((sum, task) => {
      return sum + (task.totalStops - task.currentStop);
    }, 0);
    const totalUndelivered = activeTasks.length + carriedStressUnits;

    // Get stress rate based on current tier
    const tier = this.scene.progressionManager
      ? this.scene.progressionManager.currentTier
      : 'INTERN';
    const rate = this.getStressRate(tier);

    // Add stress: rate * numberOfTasks * deltaSeconds
    const stressGain = rate * totalUndelivered * deltaSeconds;
    this.currentStress = clamp(this.currentStress + stressGain, 0, CONFIG.STRESS_MAX);

    // Game over at 100% — check BEFORE passive decay so decay can't prevent it
    if (this.currentStress >= CONFIG.STRESS_MAX && !this.gameOverEmitted) {
      this.gameOverEmitted = true;
      this.scene.events.emit('stress-max', {});
    }

    // Passive stress decay when above threshold (safety net so stress doesn't snowball)
    if (this.currentStress > CONFIG.STRESS_PASSIVE_DECAY_THRESHOLD) {
      let decayRate = CONFIG.STRESS_PASSIVE_DECAY_RATE;

      // Stress Ball upgrade adds bonus passive decay
      if (this.scene.upgradeManager && this.scene.upgradeManager.isActive('stress_ball')) {
        decayRate += CONFIG.STRESS_BALL_DECAY_BONUS;
      }

      this.currentStress = clamp(
        this.currentStress - decayRate * deltaSeconds,
        0, CONFIG.STRESS_MAX
      );
    }

    // Track peak
    if (this.currentStress > this.peakStress) {
      this.peakStress = this.currentStress;
    }

    // Emit stress changed event
    this.scene.events.emit('stress-changed', {
      current: this.currentStress,
      max: CONFIG.STRESS_MAX,
      percent: this.currentStress / CONFIG.STRESS_MAX * 100,
    });

    // Check visual thresholds
    this.checkThresholds();
  }

  /**
   * Add instant stress (task expiry, meeting block, decoy pickup).
   * @param {number} amount - Stress percentage to add
   * @param {string} source - Source identifier for debugging
   */
  addInstantStress(amount, source) {
    if (CONFIG.DEBUG.STRESS_FREEZE || CONFIG.DEBUG.GOD_MODE) return;

    let effectiveAmount = amount;

    // Cap expiry stress in a rolling window (prevents Reply-All burst wipes)
    if (source === 'task-expiry') {
      const now = this.scene.time.now;
      const window = CONFIG.TASK_EXPIRY_STRESS_CAP_WINDOW;
      const cap = CONFIG.TASK_EXPIRY_STRESS_CAP;

      // Prune entries outside the window
      this._expiryStressLog = this._expiryStressLog.filter((e) => now - e.time < window);

      // Sum recent expiry stress
      const recentTotal = this._expiryStressLog.reduce((sum, e) => sum + e.amount, 0);
      const headroom = Math.max(0, cap - recentTotal);
      effectiveAmount = Math.min(amount, headroom);

      if (effectiveAmount > 0) {
        this._expiryStressLog.push({ time: now, amount: effectiveAmount });
      }

      if (effectiveAmount < amount) {
        console.debug(`[StressManager] expiry stress capped: ${amount}% -> ${effectiveAmount}% (${recentTotal.toFixed(1)}% in window)`);
      }
    }

    if (effectiveAmount <= 0) return;

    this.currentStress = clamp(this.currentStress + effectiveAmount, 0, CONFIG.STRESS_MAX);
    console.debug(`[StressManager] +${effectiveAmount}% stress from ${source} (now ${this.currentStress.toFixed(1)}%)`);
  }

  /**
   * Reduce stress on task delivery.
   * @param {number} amount - Stress percentage to relieve
   */
  relieveStress(amount) {
    this.currentStress = clamp(this.currentStress - amount, 0, CONFIG.STRESS_MAX);
    console.debug(`[StressManager] -${amount}% stress (now ${this.currentStress.toFixed(1)}%)`);
  }

  /** Check and emit visual threshold events */
  checkThresholds() {
    let newThreshold = null;

    if (this.currentStress >= CONFIG.STRESS_VISUAL_RED) {
      newThreshold = 'red';
    } else if (this.currentStress >= CONFIG.STRESS_VISUAL_ORANGE) {
      newThreshold = 'orange';
    } else if (this.currentStress >= CONFIG.STRESS_VISUAL_YELLOW) {
      newThreshold = 'yellow';
    }

    if (newThreshold !== this.currentThreshold) {
      this.currentThreshold = newThreshold;
      // Emit even when null (stress dropped below 40%) so vignette clears
      this.scene.events.emit('stress-threshold', { level: newThreshold });
    }
  }

  /**
   * Get the stress rate for a given tier.
   * @param {string} tier - e.g., 'INTERN', 'ASSOCIATE'
   * @returns {number} Stress rate in %/sec per undelivered task
   */
  getStressRate(tier) {
    switch (tier) {
      case 'INTERN': return CONFIG.STRESS_RATE_INTERN;
      case 'ASSOCIATE': return CONFIG.STRESS_RATE_ASSOCIATE;
      case 'MANAGER': return CONFIG.STRESS_RATE_MANAGER;
      case 'DIRECTOR': return CONFIG.STRESS_RATE_DIRECTOR;
      case 'CEO': return CONFIG.STRESS_RATE_CEO;
      default: return CONFIG.STRESS_RATE_INTERN;
    }
  }

  /** Clean up */
  destroy() {
    this.scene.events.off('task-delivered', this._onTaskDelivered);
    this.scene.events.off('task-expired', this._onTaskExpired);
  }
}
