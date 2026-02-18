import CONFIG from '../config/gameConfig.js';

/**
 * FloatingText: task name popup that appears above the player on pickup.
 * Shows for 2 seconds, then fades out. Max 30 characters visible.
 */
export class FloatingText {
  constructor(scene) {
    /** @type {Phaser.Scene} */
    this.scene = scene;
  }

  /**
   * Show floating text above a position.
   * @param {string} text - Text to display (truncated to 30 chars)
   * @param {number} x - World x position
   * @param {number} y - World y position
   * @param {string} [color='#ffffff'] - Text color
   */
  show(text, x, y, color = '#ffffff') {
    const max = CONFIG.FLOATING_TEXT_MAX_LENGTH;
    const displayText = text.length > max ? text.substring(0, max - 3) + '...' : text;

    const fontSize = CONFIG.FLOATING_TEXT_FONT_SIZE || '12px';
    const duration = CONFIG.FLOATING_TEXT_DURATION || 2500;

    const textObj = this.scene.add.text(x, y - 20, displayText, {
      fontSize,
      fontFamily: 'monospace',
      color: color,
      stroke: '#000000',
      strokeThickness: 3,
      resolution: 3,
    }).setOrigin(0.5).setDepth(100);

    // Float up and fade out
    this.scene.tweens.add({
      targets: textObj,
      y: y - 50,
      alpha: 0,
      duration,
      ease: 'Power1',
      onComplete: () => {
        textObj.destroy();
      },
    });
  }

  destroy() {
  }
}
