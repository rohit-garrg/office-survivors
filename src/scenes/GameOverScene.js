import Phaser from 'phaser';
import CONFIG from '../config/gameConfig.js';
import { ParticleManager } from '../systems/ParticleManager.js';
import { isTouchDevice } from '../utils/helpers.js';

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
    this._transitioning = false;
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

  /** Show Share, Play Again, and Menu buttons */
  showButtons(y) {
    const cx = CONFIG.CANVAS_WIDTH / 2;
    const isMobile = isTouchDevice();
    const btnW = isMobile ? 160 : 130;
    const btnH = isMobile ? 50 : 36;

    // Share
    const shareBg = this.add.rectangle(cx - 150, y, btnW, btnH, 0x2E8B57)
      .setInteractive({ useHandCursor: true }).setDepth(1);
    this.add.text(cx - 150, y, 'Share', {
      fontSize: '16px',
      fontFamily: 'monospace',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(2);
    shareBg.on('pointerdown', () => this.handleShare());
    shareBg.on('pointerover', () => shareBg.setFillStyle(0x3E9B67));
    shareBg.on('pointerout', () => shareBg.setFillStyle(0x2E8B57));

    // Play Again
    const playAgainBg = this.add.rectangle(cx, y, btnW, btnH, 0x4169E1)
      .setInteractive({ useHandCursor: true }).setDepth(1);
    this.add.text(cx, y, 'Play Again', {
      fontSize: '16px',
      fontFamily: 'monospace',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(2);
    playAgainBg.on('pointerdown', () => this.playAgain());
    playAgainBg.on('pointerover', () => playAgainBg.setFillStyle(0x5179F1));
    playAgainBg.on('pointerout', () => playAgainBg.setFillStyle(0x4169E1));

    // Menu
    const menuBg = this.add.rectangle(cx + 150, y, btnW, btnH, 0x555555)
      .setInteractive({ useHandCursor: true }).setDepth(1);
    this.add.text(cx + 150, y, 'Menu', {
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
    this._onSpace = () => this.playAgain();
    this._onEsc = () => this.backToMenu();
    this.input.keyboard.on('keydown-ENTER', this._onEnter);
    this.input.keyboard.on('keydown-SPACE', this._onSpace);
    this.input.keyboard.on('keydown-ESC', this._onEsc);
  }

  /** Generate share card and trigger share flow */
  async handleShare() {
    const { won, stats } = this.resultData;

    const tierDisplay = (stats.tier || 'Intern').charAt(0).toUpperCase()
      + (stats.tier || 'Intern').slice(1).toLowerCase();
    const isCEO = (stats.tier || '').toUpperCase() === 'CEO';

    const canvas = this.generateShareCard(won, stats, tierDisplay, isCEO);

    // Build share text
    let shareText;
    if (won && isCEO) {
      shareText = `I became CEO in Office Survivors! ${stats.tasksDelivered} tasks delivered in ${stats.timeSurvived}. Can you beat my climb? Play here:`;
    } else if (won) {
      shareText = `I survived as ${tierDisplay} in Office Survivors! ${stats.tasksDelivered} tasks delivered. Think you can make CEO? Play here:`;
    } else {
      shareText = `I got fired as ${tierDisplay} in Office Survivors after ${stats.timeSurvived}! Can you survive longer? Play here:`;
    }

    const shareUrl = CONFIG.SHARE_URL;

    // Try Web Share API first (mobile-friendly)
    try {
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      const file = new File([blob], 'office-survivors-score.png', { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'Office Survivors',
          text: shareText,
          files: [file],
          url: shareUrl,
        });
        canvas.remove();
        return;
      }
    } catch (e) {
      console.debug('[GameOverScene] Web Share API failed or cancelled:', e.message);
    }

    // Fallback: DOM modal
    this.showShareModal(canvas, shareText, shareUrl);
  }

  /**
   * Generate a 1200x630 share card on an offscreen canvas.
   * @returns {HTMLCanvasElement}
   */
  generateShareCard(won, stats, tierDisplay, isCEO) {
    const canvas = document.createElement('canvas');
    canvas.width = CONFIG.SHARE_CARD_WIDTH;
    canvas.height = CONFIG.SHARE_CARD_HEIGHT;
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, 1200, 630);

    // Border
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 4;
    ctx.strokeRect(20, 20, 1160, 590);

    // Title
    ctx.font = 'bold 36px Consolas, "Courier New", monospace';
    ctx.fillStyle = '#FFD700';
    ctx.fillText('OFFICE SURVIVORS', 60, 80);

    // Divider
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(60, 110);
    ctx.lineTo(1140, 110);
    ctx.stroke();

    // Headline
    let headline;
    if (won && isCEO) {
      headline = 'I BECAME CEO!';
    } else if (won) {
      headline = `I SURVIVED AS ${tierDisplay.toUpperCase()}!`;
    } else {
      headline = `FIRED AT ${tierDisplay.toUpperCase()}`;
    }

    ctx.font = 'bold 48px Consolas, "Courier New", monospace';
    ctx.fillStyle = won ? '#FFD700' : '#ff4444';
    ctx.fillText(headline, 60, 190);

    // Stats
    ctx.font = '24px Consolas, "Courier New", monospace';
    ctx.fillStyle = '#ffffff';

    const statsLeft = [
      `Title Reached: ${tierDisplay}`,
      `Tasks Delivered: ${stats.tasksDelivered || 0}`,
    ];
    const statsRight = [
      `Time: ${stats.timeSurvived || '0:00'}`,
      `Peak Stress: ${Math.floor(stats.peakStress || 0)}%`,
    ];

    statsLeft.forEach((line, i) => {
      ctx.fillText(line, 60, 260 + i * 40);
    });
    statsRight.forEach((line, i) => {
      ctx.fillText(line, 620, 260 + i * 40);
    });

    // Divider 2
    ctx.strokeStyle = '#FFD700';
    ctx.beginPath();
    ctx.moveTo(60, 360);
    ctx.lineTo(1140, 360);
    ctx.stroke();

    // Challenge text
    let challenge;
    if (won && isCEO) {
      challenge = 'I conquered corporate America. Can you climb faster?';
    } else if (won) {
      challenge = 'I survived the corporate grind. Think you can make CEO?';
    } else {
      challenge = 'Corporate America chewed me up. Can you survive longer?';
    }

    ctx.font = 'italic 22px Consolas, "Courier New", monospace';
    ctx.fillStyle = '#a0a0a0';
    ctx.fillText(challenge, 60, 420);

    // URL
    ctx.font = '20px Consolas, "Courier New", monospace';
    ctx.fillStyle = '#FFD700';
    ctx.fillText('rohitgarrg.com/projects/office-survivors', 60, 570);

    return canvas;
  }

  /** Show DOM-based share modal with download/copy/platform links */
  showShareModal(cardCanvas, shareText, shareUrl) {
    const fullShareText = `${shareText} ${shareUrl}`;

    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.id = 'share-modal';
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.8); display: flex; align-items: center;
      justify-content: center; z-index: 10000; font-family: monospace;
    `;

    const modal = document.createElement('div');
    modal.style.cssText = `
      background: #1a1a2e; border: 2px solid #FFD700; border-radius: 8px;
      padding: 20px; max-width: 500px; width: 90%; text-align: center;
    `;

    // Card preview
    const img = document.createElement('img');
    img.src = cardCanvas.toDataURL('image/png');
    img.style.cssText = 'width: 100%; border-radius: 4px; margin-bottom: 16px;';
    modal.appendChild(img);

    // Button row 1: Download + Copy Link
    const btnRow1 = document.createElement('div');
    btnRow1.style.cssText = 'display: flex; gap: 10px; margin-bottom: 12px; justify-content: center;';

    const dlBtn = document.createElement('button');
    dlBtn.textContent = 'Download Image';
    dlBtn.style.cssText = `
      background: #4169E1; color: white; border: none; padding: 10px 16px;
      border-radius: 4px; cursor: pointer; font-family: monospace; font-size: 14px;
    `;
    dlBtn.onclick = () => {
      const link = document.createElement('a');
      link.download = 'office-survivors-score.png';
      link.href = cardCanvas.toDataURL('image/png');
      link.click();
    };
    btnRow1.appendChild(dlBtn);

    const copyBtn = document.createElement('button');
    copyBtn.textContent = 'Copy Link';
    copyBtn.style.cssText = `
      background: #555; color: white; border: none; padding: 10px 16px;
      border-radius: 4px; cursor: pointer; font-family: monospace; font-size: 14px;
    `;
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(shareUrl).then(() => {
        copyBtn.textContent = 'Link copied!';
        setTimeout(() => { copyBtn.textContent = 'Copy Link'; }, 2000);
      });
    };
    btnRow1.appendChild(copyBtn);
    modal.appendChild(btnRow1);

    // Social share row
    const socialLabel = document.createElement('p');
    socialLabel.textContent = 'Share on:';
    socialLabel.style.cssText = 'color: #a0a0a0; margin: 8px 0 8px 0; font-size: 13px;';
    modal.appendChild(socialLabel);

    const btnRow2 = document.createElement('div');
    btnRow2.style.cssText = 'display: flex; gap: 10px; margin-bottom: 16px; justify-content: center;';

    const encoded = encodeURIComponent(fullShareText);
    const encodedUrl = encodeURIComponent(shareUrl);

    const socials = [
      { name: 'WhatsApp', url: `https://wa.me/?text=${encoded}`, color: '#25D366' },
      { name: 'Twitter', url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodedUrl}`, color: '#1DA1F2' },
      { name: 'LinkedIn', url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`, color: '#0077B5' },
    ];

    for (const social of socials) {
      const btn = document.createElement('button');
      btn.textContent = social.name;
      btn.style.cssText = `
        background: ${social.color}; color: white; border: none; padding: 8px 14px;
        border-radius: 4px; cursor: pointer; font-family: monospace; font-size: 13px;
      `;
      btn.onclick = () => window.open(social.url, '_blank');
      btnRow2.appendChild(btn);
    }
    modal.appendChild(btnRow2);

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.style.cssText = `
      background: #333; color: #aaa; border: 1px solid #555; padding: 8px 24px;
      border-radius: 4px; cursor: pointer; font-family: monospace; font-size: 14px;
    `;
    closeBtn.onclick = () => {
      overlay.remove();
      cardCanvas.remove();
    };
    modal.appendChild(closeBtn);

    overlay.appendChild(modal);

    // Click outside to close
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
        cardCanvas.remove();
      }
    });

    document.body.appendChild(overlay);
  }

  /** Clean up keyboard listeners */
  shutdown() {
    if (this._onEnter) {
      this.input.keyboard.off('keydown-ENTER', this._onEnter);
    }
    if (this._onSpace) {
      this.input.keyboard.off('keydown-SPACE', this._onSpace);
    }
    if (this._onEsc) {
      this.input.keyboard.off('keydown-ESC', this._onEsc);
    }
  }

  /** Restart the game */
  playAgain() {
    if (this._transitioning) return;
    this._transitioning = true;

    this.scene.stop('UIScene');
    this.scene.stop('GameScene');
    this.scene.start('GameScene');
    this.scene.stop();
  }

  /** Go back to title screen */
  backToMenu() {
    if (this._transitioning) return;
    this._transitioning = true;

    this.scene.stop('UIScene');
    this.scene.stop('GameScene');
    this.scene.start('TitleScene');
    this.scene.stop();
  }
}
