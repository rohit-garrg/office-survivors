import Phaser from 'phaser';
import CONFIG from '../config/gameConfig.js';
import { trackEvent } from '../utils/analytics.js';

const PIXEL_FONT = '"Press Start 2P", monospace';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super({ key: 'TitleScene' });
    console.log('[TitleScene] initialized');
  }

  create() {
    console.log('[TitleScene] create');

    const w = CONFIG.CANVAS_WIDTH;   // 960
    const h = CONFIG.CANVAS_HEIGHT;  // 540
    const cx = w / 2;
    const cy = h / 2;

    this.howToPlayOpen = false;

    // === 9. ENTRANCE: Start with black screen, fade in ===
    this.cameras.main.setBackgroundColor('#000000');

    // === 1. BACKGROUND IMAGE ===
    this.bg = this.add.image(cx, cy, 'title-bg')
      .setOrigin(0.5)
      .setDisplaySize(w, h)
      .setAlpha(0);

    // === 3. LIGHT RAY SHIMMER ===
    this.createLightRay(cx, cy, w, h);

    // === 2. DUST PARTICLES (start after bg fades in) ===
    this.dustEmitter = null; // created after bg fade-in

    // === 4. TITLE TEXT ===
    this.titleText = this.createTitle(cx, h);

    // === 5. MENU ITEMS ===
    this.menuItems = this.createMenu(cx, h);

    // === 7. CREDIT TEXT ===
    this.creditText = this.add.text(w - 10, h - 10, 'Built with Claude Code + PixelLab', {
      fontSize: '8px',
      fontFamily: PIXEL_FONT,
      color: '#ffffff',
    }).setOrigin(1, 1).setAlpha(0);

    // === 6. HOW TO PLAY OVERLAY (hidden) ===
    this.howToPlayGroup = this.createHowToPlayOverlay(cx, cy, w, h);

    // === 9. ENTRANCE ANIMATION SEQUENCE ===
    this.playEntranceAnimation(cx, h);

    // === INPUT ===
    this.enterKey = this.input.keyboard.on('keydown-ENTER', () => {
      if (this.howToPlayOpen) {
        this.closeHowToPlay();
      } else {
        this.startGame();
      }
    });
    this.escKey = this.input.keyboard.on('keydown-ESC', () => {
      if (this.howToPlayOpen) {
        this.closeHowToPlay();
      }
    });

    // Clean up on scene shutdown
    this.events.on('shutdown', this.shutdown, this);

    // Debug: skip title
    if (CONFIG.DEBUG.SKIP_TITLE) {
      this.startGame();
    }
  }

  // ─── 3. LIGHT RAY SHIMMER ──────────────────────────────────

  createLightRay(cx, cy, w, h) {
    const rayGfx = this.make.graphics({ add: false });

    // Angled gradient band — a tall rectangle with soft alpha
    const rayW = 300;
    const rayH = h + 100;
    for (let i = 0; i < rayW; i++) {
      // Bell-curve alpha across the width
      const t = i / rayW;
      const alpha = Math.sin(t * Math.PI) * 0.05;
      rayGfx.fillStyle(0xffffff, alpha);
      rayGfx.fillRect(i, 0, 1, rayH);
    }
    rayGfx.generateTexture('light-ray', rayW, rayH);
    rayGfx.destroy();

    this.lightRay = this.add.image(cx, cy, 'light-ray')
      .setAlpha(0)
      .setAngle(-20)
      .setBlendMode(Phaser.BlendModes.ADD);

    // Slow horizontal sway
    this.tweens.add({
      targets: this.lightRay,
      x: { from: cx - 30, to: cx + 30 },
      duration: 9000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  // ─── 2. DUST PARTICLES ─────────────────────────────────────

  startDustParticles(w, h) {
    this.dustEmitter = this.add.particles(0, 0, 'dust-mote', {
      x: { min: 0, max: w },
      y: { min: 0, max: h * 0.6 },
      lifespan: { min: 8000, max: 12000 },
      speedX: { min: 5, max: 15 },
      speedY: { min: -3, max: 3 },
      alpha: {
        onEmit: () => 0,
        onUpdate: (_particle, _key, t) => {
          // t goes 0 → 1 over lifespan
          if (t < 0.1) return Phaser.Math.Linear(0, 0.35, t / 0.1);
          if (t > 0.8) return Phaser.Math.Linear(0.35, 0, (t - 0.8) / 0.2);
          return 0.15 + Math.sin(t * 20) * 0.1; // gentle shimmer
        },
      },
      scale: { min: 0.3, max: 0.6 },
      quantity: 1,
      frequency: 500,
      maxParticles: 20,
      blendMode: Phaser.BlendModes.ADD,
    });
  }

  // ─── 4. TITLE TEXT ──────────────────────────────────────────

  createTitle(cx, h) {
    const titleY = h * 0.22;

    // Decorative lines on either side
    const lineW = 60;
    const lineGap = 12;

    // Create title text
    const title = this.add.text(cx, titleY, 'OFFICE SURVIVORS', {
      fontSize: '32px',
      fontFamily: PIXEL_FONT,
      color: '#FFFFFF',
      shadow: {
        offsetX: 2,
        offsetY: 2,
        color: 'rgba(0,0,0,0.6)',
        blur: 0,
        fill: true,
      },
    }).setOrigin(0.5).setAlpha(0);

    // Calculate line positions based on title width
    const halfTitle = title.width / 2;

    // Left decorative line
    const leftLine = this.add.graphics().setAlpha(0);
    leftLine.lineStyle(2, 0xFFFFFF, 0.5);
    leftLine.lineBetween(cx - halfTitle - lineGap - lineW, titleY, cx - halfTitle - lineGap, titleY);
    // Left dot
    leftLine.fillStyle(0xFFD700, 0.7);
    leftLine.fillCircle(cx - halfTitle - lineGap - lineW, titleY, 3);

    // Right decorative line
    const rightLine = this.add.graphics().setAlpha(0);
    rightLine.lineStyle(2, 0xFFFFFF, 0.5);
    rightLine.lineBetween(cx + halfTitle + lineGap, titleY, cx + halfTitle + lineGap + lineW, titleY);
    // Right dot
    rightLine.fillStyle(0xFFD700, 0.7);
    rightLine.fillCircle(cx + halfTitle + lineGap + lineW, titleY, 3);

    // Store references for entrance animation
    title._decorLeft = leftLine;
    title._decorRight = rightLine;
    title._baseY = titleY;

    return title;
  }

  // ─── 5. MENU ITEMS ─────────────────────────────────────────

  createMenu(cx, h) {
    const menuY = h * 0.72;
    const gap = 45;

    const items = [
      { label: 'Start Game', action: () => this.startGame() },
      { label: 'How to Play', action: () => this.openHowToPlay() },
    ];

    const menuTexts = [];

    for (let i = 0; i < items.length; i++) {
      const y = menuY + i * gap;
      const text = this.add.text(cx, y + 30, items[i].label, {
        fontSize: '16px',
        fontFamily: PIXEL_FONT,
        color: '#FFFFFF',
        shadow: {
          offsetX: 2,
          offsetY: 2,
          color: 'rgba(0,0,0,0.6)',
          blur: 0,
          fill: true,
        },
      }).setOrigin(0.5).setAlpha(0).setInteractive({ useHandCursor: true });

      text._finalY = y;
      text._action = items[i].action;

      // Hover effects
      text.on('pointerover', () => {
        this.tweens.add({
          targets: text,
          scaleX: 1.08,
          scaleY: 1.08,
          duration: 100,
          ease: 'Power2',
        });
        text.setColor('#FFD700');
      });

      text.on('pointerout', () => {
        this.tweens.add({
          targets: text,
          scaleX: 1,
          scaleY: 1,
          duration: 100,
          ease: 'Power2',
        });
        text.setColor('#FFFFFF');
      });

      text.on('pointerdown', () => {
        text._action();
      });

      menuTexts.push(text);
    }

    return menuTexts;
  }

  // ─── 6. HOW TO PLAY OVERLAY ─────────────────────────────────

  createHowToPlayOverlay(cx, cy, w, h) {
    const group = [];

    // Dimmed backdrop
    const backdrop = this.add.rectangle(cx, cy, w, h, 0x000000, 0.8)
      .setInteractive() // block clicks
      .setVisible(false)
      .setDepth(100);
    backdrop.on('pointerdown', () => this.closeHowToPlay());
    group.push(backdrop);

    // Panel
    const panelW = 620;
    const panelH = 340;
    const panelBg = this.add.rectangle(cx, cy, panelW, panelH, 0x0d0d1a, 0.95)
      .setStrokeStyle(2, 0x4169E1, 0.6)
      .setVisible(false)
      .setDepth(101);
    group.push(panelBg);

    // Panel title
    const panelTitle = this.add.text(cx, cy - panelH / 2 + 30, 'HOW TO PLAY', {
      fontSize: '18px',
      fontFamily: PIXEL_FONT,
      color: '#4169E1',
    }).setOrigin(0.5).setVisible(false).setDepth(102);
    group.push(panelTitle);

    // Content lines
    const lines = [
      { text: 'WASD / Arrow Keys - Move', color: '#FFFFFF' },
      { text: 'Shift (hold) - Sprint', color: '#FFFFFF' },
      { text: '', color: '#FFFFFF' },
      { text: 'Pick up tasks and deliver them', color: '#aaaacc' },
      { text: 'to matching departments', color: '#aaaacc' },
      { text: '', color: '#FFFFFF' },
      { text: 'Avoid chaos agents!', color: '#ff6666' },
      { text: '', color: '#FFFFFF' },
      { text: 'Survive the workday.', color: '#FFD700' },
      { text: 'Climb the corporate ladder.', color: '#FFD700' },
    ];

    let lineY = cy - panelH / 2 + 70;
    for (const line of lines) {
      if (line.text === '') {
        lineY += 8;
        continue;
      }
      const t = this.add.text(cx, lineY, line.text, {
        fontSize: '11px',
        fontFamily: PIXEL_FONT,
        color: line.color,
      }).setOrigin(0.5).setVisible(false).setDepth(102);
      group.push(t);
      lineY += 22;
    }

    // Close hint
    const closeHint = this.add.text(cx, cy + panelH / 2 - 25, 'Press any key or click to close', {
      fontSize: '9px',
      fontFamily: PIXEL_FONT,
      color: '#555577',
    }).setOrigin(0.5).setVisible(false).setDepth(102);
    group.push(closeHint);

    return group;
  }

  openHowToPlay() {
    this.howToPlayOpen = true;
    for (const el of this.howToPlayGroup) {
      el.setVisible(true);
    }
    // Close on any keypress
    this._htpKeyClose = (event) => {
      // Don't close on modifier keys alone
      if (['Shift', 'Control', 'Alt', 'Meta'].includes(event.key)) return;
      this.closeHowToPlay();
    };
    this.input.keyboard.on('keydown', this._htpKeyClose);
  }

  closeHowToPlay() {
    this.howToPlayOpen = false;
    for (const el of this.howToPlayGroup) {
      el.setVisible(false);
    }
    if (this._htpKeyClose) {
      this.input.keyboard.off('keydown', this._htpKeyClose);
      this._htpKeyClose = null;
    }
  }

  // ─── 9. ENTRANCE ANIMATION ─────────────────────────────────

  playEntranceAnimation(cx, h) {
    const w = CONFIG.CANVAS_WIDTH;

    // Step 1: Background fades in (0 → 1s)
    this.tweens.add({
      targets: this.bg,
      alpha: 1,
      duration: 1000,
      ease: 'Power2',
      onComplete: () => {
        // Start dust particles after bg is visible
        this.startDustParticles(w, h);
      },
    });

    // Light ray fades in with background
    this.tweens.add({
      targets: this.lightRay,
      alpha: 1,
      duration: 1500,
      delay: 500,
      ease: 'Power2',
    });

    // Step 2: Title fades in + drops down (0.5s delay, 0.5s duration)
    this.tweens.add({
      targets: this.titleText,
      alpha: 1,
      y: this.titleText._baseY,
      duration: 500,
      delay: 500,
      ease: 'Back.easeOut',
      onStart: () => {
        this.titleText.setY(this.titleText._baseY - 20);
      },
      onComplete: () => {
        // Start floating animation
        this.tweens.add({
          targets: this.titleText,
          y: this.titleText._baseY - 4,
          duration: 2500,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      },
    });

    // Decorative lines fade in with title
    this.tweens.add({
      targets: [this.titleText._decorLeft, this.titleText._decorRight],
      alpha: 1,
      duration: 500,
      delay: 700,
      ease: 'Power2',
    });

    // Step 3: Menu items stagger in from below (1s delay)
    for (let i = 0; i < this.menuItems.length; i++) {
      const item = this.menuItems[i];
      this.tweens.add({
        targets: item,
        alpha: 1,
        y: item._finalY,
        duration: 500,
        delay: 1000 + i * 300,
        ease: 'Back.easeOut',
      });
    }

    // Credit fades in last
    this.tweens.add({
      targets: this.creditText,
      alpha: 0.4,
      duration: 500,
      delay: 1800,
      ease: 'Power2',
    });
  }

  // ─── 8. START GAME (with fade) ──────────────────────────────

  startGame() {
    if (this._starting) return;
    this._starting = true;

    console.log('[TitleScene] starting game');
    trackEvent('game_start');

    // Clean up inputs
    this.input.keyboard.off('keydown-ENTER');
    this.input.keyboard.off('keydown-ESC');

    // Fade to black
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      // Check first-time how-to-play
      let seenHowToPlay = false;
      try {
        seenHowToPlay = !!localStorage.getItem('office-survivors-seen-how-to-play');
      } catch (_e) {
        seenHowToPlay = true;
      }

      if (!seenHowToPlay) {
        this.scene.launch('HowToPlayScene', { source: 'title' });
      } else {
        this.scene.start('GameScene');
      }
    });
  }

  update() {
    // Sine-wave vertical oscillation for dust particles
    // Handled by the particle emitter config
  }

  shutdown() {
    // Clean up listeners
    this.input.keyboard.off('keydown-ENTER');
    this.input.keyboard.off('keydown-ESC');
    if (this._htpKeyClose) {
      this.input.keyboard.off('keydown', this._htpKeyClose);
    }
  }
}
