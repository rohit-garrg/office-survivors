import CONFIG from '../config/gameConfig.js';
import { trackEvent } from '../utils/analytics.js';

/**
 * ProgressionManager: handles XP, levels, tier transitions, and promotions.
 *
 * XP thresholds: [80, 120, 180, 240, 340, 520, 680, 840] for levels 2-9.
 * Tiers: INTERN (1-2), ASSOCIATE (3-4), MANAGER (5-6), DIRECTOR (7-8), CEO (9).
 */
export class ProgressionManager {
  constructor(scene) {
    console.log('[ProgressionManager] initialized');

    /** @type {Phaser.Scene} */
    this.scene = scene;

    /** @type {number} Current player level (1-9) */
    this.level = 1;

    /** @type {number} Current XP within this level */
    this.currentXP = 0;

    /** @type {string} Current tier name */
    this.currentTier = 'INTERN';

    /** @type {number} Total XP earned this game */
    this.totalXP = 0;

    /** @type {number} XP accumulated since reaching CEO (toward next milestone) */
    this.postCeoXP = 0;

    /** @type {number} Number of post-CEO milestones triggered */
    this.milestoneCount = 0;

    /** @type {number} Cumulative XP multiplier bonus from post-CEO milestones */
    this.milestoneXPMultiplier = 0;
  }

  /** Initialize progression state */
  init() {
    this.level = CONFIG.DEBUG.START_LEVEL || 1;
    this.currentXP = 0;
    this.currentTier = this.getTierForLevel(this.level);
    this.totalXP = 0;
    this.postCeoXP = 0;
    this.milestoneCount = 0;
    this.milestoneXPMultiplier = 0;

    // Listen for task delivery to award XP
    this._onTaskDelivered = (data) => {
      this.addXP(data.xp);
    };
    this.scene.events.on('task-delivered', this._onTaskDelivered);
  }

  /**
   * Add XP and check for level up.
   * @param {number} amount
   */
  addXP(amount) {
    this.currentXP += amount;
    this.totalXP += amount;

    // Check for level up (can level up multiple times from one delivery)
    while (this.currentXP >= this.getXPForNextLevel() && this.level < 9) {
      this.currentXP -= this.getXPForNextLevel();
      this.level++;

      const oldTier = this.currentTier;
      this.currentTier = this.getTierForLevel(this.level);
      const isPromotion = this.currentTier !== oldTier;

      console.log(`[ProgressionManager] LEVEL UP! Level ${this.level}, Tier: ${this.currentTier}${isPromotion ? ' (PROMOTION!)' : ''}`);

      this.scene.events.emit('level-up', {
        level: this.level,
        tier: this.currentTier,
        isPromotion,
      });

      trackEvent('level_up', {
        level: this.level,
        tier: this.currentTier,
        is_promotion: isPromotion,
      });

      // Break if we hit max level
      if (this.level >= 9) break;
    }

    // Post-CEO milestones: accumulate XP with escalating thresholds
    if (this.level >= 9) {
      this.postCeoXP += amount;
      let milestoneThreshold = this.getMilestoneThreshold();
      while (this.postCeoXP >= milestoneThreshold) {
        this.postCeoXP -= milestoneThreshold;
        this.milestoneCount++;
        console.log(`[ProgressionManager] CEO Milestone #${this.milestoneCount}! (next threshold: ${this.getMilestoneThreshold()} XP)`);
        this.scene.events.emit('ceo-milestone', { milestoneNumber: this.milestoneCount });
        milestoneThreshold = this.getMilestoneThreshold();
      }
    }

    // Emit xp-gained after all level-up/milestone processing so UI sees final state.
    // At max level, report progress toward next milestone instead of 0/Infinity.
    this.scene.events.emit('xp-gained', {
      amount,
      total: this.totalXP,
      current: this.level >= 9 ? this.postCeoXP : this.currentXP,
      needed: this.level >= 9 ? this.getMilestoneThreshold() : this.getXPForNextLevel(),
    });
  }

  /**
   * Get XP threshold for the next post-CEO milestone (escalates each time).
   * Formula: BASE + milestoneCount * INCREMENT
   * @returns {number}
   */
  getMilestoneThreshold() {
    return CONFIG.POST_CEO_MILESTONE_XP_BASE + this.milestoneCount * CONFIG.POST_CEO_MILESTONE_XP_INCREMENT;
  }

  /**
   * Get XP needed for next level.
   * @returns {number}
   */
  getXPForNextLevel() {
    // XP_PER_LEVEL is [80,120,180,240,340,520,680,840] for levels 2-9
    // Index 0 = XP needed to reach level 2 from level 1
    const index = this.level - 1;
    if (index >= CONFIG.XP_PER_LEVEL.length) {
      return Infinity; // Max level reached
    }
    return CONFIG.XP_PER_LEVEL[index];
  }

  /**
   * Get tier name for a given level.
   * @param {number} level
   * @returns {string}
   */
  getTierForLevel(level) {
    for (const [tier, range] of Object.entries(CONFIG.TIER_THRESHOLDS)) {
      if (level >= range.minLevel && level <= range.maxLevel) {
        return tier;
      }
    }
    return 'CEO'; // Fallback for level 9+
  }

  /**
   * Get the tier key (lowercase) for task pool lookup.
   * @returns {string}
   */
  getTierKey() {
    return this.currentTier.toLowerCase();
  }

  /**
   * Add XP multiplier bonus from a post-CEO milestone.
   * @param {number} amount - Additional XP multiplier (e.g., 0.5 = +50%)
   */
  addMilestoneXPBonus(amount) {
    this.milestoneXPMultiplier = Math.min(
      this.milestoneXPMultiplier + amount,
      CONFIG.MILESTONE_XP_MULTIPLIER_CAP
    );
    console.debug(`[ProgressionManager] milestone XP multiplier now +${this.milestoneXPMultiplier.toFixed(1)}x (cap: ${CONFIG.MILESTONE_XP_MULTIPLIER_CAP})`);
  }

  /**
   * Get total milestone XP multiplier (1.0 = no bonus, 1.5 = +50%, etc.)
   * @returns {number}
   */
  getMilestoneXPMultiplier() {
    return 1 + this.milestoneXPMultiplier;
  }

  /**
   * Get current progression stats for display.
   * @returns {object}
   */
  getStats() {
    return {
      level: this.level,
      tier: this.currentTier,
      currentXP: this.level >= 9 ? this.postCeoXP : this.currentXP,
      neededXP: this.level >= 9 ? this.getMilestoneThreshold() : this.getXPForNextLevel(),
      totalXP: this.totalXP,
      milestones: this.milestoneCount,
    };
  }

  /** Clean up */
  destroy() {
    this.scene.events.off('task-delivered', this._onTaskDelivered);
  }
}
