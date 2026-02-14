import CONFIG from '../config/gameConfig.js';
import { DEPARTMENT_COLORS } from '../config/mapData.js';
import { formatTime, hexToInt } from '../utils/helpers.js';

/**
 * HUD: manages all in-game HUD elements.
 *
 * Top-left: Level + Title, XP bar, task indicators, stamina bar, upgrade icons.
 * Top-right: Stress meter with %, countdown timer.
 * Bottom-center: Multi-stop route display (when carrying multi-stop task).
 */
export class HUD {
  constructor(scene) {
    console.log('[HUD] initialized');
    /** @type {Phaser.Scene} Reference to UIScene */
    this.scene = scene;

    /** @type {Array} Active upgrade icon elements */
    this.upgradeIcons = [];

    /** @type {Array<Phaser.GameObjects.Text>} Task info strip lines (max 4) */
    this.taskInfoTexts = [];

    /** @type {Map<string, Phaser.GameObjects.Text>} Active department-blocked indicators */
    this.blockedIndicators = new Map();
  }

  /** Create all HUD elements */
  create() {
    const pad = 8;

    // === TOP LEFT PANEL ===
    this.leftPanel = this.scene.add.rectangle(0, 0, 200, 100, 0x000000, 0.6)
      .setOrigin(0, 0).setScrollFactor(0).setDepth(199);

    // Level + Title
    this.levelText = this.scene.add.text(pad, pad, 'Lvl 1: Intern', {
      fontSize: '13px',
      fontFamily: 'monospace',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setScrollFactor(0).setDepth(200);

    // XP Bar background
    this.xpBarBg = this.scene.add.rectangle(pad, pad + 18, 140, 10, 0x555555)
      .setOrigin(0, 0).setScrollFactor(0).setDepth(200);
    // XP Bar fill
    this.xpBarFill = this.scene.add.rectangle(pad, pad + 18, 0, 10, 0x4169E1)
      .setOrigin(0, 0).setScrollFactor(0).setDepth(201);
    // XP Text
    this.xpText = this.scene.add.text(pad + 145, pad + 18, `0/${CONFIG.XP_PER_LEVEL[0]}`, {
      fontSize: '10px',
      fontFamily: 'monospace',
      color: '#cccccc',
    }).setScrollFactor(0).setDepth(200);

    // Carried task indicators (start with base capacity, can grow)
    this.taskSlots = [];
    this.createTaskSlots(CONFIG.PLAYER_TASK_CAPACITY);

    // Stamina bar
    this.staminaLabel = this.scene.add.text(pad, pad + 58, 'STA', {
      fontSize: '11px',
      fontFamily: 'monospace',
      color: '#aaaaaa',
    }).setScrollFactor(0).setDepth(200);
    this.staminaBarBg = this.scene.add.rectangle(pad + 30, pad + 58, 100, 10, 0x555555)
      .setOrigin(0, 0).setScrollFactor(0).setDepth(200);
    this.staminaBarFill = this.scene.add.rectangle(pad + 30, pad + 58, 100, 10, 0x22cc44)
      .setOrigin(0, 0).setScrollFactor(0).setDepth(201);

    // === TOP RIGHT PANEL ===
    const rightX = CONFIG.CANVAS_WIDTH;
    this.rightPanel = this.scene.add.rectangle(rightX - 200, 0, 200, 90, 0x000000, 0.6)
      .setOrigin(0, 0).setScrollFactor(0).setDepth(199);

    const rPad = rightX - 192; // inner left edge of right panel

    // Stress bar
    this.stressLabel = this.scene.add.text(rPad, pad, 'STRESS', {
      fontSize: '11px',
      fontFamily: 'monospace',
      color: '#cccccc',
      fontStyle: 'bold',
    }).setScrollFactor(0).setDepth(200);

    this.stressBarBg = this.scene.add.rectangle(rPad, pad + 16, 150, 14, 0x555555)
      .setOrigin(0, 0).setScrollFactor(0).setDepth(200);
    this.stressBarFill = this.scene.add.rectangle(rPad, pad + 16, 0, 14, 0x44aa44)
      .setOrigin(0, 0).setScrollFactor(0).setDepth(201);
    this.stressText = this.scene.add.text(rPad + 155, pad + 16, '0%', {
      fontSize: '12px',
      fontFamily: 'monospace',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0, 0).setScrollFactor(0).setDepth(202);

    // Stress warning text (below stress bar)
    this.stressWarningText = this.scene.add.text(rPad, pad + 32, '', {
      fontSize: '9px',
      fontFamily: 'monospace',
      color: '#ff8800',
      fontStyle: 'italic',
    }).setScrollFactor(0).setDepth(200).setVisible(false);

    // Timer
    this.timerBg = this.scene.add.rectangle(rPad + 50, pad + 44, 70, 28, 0x1a1a2e, 0.9)
      .setOrigin(0, 0).setScrollFactor(0).setDepth(200);
    this.timerText = this.scene.add.text(rPad + 85, pad + 48, formatTime(CONFIG.GAME_DURATION), {
      fontSize: '18px',
      fontFamily: 'monospace',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(201);

    // === BOTTOM CENTER: Task info strip (shows all carried tasks with names + destinations) ===
    this.taskInfoTexts = [];
    const maxSlots = CONFIG.HUD_MAX_TASK_SLOTS;
    for (let i = 0; i < maxSlots; i++) {
      const textObj = this.scene.add.text(CONFIG.CANVAS_WIDTH / 2, 0, '', {
        fontSize: '13px',
        fontFamily: 'monospace',
        color: '#ffffff',
        backgroundColor: '#000000aa',
        padding: { left: 8, right: 8, top: 2, bottom: 2 },
      }).setOrigin(0.5).setScrollFactor(0).setDepth(200).setVisible(false);
      this.taskInfoTexts.push(textObj);
    }
  }

  /**
   * Create task slot indicators.
   * @param {number} count
   */
  createTaskSlots(count) {
    const pad = 8;
    // Destroy existing
    for (const slot of this.taskSlots) {
      slot.destroy();
    }
    this.taskSlots = [];

    for (let i = 0; i < count; i++) {
      const slot = this.scene.add.rectangle(
        pad + i * 22, pad + 34, 18, 18, 0x555555, 0.4
      ).setOrigin(0, 0).setScrollFactor(0).setDepth(200);
      slot.setStrokeStyle(1, 0x888888);
      this.taskSlots.push(slot);
    }

    // Update task label position
    if (this.taskLabel) this.taskLabel.destroy();
    this.taskLabel = this.scene.add.text(pad + count * 22 + 4, pad + 36, 'Tasks', {
      fontSize: '11px',
      fontFamily: 'monospace',
      color: '#aaaaaa',
    }).setScrollFactor(0).setDepth(200);
  }

  /** Update stress bar display */
  updateStress(percent) {
    const fillWidth = (percent / 100) * 150;
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
    this.xpBarFill.width = ratio * 140;
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
   * Update carried task indicators, including multi-stop badge and route display.
   * @param {Array} tasks - Player's inventory
   */
  updateTasks(tasks) {
    // Update slot colors
    for (let i = 0; i < this.taskSlots.length; i++) {
      if (i < tasks.length) {
        const deptId = tasks[i].getCurrentDepartment();
        const colorHex = DEPARTMENT_COLORS[deptId];
        const color = colorHex ? hexToInt(colorHex) : 0x888888;
        this.taskSlots[i].setFillStyle(color, 1);

        // Multi-stop badge: show remaining stops via stroke thickness
        if (tasks[i].totalStops > 1) {
          const remaining = tasks[i].totalStops - tasks[i].currentStop;
          this.taskSlots[i].setStrokeStyle(remaining > 1 ? 3 : 2, 0xffffff);
        } else {
          this.taskSlots[i].setStrokeStyle(1, 0x888888);
        }
      } else {
        this.taskSlots[i].setFillStyle(0x333333, 0.3);
        this.taskSlots[i].setStrokeStyle(1, 0x888888);
      }
    }

    // Update task info strip at bottom of screen
    this.updateTaskStrip(tasks);
  }

  /**
   * Show task info strip at bottom of screen for all carried tasks.
   * Each line: "Task Name" → [CurrentDept] → NextDept
   * @param {Array} tasks - Player's inventory
   */
  updateTaskStrip(tasks) {
    const bottomY = CONFIG.CANVAS_HEIGHT - 20;
    const lineHeight = 20;

    // Hide all lines first
    for (const textObj of this.taskInfoTexts) {
      textObj.setVisible(false);
    }

    if (tasks.length === 0) return;

    // Max characters that fit on the 960px canvas at 13px monospace (~7.8px/char)
    // with 16px padding on the text element = ~120 usable chars.
    // We cap the FULL LINE (name + route), not just the name, to prevent overflow.
    const maxLineChars = 110;

    // Build a line for each carried task (bottom-up stacking)
    for (let i = 0; i < tasks.length && i < this.taskInfoTexts.length; i++) {
      const task = tasks[i];

      let name = task.taskName || 'Task';

      // Build route string
      let route;
      if (task.totalStops > 1 && task.route) {
        // Multi-stop: show route with completed/current/future stops
        const parts = task.route.map((dept, idx) => {
          const deptName = dept.charAt(0) + dept.slice(1).toLowerCase();
          if (idx < task.currentStop) {
            return `\u2713${deptName}`;  // ✓ checkmark for completed stops
          } else if (idx === task.currentStop) {
            return `[${deptName}]`;
          }
          return deptName;
        });
        route = parts.join(' \u2192 ');
      } else {
        // Single-stop: just show destination in brackets
        const dept = task.getCurrentDepartment();
        const deptName = dept ? dept.charAt(0) + dept.slice(1).toLowerCase() : '???';
        route = `[${deptName}]`;
      }

      // Build full line, then truncate the NAME portion only if the full line exceeds canvas
      const overhead = `"" \u2192 ${route}`.length; // chars used by quotes, arrow, route
      const availableForName = maxLineChars - overhead;
      if (name.length > availableForName && availableForName > 3) {
        name = name.substring(0, availableForName - 3) + '...';
      }

      const line = `"${name}" \u2192 ${route}`;

      // Position: stack upward from bottom
      const y = bottomY - (tasks.length - 1 - i) * lineHeight;
      this.taskInfoTexts[i].setText(line);
      this.taskInfoTexts[i].setY(y);
      this.taskInfoTexts[i].setVisible(true);
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
    // Capitalize first letter of tier
    const display = tierName.charAt(0) + tierName.slice(1).toLowerCase();
    this.levelText.setText(`Lvl ${level}: ${display}`);
  }

  /**
   * Update active upgrade indicators below the stamina bar.
   * Shows small icons for timed upgrades with remaining duration.
   * @param {Array} activeUpgrades - from UpgradeManager.getActiveUpgradesList()
   */
  updateUpgrades(activeUpgrades) {
    // Clean up previous icons
    for (const icon of this.upgradeIcons) {
      icon.destroy();
    }
    this.upgradeIcons = [];

    if (!activeUpgrades || activeUpgrades.length === 0) return;

    const pad = 8;
    const startY = pad + 76;

    for (let i = 0; i < activeUpgrades.length; i++) {
      const upgrade = activeUpgrades[i];
      const x = pad + i * 50;

      // Small colored indicator
      const color = upgrade.charges !== null ? 0xFFD700 : 0x4169E1;
      const bg = this.scene.add.rectangle(x, startY, 46, 14, color, 0.6)
        .setOrigin(0, 0).setScrollFactor(0).setDepth(200);
      this.upgradeIcons.push(bg);

      // Label: either time remaining or charges
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
   * Add task slots when capacity increases (Extra Hands upgrade).
   * @param {number} newCapacity
   */
  addTaskSlots(newCapacity) {
    this.createTaskSlots(newCapacity);
  }

  /**
   * Show a department-blocked indicator in the HUD.
   * Displays a small colored tag below the timer.
   * @param {string} deptId
   */
  showDeptBlocked(deptId) {
    console.debug(`[HUD] department blocked: ${deptId}`);

    // Don't duplicate
    if (this.blockedIndicators.has(deptId)) return;

    const colorHex = DEPARTMENT_COLORS[deptId];
    const color = colorHex ? hexToInt(colorHex) : 0x888888;
    const deptName = deptId.charAt(0) + deptId.slice(1).toLowerCase();

    // Position below the right panel, stacking for multiple blocks
    const rightX = CONFIG.CANVAS_WIDTH - 192;
    const baseY = 96; // below the right panel (90px tall)
    const offsetY = this.blockedIndicators.size * 18;

    const container = this.scene.add.container(rightX, baseY + offsetY).setScrollFactor(0).setDepth(200);

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
      const rightX = CONFIG.CANVAS_WIDTH - 192;
      const baseY = 96;
      for (const [, container] of this.blockedIndicators) {
        container.setPosition(rightX, baseY + idx * 18);
        idx++;
      }
    }
  }

  /** Clean up HUD elements */
  destroy() {
    // Phaser cleans up scene children automatically
  }
}
