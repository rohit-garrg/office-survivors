import Phaser from 'phaser';
import CONFIG from '../config/gameConfig.js';
import { trackEvent } from '../utils/analytics.js';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super({ key: 'TitleScene' });
    console.log('[TitleScene] initialized');
  }

  create() {
    console.log('[TitleScene] create');

    const w = CONFIG.CANVAS_WIDTH;
    const h = CONFIG.CANVAS_HEIGHT;
    const cx = w / 2;
    const cy = h / 2;

    // Dark office background
    this.add.rectangle(cx, cy, w, h, 0x1a1a2e);

    // Subtle floor grid pattern
    const gridGfx = this.add.graphics();
    gridGfx.lineStyle(1, 0x2a2a4e, 0.3);
    for (let x = 0; x < w; x += 32) {
      gridGfx.lineBetween(x, 0, x, h);
    }
    for (let y = 0; y < h; y += 32) {
      gridGfx.lineBetween(0, y, w, y);
    }

    // Decorative office elements in background
    this.addBackgroundDecor(cx, cy);

    // Card panel behind title text
    const cardW = 520;
    const cardH = 370;
    const cardBg = this.add.rectangle(cx, cy, cardW, cardH, 0x0d0d1a, 0.85)
      .setStrokeStyle(2, 0x4169E1, 0.6);

    // Title — large, bold
    const titleText = this.add.text(cx, cy - 90, 'OFFICE SURVIVORS', {
      fontSize: '42px',
      fontFamily: 'monospace',
      color: '#F5F0E8',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);

    // Underline accent
    this.add.rectangle(cx, cy - 60, 260, 3, 0x4169E1);

    // Subtitle
    this.add.text(cx, cy - 40, 'Survive the corporate workday.', {
      fontSize: '14px',
      fontFamily: 'monospace',
      color: '#8888aa',
    }).setOrigin(0.5);

    // Role descriptions
    const roles = 'Intern → Associate → Manager → Director → CEO';
    this.add.text(cx, cy - 10, roles, {
      fontSize: '11px',
      fontFamily: 'monospace',
      color: '#6666aa',
    }).setOrigin(0.5);

    // Start button
    const btnW = 220;
    const btnH = 40;
    const btnBg = this.add.rectangle(cx, cy + 40, btnW, btnH, 0x4169E1)
      .setInteractive({ useHandCursor: true });
    this.startText = this.add.text(cx, cy + 40, 'START', {
      fontSize: '20px',
      fontFamily: 'monospace',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Button hover effects
    btnBg.on('pointerover', () => {
      btnBg.setFillStyle(0x5179F1);
      this.startText.setColor('#ffffff');
    });
    btnBg.on('pointerout', () => {
      btnBg.setFillStyle(0x4169E1);
    });
    btnBg.on('pointerdown', () => this.startGame());

    // Blink the button
    this.tweens.add({
      targets: [btnBg],
      alpha: { from: 1, to: 0.7 },
      duration: 1200,
      yoyo: true,
      repeat: -1,
    });

    // How to Play button
    const htpBtnW = 220;
    const htpBtnH = 36;
    const htpBg = this.add.rectangle(cx, cy + 90, htpBtnW, htpBtnH, 0x555555)
      .setInteractive({ useHandCursor: true });
    this.htpText = this.add.text(cx, cy + 90, 'How to Play', {
      fontSize: '16px',
      fontFamily: 'monospace',
      color: '#cccccc',
    }).setOrigin(0.5);

    htpBg.on('pointerover', () => {
      htpBg.setFillStyle(0x666666);
      this.htpText.setColor('#ffffff');
    });
    htpBg.on('pointerout', () => {
      htpBg.setFillStyle(0x555555);
      this.htpText.setColor('#cccccc');
    });
    htpBg.on('pointerdown', () => {
      this.scene.launch('HowToPlayScene', { source: 'title-button' });
    });

    // Controls hint
    this.add.text(cx, cy + 130, 'WASD / Arrow Keys to move  |  SHIFT sprint  |  P pause  |  M mute', {
      fontSize: '11px',
      fontFamily: 'monospace',
      color: '#555577',
    }).setOrigin(0.5);

    // Credit
    this.add.text(cx, cy + 150, 'Built with Phaser 3 + Claude Code', {
      fontSize: '10px',
      fontFamily: 'monospace',
      color: '#444466',
      fontStyle: 'italic',
    }).setOrigin(0.5);

    // Input: Enter key
    this.input.keyboard.on('keydown-ENTER', this.startGame, this);

    // Debug: skip title
    if (CONFIG.DEBUG.SKIP_TITLE) {
      this.startGame();
    }
  }

  /** Add decorative office elements in the background */
  addBackgroundDecor(cx, cy) {
    // Scattered department color accents
    const deptColors = [0xFFD700, 0xFF8C00, 0x4169E1, 0x2E8B57, 0x8B5CF6];
    const positions = [
      { x: 80, y: 80 }, { x: 880, y: 80 }, { x: 80, y: 460 },
      { x: 880, y: 460 }, { x: 480, y: 480 },
    ];

    for (let i = 0; i < positions.length; i++) {
      // Small colored squares (like task icons)
      const gfx = this.add.graphics();
      gfx.fillStyle(deptColors[i], 0.15);
      gfx.fillRect(positions[i].x - 12, positions[i].y - 12, 24, 24);
      gfx.lineStyle(1, deptColors[i], 0.25);
      gfx.strokeRect(positions[i].x - 12, positions[i].y - 12, 24, 24);
    }

    // Place some furniture sprites if loaded
    const furnitureItems = [
      { key: 'furniture-desk-monitor', x: 120, y: 150 },
      { key: 'furniture-printer-large', x: 840, y: 150 },
      { key: 'env-plant-large', x: 160, y: 400 },
      { key: 'env-plant-large', x: 800, y: 400 },
      { key: 'furniture-computer', x: 750, y: 200 },
      { key: 'furniture-filing-cabinet', x: 200, y: 350 },
    ];

    for (const item of furnitureItems) {
      if (this.textures.exists(item.key)) {
        this.add.image(item.x, item.y, item.key).setAlpha(0.15).setTint(0x8888cc);
      }
    }
  }

  startGame() {
    console.log('[TitleScene] starting game');
    trackEvent('game_start');
    this.input.keyboard.off('keydown-ENTER', this.startGame, this);

    // First-time: show How to Play before starting game
    let seenHowToPlay = false;
    try {
      seenHowToPlay = !!localStorage.getItem('office-survivors-seen-how-to-play');
    } catch (_e) {
      // localStorage unavailable (iframe/privacy mode) — skip tutorial
      seenHowToPlay = true;
    }

    if (!seenHowToPlay) {
      this.scene.launch('HowToPlayScene', { source: 'title' });
    } else {
      this.scene.start('GameScene');
    }
  }

  update(time, delta) {
  }
}
