/**
 * PromotionPopup: "PROMOTED!" overlay shown at tier transitions.
 *
 * Displays: "PROMOTED! You are now: [Title]. New task types unlocked."
 * Auto-dismisses after a short delay, then upgrade selection appears.
 */
export class PromotionPopup {
  constructor(scene) {
    console.log('[PromotionPopup] initialized');

    /** @type {Phaser.Scene} */
    this.scene = scene;
  }

  /**
   * Show the promotion popup.
   * @param {string} tierName - The new tier name (e.g., "Associate")
   * @param {Function} onComplete - Callback when popup is dismissed
   */
  show(tierName, onComplete) {
  }

  /** Animate the popup entrance */
  animateIn() {
  }

  /** Animate the popup exit and call onComplete */
  animateOut() {
  }

  /** Clean up popup elements */
  destroy() {
  }
}
