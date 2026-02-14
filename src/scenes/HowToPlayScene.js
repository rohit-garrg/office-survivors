import Phaser from 'phaser';
import CONFIG from '../config/gameConfig.js';

const STORAGE_KEY = 'office-survivors-seen-how-to-play';

const PAGE_COUNT = 5;

// Panel dimensions
const PANEL_W = 800;
const PANEL_H = 460;
const PANEL_COLOR = 0x0d0d1a;
const PANEL_ALPHA = 0.95;
const BORDER_COLOR = 0x333355;
const ACCENT_COLOR = 0x4169E1;

// Department colors (matches CLAUDE.md spec)
const DEPT_COLORS = {
  CEO: '#FFD700',
  Marketing: '#FF8C00',
  Engineering: '#4169E1',
  Finance: '#2E8B57',
  HR: '#8B5CF6',
};

export class HowToPlayScene extends Phaser.Scene {
  constructor() {
    super({ key: 'HowToPlayScene' });
  }

  init(data) {
    /** @type {'title'|'pause'|'title-button'} */
    this.source = data.source || 'title';
    this.currentPage = 0;
  }

  create() {
    const cx = CONFIG.CANVAS_WIDTH / 2;
    const cy = CONFIG.CANVAS_HEIGHT / 2;

    // Dimmed backdrop
    this.dimBg = this.add.rectangle(cx, cy, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT, 0x000000, 0.7)
      .setDepth(600).setInteractive(); // block clicks to scene below

    // Panel background
    this.panelBg = this.add.rectangle(cx, cy, PANEL_W, PANEL_H, PANEL_COLOR, PANEL_ALPHA)
      .setStrokeStyle(2, BORDER_COLOR)
      .setDepth(601);

    // Close button [X] top-right of panel
    const closeX = cx + PANEL_W / 2 - 30;
    const closeY = cy - PANEL_H / 2 + 20;
    this.closeBtn = this.add.text(closeX, closeY, '[X]', {
      fontSize: '16px', fontFamily: 'monospace', color: '#888888',
    }).setOrigin(0.5).setDepth(602).setInteractive({ useHandCursor: true });
    this.closeBtn.on('pointerover', () => this.closeBtn.setColor('#ffffff'));
    this.closeBtn.on('pointerout', () => this.closeBtn.setColor('#888888'));
    this.closeBtn.on('pointerdown', () => this.close());

    // Page title (updated per page)
    this.pageTitle = this.add.text(cx, cy - PANEL_H / 2 + 20, '', {
      fontSize: '20px', fontFamily: 'monospace', color: '#4169E1', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(602);

    // Nav arrows
    const arrowY = cy + PANEL_H / 2 - 30;
    this.prevArrow = this.add.text(cx - 100, arrowY, '< PREV', {
      fontSize: '14px', fontFamily: 'monospace', color: '#888888',
    }).setOrigin(0.5).setDepth(602).setInteractive({ useHandCursor: true });
    this.prevArrow.on('pointerover', () => this.prevArrow.setColor('#ffffff'));
    this.prevArrow.on('pointerout', () => this.prevArrow.setColor('#888888'));
    this.prevArrow.on('pointerdown', () => this.changePage(-1));

    this.nextArrow = this.add.text(cx + 100, arrowY, 'NEXT >', {
      fontSize: '14px', fontFamily: 'monospace', color: '#888888',
    }).setOrigin(0.5).setDepth(602).setInteractive({ useHandCursor: true });
    this.nextArrow.on('pointerover', () => this.nextArrow.setColor('#ffffff'));
    this.nextArrow.on('pointerout', () => this.nextArrow.setColor('#888888'));
    this.nextArrow.on('pointerdown', () => this.changePage(1));

    // Page dots
    this.dots = [];
    const dotStartX = cx - (PAGE_COUNT - 1) * 12 / 2;
    for (let i = 0; i < PAGE_COUNT; i++) {
      const dot = this.add.circle(dotStartX + i * 12, arrowY + 20, 5, 0x333355)
        .setDepth(602);
      this.dots.push(dot);
    }

    // Hint text
    this.add.text(cx, cy + PANEL_H / 2 - 8, 'ESC to close  |  Arrow keys to navigate', {
      fontSize: '10px', fontFamily: 'monospace', color: '#555577',
    }).setOrigin(0.5).setDepth(602);

    // Keyboard controls
    this._keyLeft = this.input.keyboard.on('keydown-LEFT', () => this.changePage(-1));
    this._keyRight = this.input.keyboard.on('keydown-RIGHT', () => this.changePage(1));
    this._keyA = this.input.keyboard.on('keydown-A', () => this.changePage(-1));
    this._keyD = this.input.keyboard.on('keydown-D', () => this.changePage(1));
    this._keyEsc = this.input.keyboard.on('keydown-ESC', () => this.close());
    this._keyEnter = this.input.keyboard.on('keydown-ENTER', () => this.close());

    // Container for page-specific elements (destroyed on page change)
    this.pageElements = [];

    // Show first page
    this.showPage(0);
  }

  changePage(dir) {
    const next = this.currentPage + dir;
    if (next < 0 || next >= PAGE_COUNT) return;
    this.showPage(next);
  }

  showPage(index) {
    // Destroy previous page elements
    for (const el of this.pageElements) {
      el.destroy();
    }
    this.pageElements = [];

    this.currentPage = index;

    // Update dots
    for (let i = 0; i < PAGE_COUNT; i++) {
      this.dots[i].setFillStyle(i === index ? ACCENT_COLOR : 0x333355);
    }

    // Update arrows visibility
    this.prevArrow.setVisible(index > 0);
    this.nextArrow.setVisible(index < PAGE_COUNT - 1);

    // Page titles
    const titles = ['The Mission', 'Tasks & Departments', 'Stress & Stamina', 'Chaos Agents', 'Career & Upgrades'];
    this.pageTitle.setText(titles[index]);

    // Build page content
    switch (index) {
      case 0: this.buildPage0(); break;
      case 1: this.buildPage1(); break;
      case 2: this.buildPage2(); break;
      case 3: this.buildPage3(); break;
      case 4: this.buildPage4(); break;
    }
  }

  /** Helper: add text to page (auto-tracked for cleanup) */
  addPageText(x, y, text, style = {}) {
    const defaults = { fontSize: '12px', fontFamily: 'monospace', color: '#ccccdd' };
    const t = this.add.text(x, y, text, { ...defaults, ...style })
      .setDepth(602);
    this.pageElements.push(t);
    return t;
  }

  /** Helper: add colored rectangle (auto-tracked for cleanup) */
  addPageRect(x, y, w, h, color, alpha = 1) {
    const r = this.add.rectangle(x, y, w, h, color, alpha).setDepth(602);
    this.pageElements.push(r);
    return r;
  }

  // ─── PAGE 0: The Mission ───────────────────────────────────────

  buildPage0() {
    const cx = CONFIG.CANVAS_WIDTH / 2;
    const cy = CONFIG.CANVAS_HEIGHT / 2;
    const left = cx - PANEL_W / 2 + 40;
    let y = cy - PANEL_H / 2 + 55;

    this.addPageText(cx, y, 'Survive a 10-minute corporate workday.', {
      fontSize: '14px', color: '#ffffff',
    }).setOrigin(0.5);

    y += 30;
    this.addPageText(cx, y, 'Pick up tasks, deliver them to the right departments,', {
      color: '#aaaacc',
    }).setOrigin(0.5);
    y += 16;
    this.addPageText(cx, y, 'and keep your stress below 100%.', {
      color: '#aaaacc',
    }).setOrigin(0.5);

    y += 35;
    this.addPageText(cx, y, '─── Controls ───', {
      fontSize: '13px', color: '#4169E1',
    }).setOrigin(0.5);

    y += 25;
    const controls = [
      ['WASD / Arrows', 'Move around the office'],
      ['SHIFT', 'Sprint (uses stamina)'],
      ['SPACE', 'Pick up tasks (auto-pickup near tasks)'],
      ['P / ESC', 'Pause the game'],
      ['M', 'Toggle sound on/off'],
    ];

    for (const [key, desc] of controls) {
      this.addPageText(left + 60, y, key, {
        fontSize: '13px', color: '#FFD700', fontStyle: 'bold',
      }).setOrigin(1, 0);
      this.addPageText(left + 80, y, desc, {
        fontSize: '12px', color: '#ccccdd',
      });
      y += 22;
    }

    y += 15;
    this.addPageText(cx, y, 'Walk near tasks to auto-pickup. Walk into departments to auto-deliver.', {
      fontSize: '11px', color: '#888899',
    }).setOrigin(0.5);
  }

  // ─── PAGE 1: Tasks & Departments ──────────────────────────────

  buildPage1() {
    const cx = CONFIG.CANVAS_WIDTH / 2;
    const cy = CONFIG.CANVAS_HEIGHT / 2;
    const left = cx - PANEL_W / 2 + 40;
    let y = cy - PANEL_H / 2 + 55;

    this.addPageText(cx, y, 'Tasks appear on the map as colored icons.', {
      fontSize: '13px', color: '#ffffff',
    }).setOrigin(0.5);

    y += 28;
    const taskInfo = [
      'Walk near a task to pick it up (max 3 at a time).',
      'Each task must be delivered to a specific department.',
      'Multi-stop tasks visit 2-3 departments in sequence.',
      'Undelivered tasks expire after 60 seconds (+stress).',
    ];
    for (const line of taskInfo) {
      this.addPageText(left, y, '  ' + line, { fontSize: '11px', color: '#aaaacc' });
      y += 17;
    }

    y += 15;
    this.addPageText(cx, y, '─── Departments ───', {
      fontSize: '13px', color: '#4169E1',
    }).setOrigin(0.5);

    y += 25;
    const depts = [
      ['CEO Office', DEPT_COLORS.CEO, 'Top-left corner — gold tasks'],
      ['Marketing', DEPT_COLORS.Marketing, 'Left side — orange tasks'],
      ['Engineering', DEPT_COLORS.Engineering, 'Bottom-left — blue tasks'],
      ['Finance', DEPT_COLORS.Finance, 'Right side — green tasks'],
      ['HR', DEPT_COLORS.HR, 'Bottom-right — purple tasks'],
    ];

    for (const [name, color, desc] of depts) {
      // Color square
      this.addPageRect(left + 10, y + 6, 12, 12, Phaser.Display.Color.HexStringToColor(color).color);
      this.addPageText(left + 25, y, name, {
        fontSize: '12px', color: color, fontStyle: 'bold',
      });
      this.addPageText(left + 150, y, desc, {
        fontSize: '11px', color: '#888899',
      });
      y += 22;
    }

    y += 10;
    this.addPageText(cx, y, 'Task color matches the department it needs to go to.', {
      fontSize: '11px', color: '#888899',
    }).setOrigin(0.5);
  }

  // ─── PAGE 2: Stress & Stamina ─────────────────────────────────

  buildPage2() {
    const cx = CONFIG.CANVAS_WIDTH / 2;
    const cy = CONFIG.CANVAS_HEIGHT / 2;
    const left = cx - PANEL_W / 2 + 40;
    let y = cy - PANEL_H / 2 + 55;

    // Stress section
    this.addPageText(cx, y, '─── Stress ───', {
      fontSize: '13px', color: '#ff4444',
    }).setOrigin(0.5);

    y += 25;
    const stressInfo = [
      'Stress rises while you have undelivered tasks.',
      'More tasks carried = faster stress buildup.',
      'Tasks expiring adds instant stress.',
      'Stress hits 100% = Game Over!',
    ];
    for (const line of stressInfo) {
      this.addPageText(left, y, '  ' + line, { fontSize: '11px', color: '#ccbbbb' });
      y += 17;
    }

    y += 8;
    this.addPageText(cx, y, 'Delivering tasks reduces stress by 7-16%.', {
      fontSize: '12px', color: '#44ff44',
    }).setOrigin(0.5);

    y += 18;
    this.addPageText(cx, y, 'Above 50% stress, passive decay kicks in (0.5%/sec).', {
      fontSize: '11px', color: '#888899',
    }).setOrigin(0.5);

    // Stamina section
    y += 35;
    this.addPageText(cx, y, '─── Stamina ───', {
      fontSize: '13px', color: '#44aaff',
    }).setOrigin(0.5);

    y += 25;
    const staminaInfo = [
      'Hold SHIFT to sprint (1.6x speed).',
      'Sprinting drains stamina at 20/sec.',
      'Stamina regenerates at 15/sec when not sprinting.',
      'Manage your sprints — don\'t run on empty!',
    ];
    for (const line of staminaInfo) {
      this.addPageText(left, y, '  ' + line, { fontSize: '11px', color: '#aaccdd' });
      y += 17;
    }
  }

  // ─── PAGE 3: Chaos Agents ─────────────────────────────────────

  buildPage3() {
    const cx = CONFIG.CANVAS_WIDTH / 2;
    const cy = CONFIG.CANVAS_HEIGHT / 2;
    const left = cx - PANEL_W / 2 + 40;
    let y = cy - PANEL_H / 2 + 55;

    this.addPageText(cx, y, 'Chaos agents spawn in waves to disrupt your work.', {
      fontSize: '13px', color: '#ffffff',
    }).setOrigin(0.5);

    y += 28;
    this.addPageText(cx, y, 'Avoid them or deal with their effects!', {
      fontSize: '12px', color: '#aaaacc',
    }).setOrigin(0.5);

    y += 35;
    const agents = [
      ['Micromanager', '#ff6666', 'Follows you and slows your movement by 40%.'],
      ['Reply-All Guy', '#ffaa44', 'Floods the map with junk mail tasks that expire fast.'],
      ['Meeting Scheduler', '#ff44ff', 'Blocks departments — you can\'t deliver there.'],
      ['Chatty Colleague', '#44ddff', 'Walks up and freezes you for 2.5 seconds.'],
      ['Slack Pinger', '#ffff44', 'Creates fake/decoy tasks that waste your time.'],
    ];

    for (const [name, color, desc] of agents) {
      this.addPageText(left, y, name, {
        fontSize: '13px', color: color, fontStyle: 'bold',
      });
      y += 18;
      this.addPageText(left + 15, y, desc, {
        fontSize: '11px', color: '#999999',
      });
      y += 28;
    }

    y += 5;
    this.addPageText(cx, y, 'Agents get more frequent and aggressive as you level up.', {
      fontSize: '11px', color: '#888899',
    }).setOrigin(0.5);
  }

  // ─── PAGE 4: Career & Upgrades ────────────────────────────────

  buildPage4() {
    const cx = CONFIG.CANVAS_WIDTH / 2;
    const cy = CONFIG.CANVAS_HEIGHT / 2;
    const left = cx - PANEL_W / 2 + 40;
    let y = cy - PANEL_H / 2 + 55;

    this.addPageText(cx, y, '─── Career Ladder ───', {
      fontSize: '13px', color: '#FFD700',
    }).setOrigin(0.5);

    y += 25;
    const tiers = [
      ['Intern', '#aaaacc', 'Levels 1-2 — Easy tasks, low stress'],
      ['Associate', '#66bb66', 'Levels 3-4 — Multi-stop tasks appear'],
      ['Manager', '#4499ff', 'Levels 5-6 — More chaos agents'],
      ['Director', '#cc66ff', 'Levels 7-8 — High stress rates'],
      ['CEO', '#FFD700', 'Level 9 — Survive to the end!'],
    ];

    for (const [name, color, desc] of tiers) {
      this.addPageText(left + 80, y, name, {
        fontSize: '12px', color: color, fontStyle: 'bold',
      }).setOrigin(1, 0);
      this.addPageText(left + 95, y, desc, {
        fontSize: '11px', color: '#999999',
      });
      y += 20;
    }

    y += 15;
    this.addPageText(cx, y, '─── Upgrades ───', {
      fontSize: '13px', color: '#4169E1',
    }).setOrigin(0.5);

    y += 25;
    const upgradeInfo = [
      'Each level-up lets you pick 1 of 3 upgrades.',
      'Upgrades can be permanent or timed boosts.',
      'Promotions (new tier) unlock stronger upgrades.',
      'After reaching CEO, milestones grant bonus upgrades.',
    ];
    for (const line of upgradeInfo) {
      this.addPageText(left, y, '  ' + line, { fontSize: '11px', color: '#aaaacc' });
      y += 17;
    }

    y += 15;
    this.addPageText(cx, y, 'Win: Survive 10 minutes.   Lose: Stress hits 100%.', {
      fontSize: '13px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);
  }

  // ─── CLOSE ─────────────────────────────────────────────────────

  close() {
    // Mark as seen
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch (_e) {
      // Ignore — private mode or iframe restrictions
    }

    // Clean up keyboard listeners
    this.input.keyboard.off('keydown-LEFT');
    this.input.keyboard.off('keydown-RIGHT');
    this.input.keyboard.off('keydown-A');
    this.input.keyboard.off('keydown-D');
    this.input.keyboard.off('keydown-ESC');
    this.input.keyboard.off('keydown-ENTER');

    if (this.source === 'title') {
      // First-time: close overlay, start the game
      this.scene.stop();
      this.scene.get('TitleScene').scene.start('GameScene');
    } else if (this.source === 'pause') {
      // From pause menu: close overlay, re-show pause overlay
      this.scene.stop();
      const gameScene = this.scene.get('GameScene');
      if (gameScene) {
        gameScene.showPauseOverlay();
      }
    } else {
      // 'title-button': just close, stay on title
      this.scene.stop();
    }
  }
}
