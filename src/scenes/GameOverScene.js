import Phaser from 'phaser';
import CONFIG from '../config/gameConfig.js';
import { ParticleManager } from '../systems/ParticleManager.js';

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameOverScene' });
    console.log('[GameOverScene] initialized');
  }

  /**
   * @param {object} data - { won, stats }
   */
  init(data) {
    this.resultData = data;
  }

  /** Show win or lose screen with stats */
  create() {
    console.log('[GameOverScene] create', this.resultData);

    // Dim background
    this.add.rectangle(
      CONFIG.CANVAS_WIDTH / 2, CONFIG.CANVAS_HEIGHT / 2,
      CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT,
      0x000000, 0.7
    ).setDepth(0).setInteractive(); // block clicks to GameScene below

    if (this.resultData.won) {
      this.showVictory(this.resultData.stats);
    } else {
      this.showGameOver(this.resultData.stats);
    }

    // Register shutdown lifecycle
    this.events.once('shutdown', this.shutdown, this);
  }

  /** Display victory screen */
  showVictory(stats) {
    const cx = CONFIG.CANVAS_WIDTH / 2;
    const cy = CONFIG.CANVAS_HEIGHT / 2;

    // Victory confetti burst
    const particles = new ParticleManager(this);
    particles.init();
    particles.victoryConfetti(cx, cy - 60);

    this.add.text(cx, cy - 140, 'YOU SURVIVED', {
      fontSize: '40px',
      fontFamily: 'monospace',
      color: '#FFD700',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(1);

    this.add.text(cx, cy - 95, 'CORPORATE INDIA', {
      fontSize: '28px',
      fontFamily: 'monospace',
      color: '#FFD700',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(1);

    this.showStats(stats, cy - 50);
    this.showButtons(cy + 120);
  }

  /** Display game over screen */
  showGameOver(stats) {
    const cx = CONFIG.CANVAS_WIDTH / 2;
    const cy = CONFIG.CANVAS_HEIGHT / 2;

    this.add.text(cx, cy - 140, "YOU'VE BEEN", {
      fontSize: '36px',
      fontFamily: 'monospace',
      color: '#ff4444',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(1);

    this.add.text(cx, cy - 100, 'LET GO', {
      fontSize: '48px',
      fontFamily: 'monospace',
      color: '#ff4444',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(1);

    this.showStats(stats, cy - 50);
    this.showButtons(cy + 120);
  }

  /** Show stats block */
  showStats(stats, startY) {
    const cx = CONFIG.CANVAS_WIDTH / 2;
    const lines = [
      `Title Reached: ${stats.tier || 'Intern'}`,
      `Time Survived: ${stats.timeSurvived || '0:00'}`,
      `Tasks Delivered: ${stats.tasksDelivered || 0}`,
      `Peak Stress: ${Math.floor(stats.peakStress || 0)}%`,
      `Total XP: ${stats.totalXP || 0}`,
    ];

    lines.forEach((line, i) => {
      this.add.text(cx, startY + i * 26, line, {
        fontSize: '15px',
        fontFamily: 'monospace',
        color: '#cccccc',
      }).setOrigin(0.5).setDepth(1);
    });
  }

  /** Show Play Again and Menu buttons */
  showButtons(y) {
    const cx = CONFIG.CANVAS_WIDTH / 2;

    // Play Again
    const playAgainBg = this.add.rectangle(cx - 90, y, 150, 36, 0x4169E1)
      .setInteractive({ useHandCursor: true }).setDepth(1);
    this.add.text(cx - 90, y, 'Play Again', {
      fontSize: '16px',
      fontFamily: 'monospace',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(2);

    playAgainBg.on('pointerdown', () => this.playAgain());
    playAgainBg.on('pointerover', () => playAgainBg.setFillStyle(0x5179F1));
    playAgainBg.on('pointerout', () => playAgainBg.setFillStyle(0x4169E1));

    // Menu
    const menuBg = this.add.rectangle(cx + 90, y, 150, 36, 0x555555)
      .setInteractive({ useHandCursor: true }).setDepth(1);
    this.add.text(cx + 90, y, 'Menu', {
      fontSize: '16px',
      fontFamily: 'monospace',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(2);

    menuBg.on('pointerdown', () => this.backToMenu());
    menuBg.on('pointerover', () => menuBg.setFillStyle(0x666666));
    menuBg.on('pointerout', () => menuBg.setFillStyle(0x555555));

    // Keyboard shortcuts (store refs for cleanup)
    this._onEnter = () => this.playAgain();
    this._onEsc = () => this.backToMenu();
    this.input.keyboard.on('keydown-ENTER', this._onEnter);
    this.input.keyboard.on('keydown-ESC', this._onEsc);
  }

  /** Clean up keyboard listeners */
  shutdown() {
    if (this._onEnter) {
      this.input.keyboard.off('keydown-ENTER', this._onEnter);
    }
    if (this._onEsc) {
      this.input.keyboard.off('keydown-ESC', this._onEsc);
    }
  }

  /** Restart the game */
  playAgain() {
    this.scene.stop('UIScene');
    this.scene.stop('GameScene');
    this.scene.start('GameScene');
    this.scene.stop();
  }

  /** Go back to title screen */
  backToMenu() {
    this.scene.stop('UIScene');
    this.scene.stop('GameScene');
    this.scene.start('TitleScene');
    this.scene.stop();
  }
}
