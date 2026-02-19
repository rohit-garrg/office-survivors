import CONFIG from '../config/gameConfig.js';
import { DEPARTMENT_COLORS, DEPARTMENT_ABBREV } from '../config/mapData.js';
import { formatTime, hexToInt } from '../utils/helpers.js';

/**
 * HUD: manages all in-game HUD elements.
 *
 * Full-width top bar (960x34px) with five sections left to right:
 * Level/XP | Stamina | Tasks | Stress | Timer
 * Task list rows extend below the bar with text stroke for readability.
 */
export class HUD {
  constructor(scene) {
    console.log('[HUD] initialized');
    /** @type {Phaser.Scene} Reference to UIScene */
    this.scene = scene;

    /** @type {Array} Active upgrade icon elements */
    this.upgradeIcons = [];

    /** @type {Array<{bg: Phaser.GameObjects.Rectangle, label: Phaser.GameObjects.Text}>} Task badges in top bar */
    this.taskBadges = [];

    /** @type {Map<string, Phaser.GameObjects.Text>} Active department-blocked indicators */
    this.blockedIndicators = new Map();

    /** @type {Array<{dot: Phaser.GameObjects.Arc, text: Phaser.GameObjects.Text}>} Bottom strip task route rows (multi-stop only) */
    this.taskStripRows = [];
  }

  /** Create all HUD elements */
  create() {
    // === FULL-WIDTH TOP BAR ===
    this.topBar = this.scene.add.rectangle(0, 0, CONFIG.CANVAS_WIDTH, 34, 0x000000, 0.55)
      .setOrigin(0, 0).setScrollFactor(0).setDepth(199);

    // === LEVEL / XP SECTION (x=8) ===
    this.levelText = this.scene.add.text(8, 6, 'Lvl 1: Intern', {
      fontSize: '13px',
      fontFamily: 'monospace',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setScrollFactor(0).setDepth(200);

    this.xpBarBg = this.scene.add.rectangle(8, 22, 100, 8, 0x555555)
      .setOrigin(0, 0).setScrollFactor(0).setDepth(200);
    this.xpBarFill = this.scene.add.rectangle(8, 22, 0, 8, 0x4169E1)
      .setOrigin(0, 0).setScrollFactor(0).setDepth(201);
    this.xpText = this.scene.add.text(113, 22, `0/${CONFIG.XP_PER_LEVEL[0]}`, {
      fontSize: '10px',
      fontFamily: 'monospace',
      color: '#cccccc',
    }).setScrollFactor(0).setDepth(200);

    // === STAMINA SECTION (x=190) ===
    this.staminaLabel = this.scene.add.text(190, 6, 'STAMINA', {
      fontSize: '11px',
      fontFamily: 'monospace',
      color: '#aaaaaa',
    }).setScrollFactor(0).setDepth(200);
    this.staminaBarBg = this.scene.add.rectangle(248, 8, 100, 10, 0x555555)
      .setOrigin(0, 0).setScrollFactor(0).setDepth(200);
    this.staminaBarFill = this.scene.add.rectangle(248, 8, 100, 10, 0x22cc44)
      .setOrigin(0, 0).setScrollFactor(0).setDepth(201);

    // === TASKS SECTION (x=380) ===
    this.taskCountText = this.scene.add.text(380, 6, `Tasks: 0/${CONFIG.PLAYER_TASK_CAPACITY}`, {
      fontSize: '11px',
      fontFamily: 'monospace',
      color: '#aaaaaa',
    }).setScrollFactor(0).setDepth(200);

    // Task badges in top bar row 2 (compact colored rectangles with dept abbreviation)
    this.taskBadges = [];
    const badgeY = 20;
    const badgeStartX = 380;
    for (let i = 0; i < CONFIG.HUD_MAX_TASK_SLOTS; i++) {
      const bx = badgeStartX + i * (CONFIG.HUD_BADGE_WIDTH + CONFIG.HUD_BADGE_GAP);
      const bg = this.scene.add.rectangle(bx, badgeY, CONFIG.HUD_BADGE_WIDTH, CONFIG.HUD_BADGE_HEIGHT, 0x555555, 0.85)
        .setOrigin(0, 0).setScrollFactor(0).setDepth(201).setVisible(false);
      const label = this.scene.add.text(bx + CONFIG.HUD_BADGE_WIDTH / 2, badgeY + 1, '', {
        fontSize: '9px',
        fontFamily: 'monospace',
        color: '#ffffff',
        fontStyle: 'bold',
      }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(202).setVisible(false);
      this.taskBadges.push({ bg, label });
    }

    // === STRESS SECTION (right-aligned, 385px from right edge) ===
    const stressX = CONFIG.CANVAS_WIDTH - 385;
    this.stressLabel = this.scene.add.text(stressX, 5, 'STRESS', {
      fontSize: '11px',
      fontFamily: 'monospace',
      color: '#cccccc',
      fontStyle: 'bold',
    }).setScrollFactor(0).setDepth(200);

    this.stressBarBg = this.scene.add.rectangle(stressX + 45, 5, 130, 14, 0x555555)
      .setOrigin(0, 0).setScrollFactor(0).setDepth(200);
    this.stressBarFill = this.scene.add.rectangle(stressX + 45, 5, 0, 14, 0x44aa44)
      .setOrigin(0, 0).setScrollFactor(0).setDepth(201);
    this.stressText = this.scene.add.text(stressX + 180, 5, '0%', {
      fontSize: '12px',
      fontFamily: 'monospace',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0, 0).setScrollFactor(0).setDepth(202);

    // Stress warning text (row 2, below label)
    this.stressWarningText = this.scene.add.text(stressX, 22, '', {
      fontSize: '9px',
      fontFamily: 'monospace',
      color: '#ff8800',
      fontStyle: 'italic',
    }).setScrollFactor(0).setDepth(200).setVisible(false);

    // === TIMER SECTION (right-aligned, 90px from right edge) ===
    const timerX = CONFIG.CANVAS_WIDTH - 90;
    this.timerBg = this.scene.add.rectangle(timerX, 3, 80, 28, 0x1a1a2e, 0.9)
      .setOrigin(0, 0).setScrollFactor(0).setDepth(200);
    this.timerText = this.scene.add.text(timerX + 40, 7, formatTime(CONFIG.GAME_DURATION), {
      fontSize: '18px',
      fontFamily: 'monospace',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(201);

    // === BOTTOM TASK STRIP (full task names) ===
    this.taskStripBg = this.scene.add.rectangle(80, CONFIG.CANVAS_HEIGHT, CONFIG.CANVAS_WIDTH - 160, 0, 0x000000, 0.5)
      .setOrigin(0, 1).setScrollFactor(0).setDepth(199).setVisible(false);

    this.taskStripRows = [];
    for (let i = 0; i < CONFIG.HUD_MAX_TASK_SLOTS; i++) {
      const dot = this.scene.add.circle(0, 0, 4, 0x555555)
        .setScrollFactor(0).setDepth(201).setVisible(false);
      const text = this.scene.add.text(0, 0, '', {
        fontSize: '13px',
        fontFamily: 'monospace',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 2,
      }).setScrollFactor(0).setDepth(201).setVisible(false);
      this.taskStripRows.push({ dot, text });
    }
  }

  /** Update stress bar display */
  updateStress(percent) {
    const fillWidth = (percent / 100) * 130;
    this.stressBarFill.width = fillWidth;
    this.stressText.setText(`${Math.floor(percent)}%`);

    // Color based on thresholds
    if (percent >= CONFIG.STRESS_VISUAL_RED) {
      this.stressBarFill.setFillStyle(0xff2222);
    } else if (percent >= CONFIG.STRESS_VISUAL_ORANGE) {
      this.stressBarFill.setFillStyle(0xff8800);
    } else if (percent >= CONFIG.STRESS_VISUAL_YELLOW) {
      this.stressBarFill.setFillStyle(0xddcc00);
    } else {
      this.stressBarFill.setFillStyle(0x44aa44);
    }

    // Stress warning text
    if (percent >= CONFIG.STRESS_VISUAL_RED) {
      this.stressWarningText.setText('HR is preparing paperwork...');
      this.stressWarningText.setColor('#ff4444');
      this.stressWarningText.setVisible(true);
    } else if (percent >= CONFIG.STRESS_VISUAL_ORANGE) {
      this.stressWarningText.setText('Your boss is watching...');
      this.stressWarningText.setColor('#ff8800');
      this.stressWarningText.setVisible(true);
    } else {
      this.stressWarningText.setVisible(false);
    }
  }

  /** Update XP bar display */
  updateXP(current, needed) {
    const ratio = needed > 0 ? Math.min(current / needed, 1) : 0;
    this.xpBarFill.width = ratio * 100;
    this.xpText.setText(`${current}/${needed}`);
  }

  /** Update timer display */
  updateTimer(remaining) {
    this.timerText.setText(formatTime(remaining));

    if (remaining <= CONFIG.TIMER_WARNING_RED) {
      this.timerText.setColor('#ff4444');
    } else if (remaining <= CONFIG.TIMER_WARNING_ORANGE) {
      this.timerText.setColor('#ffaa00');
    } else {
      this.timerText.setColor('#ffffff');
    }
  }

  /**
   * Update task badges and bottom strip with carried tasks.
   * @param {Array} tasks - Player's inventory
   */
  updateTasks(tasks) {
    const capacity = this.scene.scene.get('GameScene')?.player?.taskCapacity
      || CONFIG.PLAYER_TASK_CAPACITY;
    this.taskCountText.setText(`Tasks: ${tasks.length}/${capacity}`);

    // === TOP BAR BADGES: compact colored dept abbreviation ===
    for (let i = 0; i < this.taskBadges.length; i++) {
      const badge = this.taskBadges[i];
      if (i < tasks.length) {
        const task = tasks[i];
        const deptId = task.getCurrentDepartment();
        const colorHex = DEPARTMENT_COLORS[deptId];
        const color = colorHex ? hexToInt(colorHex) : 0x888888;
        const abbrev = DEPARTMENT_ABBREV[deptId] || '???';

        badge.bg.setFillStyle(color, 0.85).setVisible(true);
        badge.label.setText(abbrev).setVisible(true);
      } else {
        badge.bg.setVisible(false);
        badge.label.setVisible(false);
      }
    }

    // === BOTTOM TASK STRIP: show ALL carried tasks (name + destination) ===
    const stripX = 90;
    const stripBottom = 536;
    const rowHeight = 18;

    for (let i = 0; i < this.taskStripRows.length; i++) {
      const stripRow = this.taskStripRows[i];
      if (i < tasks.length) {
        const task = tasks[i];
        const deptId = task.getCurrentDepartment();
        const colorHex = DEPARTMENT_COLORS[deptId];
        const color = colorHex ? hexToInt(colorHex) : 0x888888;

        const rowY = stripBottom - (tasks.length - i) * rowHeight;
        stripRow.dot.setPosition(stripX, rowY + 7).setFillStyle(color).setVisible(true);

        let displayText;
        if (task.totalStops > 1 && task.route) {
          // Multi-stop: "Task Name | ENG > ✓MKT > FIN"
          const routePart = task.route.map((dept, idx) => {
            const abbrev = DEPARTMENT_ABBREV[dept] || dept;
            if (idx < task.currentStop) return `\u2713${abbrev}`;
            return abbrev;
          }).join(' > ');
          displayText = `${task.taskName} | ${routePart}`;
        } else {
          // Single-stop: "Task Name -> MKT"
          const abbrev = DEPARTMENT_ABBREV[deptId] || deptId;
          displayText = `${task.taskName} -> ${abbrev}`;
        }

        if (displayText.length > CONFIG.TASK_STRIP_MAX_NAME_LENGTH) {
          displayText = displayText.substring(0, CONFIG.TASK_STRIP_MAX_NAME_LENGTH - 3) + '...';
        }
        stripRow.text.setPosition(stripX + 14, rowY).setText(displayText).setVisible(true);
      } else {
        stripRow.dot.setVisible(false);
        stripRow.text.setVisible(false);
      }
    }

    // Show/resize background for bottom strip
    if (tasks.length > 0) {
      const panelHeight = tasks.length * rowHeight + 8;
      this.taskStripBg.setSize(CONFIG.CANVAS_WIDTH - 160, panelHeight).setVisible(true);
    } else {
      this.taskStripBg.setVisible(false);
    }
  }

  /** Update stamina bar */
  updateStamina(current, max) {
    const ratio = max > 0 ? current / max : 0;
    this.staminaBarFill.width = ratio * 100;

    // Change color when low
    if (ratio <= CONFIG.STAMINA_LOW_THRESHOLD) {
      this.staminaBarFill.setFillStyle(0xff4444);
    } else if (ratio <= CONFIG.STAMINA_WARN_THRESHOLD) {
      this.staminaBarFill.setFillStyle(0xddcc00);
    } else {
      this.staminaBarFill.setFillStyle(0x22cc44);
    }
  }

  /** Update level and title display */
  updateLevel(level, tierName) {
    const display = tierName.charAt(0) + tierName.slice(1).toLowerCase();
    this.levelText.setText(`Lvl ${level}: ${display}`);
  }

  /**
   * Update active upgrade indicators below the task list rows.
   * @param {Array} activeUpgrades - from UpgradeManager.getActiveUpgradesList()
   */
  updateUpgrades(activeUpgrades) {
    // Clean up previous icons
    for (const icon of this.upgradeIcons) {
      icon.destroy();
    }
    this.upgradeIcons = [];

    if (!activeUpgrades || activeUpgrades.length === 0) return;

    const startY = 38;

    for (let i = 0; i < activeUpgrades.length; i++) {
      const upgrade = activeUpgrades[i];
      const x = 380 + i * 50;

      // Small colored indicator
      const color = upgrade.charges !== null ? 0xFFD700 : 0x4169E1;
      const bg = this.scene.add.rectangle(x, startY, 46, 14, color, 0.6)
        .setOrigin(0, 0).setScrollFactor(0).setDepth(200);
      this.upgradeIcons.push(bg);

      // Label: either charges or time remaining
      let label;
      if (upgrade.charges !== null) {
        label = `x${upgrade.charges}`;
      } else if (upgrade.remaining !== null) {
        const secs = Math.ceil(upgrade.remaining / 1000);
        label = `${secs}s`;
      } else {
        label = '';
      }

      const text = this.scene.add.text(x + 23, startY + 1, label, {
        fontSize: '9px',
        fontFamily: 'monospace',
        color: '#ffffff',
      }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(201);
      this.upgradeIcons.push(text);
    }
  }

  /**
   * Update task capacity display (Extra Hands upgrade).
   * Capacity is read dynamically in updateTasks().
   * @param {number} newCapacity
   */
  updateTaskCapacity(newCapacity) {
    // Capacity is read dynamically in updateTasks() — nothing else needed here
  }

  /**
   * Show a department-blocked indicator in the HUD.
   * Displays a small colored tag below the stress section.
   * @param {string} deptId
   */
  showDeptBlocked(deptId) {
    console.debug(`[HUD] department blocked: ${deptId}`);

    // Don't duplicate
    if (this.blockedIndicators.has(deptId)) return;

    const colorHex = DEPARTMENT_COLORS[deptId];
    const color = colorHex ? hexToInt(colorHex) : 0x888888;
    const deptName = deptId.charAt(0) + deptId.slice(1).toLowerCase();

    // Position below the stress section, stacking for multiple blocks
    const baseX = CONFIG.CANVAS_WIDTH - 385;
    const baseY = 38;
    const offsetY = this.blockedIndicators.size * 18;

    const container = this.scene.add.container(baseX, baseY + offsetY).setScrollFactor(0).setDepth(200);

    const bg = this.scene.add.rectangle(0, 0, 120, 16, color, 0.3)
      .setOrigin(0, 0).setStrokeStyle(1, color);
    const text = this.scene.add.text(4, 1, `X ${deptName} BLOCKED`, {
      fontSize: '10px',
      fontFamily: 'monospace',
      color: '#ff4444',
      fontStyle: 'bold',
    });

    container.add([bg, text]);
    this.blockedIndicators.set(deptId, container);
  }

  /**
   * Hide a department-blocked indicator.
   * @param {string} deptId
   */
  hideDeptBlocked(deptId) {
    console.debug(`[HUD] department unblocked: ${deptId}`);

    const indicator = this.blockedIndicators.get(deptId);
    if (indicator) {
      indicator.destroy();
      this.blockedIndicators.delete(deptId);

      // Reposition remaining indicators to close gaps
      let idx = 0;
      const baseX = CONFIG.CANVAS_WIDTH - 385;
      const baseY = 38;
      for (const [, container] of this.blockedIndicators) {
        container.setPosition(baseX, baseY + idx * 18);
        idx++;
      }
    }
  }

  /** Clean up HUD elements */
  destroy() {
    // Phaser cleans up scene children automatically
  }
}
