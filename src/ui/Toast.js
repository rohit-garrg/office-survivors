import CONFIG from '../config/gameConfig.js';

/**
 * Toast: non-blocking notification at bottom-center of the screen.
 * Supports queuing — if a toast is showing, the next one waits.
 */
export class Toast {
  /**
   * @param {Phaser.Scene} scene - The UIScene (screen-space, not world-space)
   */
  constructor(scene) {
    /** @type {Phaser.Scene} */
    this.scene = scene;

    /** @type {boolean} Whether a toast is currently showing */
    this.isShowing = false;

    /** @type {Array} Queue of pending toast messages */
    this.queue = [];
  }

  /**
   * Show a toast message. If another toast is active, this one queues.
   * @param {string} message - Text to display
   * @param {object} [options] - Optional overrides
   * @param {number} [options.duration=4000] - Hold duration in ms
   * @param {number} [options.fadeIn=300] - Fade in duration in ms
   * @param {number} [options.fadeOut=500] - Fade out duration in ms
   * @param {number} [options.y] - Custom Y position (default: 60px from bottom)
   */
  show(message, options = {}) {
    if (this.isShowing) {
      this.queue.push({ message, options });
      return;
    }

    this._display(message, options);
  }

  /** Internal: render and animate a toast */
  _display(message, options = {}) {
    const duration = options.duration ?? CONFIG.TOAST_DURATION ?? 4000;
    const fadeIn = options.fadeIn ?? CONFIG.TOAST_FADE_IN ?? 300;
    const fadeOut = options.fadeOut ?? CONFIG.TOAST_FADE_OUT ?? 500;
    const yPos = options.y ?? (CONFIG.CANVAS_HEIGHT - 60);
    const cx = CONFIG.CANVAS_WIDTH / 2;

    this.isShowing = true;

    // Text (no backgroundColor — we use a rectangle behind it)
    const text = this.scene.add.text(cx, yPos, message, {
      fontSize: '14px',
      fontFamily: 'monospace',
      color: '#ffffff',
      padding: { left: 12, right: 12, top: 8, bottom: 8 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(300).setAlpha(0);

    // Background rectangle behind text
    const bounds = text.getBounds();
    const bg = this.scene.add.rectangle(
      cx, yPos, bounds.width + 24, bounds.height + 16,
      0x000000, 0.75
    ).setOrigin(0.5).setScrollFactor(0).setDepth(299).setAlpha(0);

    // Fade in
    this.scene.tweens.add({
      targets: [bg, text],
      alpha: 1,
      duration: fadeIn,
      onComplete: () => {
        // Hold, then fade out
        this.scene.time.delayedCall(duration, () => {
          this.scene.tweens.add({
            targets: [bg, text],
            alpha: 0,
            duration: fadeOut,
            onComplete: () => {
              bg.destroy();
              text.destroy();
              this.isShowing = false;

              // Process queue
              if (this.queue.length > 0) {
                const next = this.queue.shift();
                this._display(next.message, next.options);
              }
            },
          });
        });
      },
    });
  }

  /** Clean up */
  destroy() {
    this.queue = [];
    this.isShowing = false;
  }
}
