/**
 * UpgradeCard: a single upgrade card shown during level-up selection.
 *
 * Displays: icon, upgrade name, description, effect.
 * Selectable via click or keyboard (1/2/3).
 */
export class UpgradeCard {
  constructor(scene, x, y, upgradeData, index) {
    console.log(`[UpgradeCard] initialized: ${upgradeData?.name || 'unknown'}`);

    /** @type {Phaser.Scene} */
    this.scene = scene;

    /** @type {object} Upgrade definition from upgradeData.js */
    this.upgradeData = upgradeData;

    /** @type {number} Card index (0, 1, or 2) */
    this.index = index;
  }

  /** Create the card visual (background, text, icon) */
  create() {
  }

  /** Highlight this card (hover/focus state) */
  highlight() {
  }

  /** Remove highlight */
  unhighlight() {
  }

  /** Play selection animation */
  select() {
  }

  /** Clean up card elements */
  destroy() {
  }
}
