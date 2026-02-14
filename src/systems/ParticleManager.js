import CONFIG from '../config/gameConfig.js';
import { DEPARTMENT_COLORS } from '../config/mapData.js';
import { hexToInt } from '../utils/helpers.js';

/**
 * ParticleManager: handles all particle effects and screen flashes.
 *
 * Uses Phaser 3.80.1 particle API: scene.add.particles(x, y, 'particle', config).
 * All emitters are one-shot (explode) and self-destroy via delayed call.
 */
export class ParticleManager {
  constructor(scene) {
    console.log('[ParticleManager] initialized');
    /** @type {Phaser.Scene} */
    this.scene = scene;

    /** @type {Phaser.GameObjects.Rectangle|null} Reusable screen flash overlay */
    this.flashRect = null;
  }

  /** Create the screen flash overlay (hidden by default) */
  init() {
    this.flashRect = this.scene.add.rectangle(
      CONFIG.CANVAS_WIDTH / 2, CONFIG.CANVAS_HEIGHT / 2,
      CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT,
      0xffffff, 0
    ).setScrollFactor(0).setDepth(450).setVisible(false);
  }

  /**
   * Sparkle effect on task pickup.
   * @param {number} x - World x
   * @param {number} y - World y
   * @param {string} deptId - Department ID for color
   */
  taskPickup(x, y, deptId) {
    const color = this.getDeptColor(deptId);
    const fx = CONFIG.EFFECTS;

    const particles = this.scene.add.particles(x, y, 'particle', {
      tint: color,
      speed: { min: 30, max: 80 },
      scale: { start: 1.5, end: 0 },
      lifespan: fx.PICKUP_LIFETIME,
      quantity: fx.PICKUP_PARTICLES,
      emitting: false,
      depth: 100,
    });

    particles.explode(fx.PICKUP_PARTICLES);
    this.scene.time.delayedCall(fx.PICKUP_LIFETIME + 100, () => particles.destroy());
  }

  /**
   * Burst effect on task delivery + white screen flash.
   * @param {number} x - World x
   * @param {number} y - World y
   * @param {string} deptId - Department ID for color
   */
  taskDelivery(x, y, deptId) {
    const color = this.getDeptColor(deptId);
    const fx = CONFIG.EFFECTS;

    const particles = this.scene.add.particles(x, y, 'particle', {
      tint: color,
      speed: { min: 50, max: 140 },
      scale: { start: 2, end: 0 },
      lifespan: fx.DELIVERY_LIFETIME,
      quantity: fx.DELIVERY_PARTICLES,
      emitting: false,
      depth: 100,
    });

    particles.explode(fx.DELIVERY_PARTICLES);
    this.scene.time.delayedCall(fx.DELIVERY_LIFETIME + 100, () => particles.destroy());

    this.screenFlash(fx.FLASH_ALPHA * 0.6, fx.FLASH_DURATION, 0xffffff);
  }

  /**
   * Confetti effect on level up.
   * @param {number} x - World x
   * @param {number} y - World y
   */
  levelUp(x, y) {
    const fx = CONFIG.EFFECTS;
    const colors = [0x4169E1, 0x22cc44, 0xFFD700, 0xFF8C00, 0x8B5CF6];

    const particles = this.scene.add.particles(x, y, 'particle', {
      tint: colors,
      speed: { min: 40, max: 120 },
      scale: { start: 2.5, end: 0 },
      lifespan: fx.LEVEL_UP_LIFETIME,
      quantity: fx.LEVEL_UP_PARTICLES,
      angle: { min: 0, max: 360 },
      emitting: false,
      depth: 100,
    });

    particles.explode(fx.LEVEL_UP_PARTICLES);
    this.scene.time.delayedCall(fx.LEVEL_UP_LIFETIME + 100, () => particles.destroy());
  }

  /**
   * Large confetti + golden flash on promotion.
   * @param {number} x - World x
   * @param {number} y - World y
   */
  promotion(x, y) {
    const fx = CONFIG.EFFECTS;
    const colors = [0xFFD700, 0xFFA500, 0xFFFF00, 0xffffff, 0x4169E1];

    const particles = this.scene.add.particles(x, y, 'particle', {
      tint: colors,
      speed: { min: 60, max: 180 },
      scale: { start: 3, end: 0 },
      lifespan: fx.LEVEL_UP_LIFETIME,
      quantity: fx.PROMOTION_PARTICLES,
      angle: { min: 0, max: 360 },
      emitting: false,
      depth: 100,
    });

    particles.explode(fx.PROMOTION_PARTICLES);
    this.scene.time.delayedCall(fx.LEVEL_UP_LIFETIME + 100, () => particles.destroy());

    this.screenFlash(fx.FLASH_ALPHA, fx.FLASH_DURATION * 1.5, 0xFFD700);
  }

  /**
   * Grey poof on task expiry.
   * @param {number} x - World x
   * @param {number} y - World y
   */
  taskExpiry(x, y) {
    const fx = CONFIG.EFFECTS;

    const particles = this.scene.add.particles(x, y, 'particle', {
      tint: 0x888888,
      speed: { min: 20, max: 50 },
      scale: { start: 1.5, end: 0 },
      lifespan: fx.EXPIRY_LIFETIME,
      quantity: fx.EXPIRY_PARTICLES,
      emitting: false,
      depth: 100,
    });

    particles.explode(fx.EXPIRY_PARTICLES);
    this.scene.time.delayedCall(fx.EXPIRY_LIFETIME + 100, () => particles.destroy());
  }

  /**
   * Camera shake on agent disruption.
   */
  agentDisruption() {
    const fx = CONFIG.EFFECTS;
    this.scene.cameras.main.shake(fx.SHAKE_DURATION, fx.SHAKE_INTENSITY);
  }

  /**
   * Victory confetti burst (used by GameOverScene).
   * @param {number} x - Screen x
   * @param {number} y - Screen y
   */
  victoryConfetti(x, y) {
    const fx = CONFIG.EFFECTS;
    const colors = [0xFFD700, 0xFF8C00, 0x4169E1, 0x22cc44, 0x8B5CF6, 0xff4444];

    const particles = this.scene.add.particles(x, y, 'particle', {
      tint: colors,
      speed: { min: 40, max: 160 },
      scale: { start: 2.5, end: 0 },
      lifespan: fx.VICTORY_CONFETTI_LIFETIME,
      quantity: fx.VICTORY_CONFETTI_PARTICLES,
      angle: { min: 0, max: 360 },
      gravityY: 40,
      emitting: false,
      depth: 100,
    });

    particles.explode(fx.VICTORY_CONFETTI_PARTICLES);
    this.scene.time.delayedCall(fx.VICTORY_CONFETTI_LIFETIME + 100, () => particles.destroy());
  }

  /**
   * Flash the screen with a color overlay that fades out.
   * @param {number} alpha - Peak alpha (0-1)
   * @param {number} duration - Fade-out duration in ms
   * @param {number} color - Hex color (e.g., 0xffffff)
   */
  screenFlash(alpha, duration, color) {
    if (!this.flashRect) return;

    this.flashRect.setFillStyle(color, alpha);
    this.flashRect.setVisible(true);
    this.flashRect.setAlpha(1);

    this.scene.tweens.add({
      targets: this.flashRect,
      alpha: 0,
      duration: duration,
      onComplete: () => {
        this.flashRect.setVisible(false);
      },
    });
  }

  /**
   * Get department color as integer.
   * @param {string} deptId
   * @returns {number}
   */
  getDeptColor(deptId) {
    const hex = DEPARTMENT_COLORS[deptId];
    return hex ? hexToInt(hex) : 0xffffff;
  }

  /** Clean up */
  destroy() {
    if (this.flashRect) {
      this.flashRect.destroy();
      this.flashRect = null;
    }
  }
}
