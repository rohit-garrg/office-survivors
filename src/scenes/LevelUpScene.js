import Phaser from 'phaser';
import CONFIG from '../config/gameConfig.js';
import { trackEvent } from '../utils/analytics.js';

/**
 * LevelUpScene: overlay scene shown on level up.
 * Shows promotion popup (if tier change), then 3 upgrade cards.
 * Player clicks a card or presses 1/2/3 to select.
 */
export class LevelUpScene extends Phaser.Scene {
  constructor() {
    super({ key: 'LevelUpScene' });
    console.log('[LevelUpScene] initialized');
  }

  /**
   * @param {object} data - { level, tier, isPromotion, upgrades }
   */
  init(data) {
    this.levelData = data;
  }

  /** Show promotion popup (if tier change) then upgrade selection cards */
  create() {
    console.log('[LevelUpScene] create', this.levelData);

    this.elements = [];
    const cx = CONFIG.CANVAS_WIDTH / 2;
    const cy = CONFIG.CANVAS_HEIGHT / 2;

    // Dim background
    const bg = this.add.rectangle(cx, cy, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT, 0x000000, 0.7);
    bg.setDepth(400);
    this.elements.push(bg);

    if (this.levelData.isPromotion) {
      this.showPromotionPopup(() => {
        this.showUpgradeCards(this.levelData.upgrades);
      });
    } else {
      this.showUpgradeCards(this.levelData.upgrades);
    }
  }

  /**
   * Show "PROMOTED!" text for 2 seconds, then call onComplete.
   * @param {Function} onComplete
   */
  showPromotionPopup(onComplete) {
    const cx = CONFIG.CANVAS_WIDTH / 2;
    const cy = CONFIG.CANVAS_HEIGHT / 2;

    const tierDisplay = this.levelData.tier.charAt(0) + this.levelData.tier.slice(1).toLowerCase();

    const promoText = this.add.text(cx, cy - 40, 'PROMOTED!', {
      fontSize: '36px',
      fontFamily: 'monospace',
      color: '#FFD700',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(401);
    this.elements.push(promoText);

    const titleText = this.add.text(cx, cy + 10, `You are now: ${tierDisplay}`, {
      fontSize: '20px',
      fontFamily: 'monospace',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(401);
    this.elements.push(titleText);

    // Flash effect
    this.tweens.add({
      targets: promoText,
      alpha: { from: 1, to: 0.6 },
      yoyo: true,
      repeat: 3,
      duration: 250,
    });

    // After popup duration, remove promotion text and show cards
    this.time.delayedCall(CONFIG.PROMOTION_POPUP_DURATION, () => {
      promoText.destroy();
      titleText.destroy();
      onComplete();
    });
  }

  /**
   * Display upgrade cards for selection.
   * @param {Array} upgrades - Array of upgrade data objects
   */
  showUpgradeCards(upgrades) {
    if (!upgrades || upgrades.length === 0) {
      // No upgrades available — just show level up and close
      this.showNoUpgrades();
      return;
    }

    const cx = CONFIG.CANVAS_WIDTH / 2;
    const cy = CONFIG.CANVAS_HEIGHT / 2;
    const topY = 60;

    // Header text: "Bonus Upgrade!" for post-CEO milestones, "Level X!" for normal level-ups
    const isMilestone = this.levelData.isMilestone;
    const headerText = isMilestone ? 'Bonus Upgrade!' : `Level ${this.levelData.level}!`;
    const headerColor = isMilestone ? '#FFD700' : '#44ff44';
    const subtitleText = isMilestone ? 'CEO perk — choose wisely:' : 'Choose an upgrade:';

    const header = this.add.text(cx, topY, headerText, {
      fontSize: '24px',
      fontFamily: 'monospace',
      color: headerColor,
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(401);
    this.elements.push(header);

    const subtitle = this.add.text(cx, topY + 30, subtitleText, {
      fontSize: '14px',
      fontFamily: 'monospace',
      color: '#cccccc',
    }).setOrigin(0.5).setDepth(401);
    this.elements.push(subtitle);

    // Card dimensions
    const cardW = 240;
    const cardH = 260;
    const gap = 20;
    const totalWidth = upgrades.length * cardW + (upgrades.length - 1) * gap;
    const startX = cx - totalWidth / 2 + cardW / 2;
    const cardY = cy + 30;

    // Upgrade color mapping for icons
    const categoryColors = {
      always_useful: 0x4169E1,
      anti_agent: 0xff4444,
      xp_boost: 0x44ff44,
      delivery: 0xFF8C00,
      advanced: 0xFFD700,
    };

    // Category icon shapes (drawn via graphics)
    const categoryIcons = {
      always_useful: 'circle',
      anti_agent: 'shield',
      xp_boost: 'star',
      delivery: 'arrow',
      advanced: 'diamond',
    };

    this.cardElements = [];

    for (let i = 0; i < upgrades.length; i++) {
      const upgrade = upgrades[i];
      const x = startX + i * (cardW + gap);
      const iconColor = categoryColors[upgrade.category] || 0x888888;

      // Card background with gradient-like effect
      const cardBg = this.add.rectangle(x, cardY, cardW, cardH, 0x1a1a2e, 0.95)
        .setStrokeStyle(2, 0x333355)
        .setDepth(401)
        .setInteractive({ useHandCursor: true });
      this.elements.push(cardBg);

      // Top accent bar (category color)
      const accentBar = this.add.rectangle(x, cardY - cardH / 2 + 3, cardW - 4, 4, iconColor, 0.7)
        .setDepth(402);
      this.elements.push(accentBar);

      // Hover effects
      cardBg.on('pointerover', () => {
        cardBg.setStrokeStyle(2, iconColor);
        accentBar.setAlpha(1);
      });
      cardBg.on('pointerout', () => {
        cardBg.setStrokeStyle(2, 0x333355);
        accentBar.setAlpha(0.7);
      });
      cardBg.on('pointerdown', () => {
        this.selectUpgrade(i);
      });

      // Key number label
      const keyLabel = this.add.text(x + cardW / 2 - 16, cardY - cardH / 2 + 12, `${i + 1}`, {
        fontSize: '12px',
        fontFamily: 'monospace',
        color: '#555566',
      }).setOrigin(0.5).setDepth(402);
      this.elements.push(keyLabel);

      // Icon: draw a shape using graphics
      const iconGfx = this.add.graphics().setDepth(402);
      const iconX = x;
      const iconY = cardY - cardH / 2 + 50;
      iconGfx.fillStyle(iconColor, 0.2);
      iconGfx.fillCircle(iconX, iconY, 22);
      iconGfx.fillStyle(iconColor, 1);
      const shape = categoryIcons[upgrade.category] || 'circle';
      if (shape === 'shield') {
        iconGfx.fillRoundedRect(iconX - 10, iconY - 12, 20, 24, 4);
      } else if (shape === 'star') {
        iconGfx.fillTriangle(iconX, iconY - 12, iconX - 11, iconY + 8, iconX + 11, iconY + 8);
        iconGfx.fillTriangle(iconX, iconY + 12, iconX - 11, iconY - 6, iconX + 11, iconY - 6);
      } else if (shape === 'arrow') {
        iconGfx.fillTriangle(iconX, iconY - 12, iconX - 10, iconY + 4, iconX + 10, iconY + 4);
        iconGfx.fillRect(iconX - 4, iconY + 4, 8, 8);
      } else if (shape === 'diamond') {
        iconGfx.fillTriangle(iconX, iconY - 12, iconX - 10, iconY, iconX + 10, iconY);
        iconGfx.fillTriangle(iconX, iconY + 12, iconX - 10, iconY, iconX + 10, iconY);
      } else {
        iconGfx.fillCircle(iconX, iconY, 12);
      }
      this.elements.push(iconGfx);

      // Upgrade name
      const nameText = this.add.text(x, cardY - cardH / 2 + 85, upgrade.name, {
        fontSize: '14px',
        fontFamily: 'monospace',
        color: '#ffffff',
        fontStyle: 'bold',
        wordWrap: { width: cardW - 24 },
        align: 'center',
      }).setOrigin(0.5, 0).setDepth(402);
      this.elements.push(nameText);

      // Divider line
      const divider = this.add.rectangle(x, cardY - cardH / 2 + 115, cardW - 40, 1, 0x333355)
        .setDepth(402);
      this.elements.push(divider);

      // Effect text
      const effectText = this.add.text(x, cardY - cardH / 2 + 125, upgrade.effect, {
        fontSize: '12px',
        fontFamily: 'monospace',
        color: '#44ff44',
        wordWrap: { width: cardW - 24 },
        align: 'center',
      }).setOrigin(0.5, 0).setDepth(402);
      this.elements.push(effectText);

      // Description (flavor text)
      const descText = this.add.text(x, cardY - cardH / 2 + 170, upgrade.description, {
        fontSize: '11px',
        fontFamily: 'monospace',
        color: '#888899',
        fontStyle: 'italic',
        wordWrap: { width: cardW - 24 },
        align: 'center',
      }).setOrigin(0.5, 0).setDepth(402);
      this.elements.push(descText);

      // Duration badge at bottom
      let durationStr = '';
      if (upgrade.duration === 'permanent') durationStr = '∞ Permanent';
      else if (upgrade.duration === 'instant') durationStr = '⚡ Instant';
      else if (typeof upgrade.duration === 'number') durationStr = `⏱ ${upgrade.duration / 1000}s`;
      if (upgrade.uses) durationStr += ` (${upgrade.uses}×)`;

      if (durationStr) {
        const durBg = this.add.rectangle(x, cardY + cardH / 2 - 22, 100, 20, 0x222244, 0.8)
          .setStrokeStyle(1, 0x333355)
          .setDepth(402);
        this.elements.push(durBg);
      }
      const durText = this.add.text(x, cardY + cardH / 2 - 22, durationStr, {
        fontSize: '10px',
        fontFamily: 'monospace',
        color: '#666688',
      }).setOrigin(0.5).setDepth(403);
      this.elements.push(durText);

      this.cardElements.push({ bg: cardBg, accentBar, upgrade });
    }

    // Register key input (1, 2, 3)
    this._keyHandlers = [];
    const keys = ['ONE', 'TWO', 'THREE'];
    for (let i = 0; i < Math.min(upgrades.length, 3); i++) {
      const key = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes[keys[i]]);
      const handler = () => this.selectUpgrade(i);
      key.once('down', handler);
      this._keyHandlers.push(key);
    }
  }

  /** Show a simple "Level Up!" message when no upgrades are available */
  showNoUpgrades() {
    const cx = CONFIG.CANVAS_WIDTH / 2;
    const cy = CONFIG.CANVAS_HEIGHT / 2;

    const text = this.add.text(cx, cy, `Level ${this.levelData.level}!`, {
      fontSize: '28px',
      fontFamily: 'monospace',
      color: '#44ff44',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(401);
    this.elements.push(text);

    this.time.delayedCall(CONFIG.LEVELUP_NO_UPGRADES_CLOSE_DELAY, () => this.close());
  }

  /**
   * Handle upgrade selection.
   * @param {number} index - 0-based card index
   */
  selectUpgrade(index) {
    if (!this.cardElements || index >= this.cardElements.length) return;

    const selected = this.cardElements[index];
    if (!selected) return;

    // Visual feedback: highlight selected card
    selected.bg.setStrokeStyle(2, 0x44ff44);
    if (selected.accentBar) selected.accentBar.setFillStyle(0x44ff44);

    // Remove key listeners
    if (this._keyHandlers) {
      for (const key of this._keyHandlers) {
        key.removeAllListeners('down');
      }
    }

    // Disable all card interactions
    for (const card of this.cardElements) {
      card.bg.disableInteractive();
    }

    console.log(`[LevelUpScene] selected: ${selected.upgrade.name}`);

    trackEvent('upgrade_selected', {
      upgrade_name: selected.upgrade.name,
      level: this.levelData.level,
    });

    // Emit upgrade-selected to GameScene (which UpgradeManager listens on)
    const gameScene = this.scene.get('GameScene');
    if (gameScene) {
      gameScene.events.emit('upgrade-selected', { upgrade: selected.upgrade });
    }

    // Brief delay then close
    this.time.delayedCall(CONFIG.LEVELUP_SELECTION_CLOSE_DELAY, () => this.close());
  }

  /** Clean up and return to GameScene */
  close() {
    // Destroy all elements
    for (const el of this.elements) {
      if (el && el.destroy) el.destroy();
    }
    this.elements = [];
    this.cardElements = [];

    // Resume GameScene
    const gameScene = this.scene.get('GameScene');
    if (gameScene) {
      gameScene.isPaused = false;
      gameScene.physics.resume();
    }

    this.scene.stop('LevelUpScene');
  }
}
