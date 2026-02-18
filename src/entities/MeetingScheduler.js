import { ChaosAgent } from './ChaosAgent.js';
import CONFIG from '../config/gameConfig.js';
import { DEPARTMENTS } from '../config/mapData.js';
import { randomFrom, tileToPixel } from '../utils/helpers.js';
import { TASK_STATES } from '../entities/Task.js';

/**
 * The Meeting Scheduler: blocks department deliveries.
 *
 * - Walks to a random department zone
 * - Places "IN A MEETING" sign, blocking deliveries for 12s
 * - Never blocks the same department twice in a row
 * - Cooldown of 20s between blocks
 * - Soft-lock prevention: if player carries tasks ONLY for blocked depts,
 *   show "Knock Knock" prompt; Space key forces delivery at 50% XP
 */
export class MeetingScheduler extends ChaosAgent {
  constructor(scene, x, y) {
    const texture = scene.textures.exists('agent-meeting') ? 'agent-meeting' : 'agent_meetingscheduler';
    super(scene, x, y, texture, 'meeting_scheduler');
    this.animPrefix = scene.textures.exists('agent-meeting') ? 'meeting' : null;
    this.speed = CONFIG.MEETING_SCHEDULER_SPEED;

    // Education properties
    this.displayName = 'Meeting Sched.';
    this.description = 'Blocks departments for 12s. Look for IN A MEETING signs.';
    this.speechLines = [
      'Let me book a room...',
      'Sync-up time!',
      'Quick 30-min align?',
      'Blocking the calendar...',
      'This needs a meeting.',
      'Mandatory attendance.',
    ];

    /** @type {string|null} Last department that was blocked */
    this.lastBlockedDept = null;

    /** @type {Set<string>} Currently blocked department IDs */
    this.blockedDepts = new Set();

    /** @type {boolean} Whether on cooldown between blocks */
    this._onCooldown = false;

    /** @type {number} Cooldown time remaining */
    this._cooldownTimer = 0;

    /** @type {string|null} Department we're walking to */
    this._targetDept = null;

    /** @type {Map<string, {overlay: Phaser.GameObjects.Text, timer: Phaser.Time.TimerEvent}>} Visual overlays */
    this._blockVisuals = new Map();

    /** @type {Phaser.GameObjects.Text|null} "Knock Knock" prompt */
    this._knockPrompt = null;

    /** @type {Function|null} Space key handler reference */
    this._spaceHandler = null;

    // Enrage: 2 min after spawn — can block 2 departments simultaneously
    this.enrageTime = CONFIG.ENRAGE_MEETING_TIME;

    /** @type {number} Max simultaneous blocks (increases on enrage) */
    this.maxSimultaneousBlocks = 1;
  }

  /** Escalate stats on enrage */
  onEnrage() {
    this.maxSimultaneousBlocks = CONFIG.ENRAGE_MEETING_MAX_BLOCKS;
    console.debug('[MeetingScheduler] enraged: can block 2 departments simultaneously');
  }

  /** Walk to department, block it, move to next */
  update(time, delta) {
    if (!this.isActive) return;

    // Handle cooldown
    if (this._onCooldown) {
      this._cooldownTimer -= delta;
      if (this._cooldownTimer <= 0) {
        this._onCooldown = false;
      }
      // Idle during cooldown
      if (this.body) this.body.setVelocity(0, 0);
      this.updateEducationVisuals(delta);
      return;
    }

    // If no target department, pick one
    if (!this._targetDept && !this.target) {
      this.pickNextDepartment();
    }

    super.update(time, delta);

    // Check for soft-lock condition
    this.checkSoftLock();

    // Keep knock prompt following the player
    if (this._knockPrompt && this.scene.player) {
      this._knockPrompt.setPosition(this.scene.player.x, this.scene.player.y - 30);
    }
  }

  /** When stuck navigating to a department, pick a different one */
  onStuck() {
    console.debug('[MeetingScheduler] stuck, picking new department');
    this._targetDept = null;
    this.pickNextDepartment();
  }

  /** Called when arriving at target department */
  onArrived() {
    this.target = null;

    if (this._targetDept) {
      this.blockDepartment(this._targetDept);
      this._targetDept = null;
    }
  }

  /** Pick a random department that isn't the last one blocked and isn't currently blocked */
  pickNextDepartment() {
    const available = DEPARTMENTS.filter((dept) => {
      // Never same dept twice in a row
      if (dept.id === this.lastBlockedDept) return false;
      // Don't target already-blocked departments
      if (this.blockedDepts.has(dept.id)) return false;
      // CEO can't be locked out of their own office
      if (dept.id === 'CEO' && this.scene.progressionManager &&
          this.scene.progressionManager.currentTier === 'CEO') {
        return false;
      }
      return true;
    });

    if (available.length === 0) {
      // All departments blocked or only the last-blocked one available
      // Idle until a block expires
      console.debug('[MeetingScheduler] no valid departments, idling');
      this._onCooldown = true;
      this._cooldownTimer = CONFIG.MEETING_IDLE_CHECK_INTERVAL;
      return;
    }

    const dept = randomFrom(available);
    this._targetDept = dept.id;

    // Walk to the center of the department zone (through its door)
    const doorTarget = this.getDepartmentDoorPosition(dept);
    this.setTarget(doorTarget.x, doorTarget.y);

    console.debug(`[MeetingScheduler] walking to ${dept.id}`);
  }

  /**
   * Get a position near the department door (so agent walks through the door, not through walls).
   * @param {object} dept - Department from DEPARTMENTS
   * @returns {{x: number, y: number}} Pixel position near door
   */
  getDepartmentDoorPosition(dept) {
    const ts = CONFIG.TILE_SIZE;
    const centerX = (dept.position.x + dept.size.width / 2) * ts;
    const centerY = (dept.position.y + dept.size.height / 2) * ts;

    // Left-side departments (CEO, Marketing, Engineering): door is on right side at x=7
    if (dept.position.x < 16) {
      return { x: 7 * ts + ts / 2, y: centerY };
    }
    // Right-side departments (Finance, HR): door is on left side at x=32
    return { x: 32 * ts + ts / 2, y: centerY };
  }

  /**
   * Block the target department for MEETING_BLOCK_DURATION.
   * @param {string} departmentId
   */
  blockDepartment(departmentId) {
    // Meeting Blocker upgrade: halve block duration
    let blockDuration = CONFIG.MEETING_BLOCK_DURATION;
    if (this.scene.upgradeManager && this.scene.upgradeManager.isActive('meeting_blocker')) {
      blockDuration *= CONFIG.MEETING_BLOCKER_DURATION_MULT;
    }

    this.blockedDepts.add(departmentId);
    this.lastBlockedDept = departmentId;

    // Show "IN A MEETING" overlay on the department zone
    this.showBlockOverlay(departmentId);

    // Emit blocked event
    this.scene.events.emit('department-blocked', {
      department: departmentId,
      duration: blockDuration,
    });

    // Add instant stress
    if (this.scene.stressManager) {
      this.scene.stressManager.addInstantStress(CONFIG.STRESS_MEETING_BLOCK, 'meeting-block');
    }

    this.scene.events.emit('agent-disruption', {
      type: 'meeting_scheduler',
      effect: 'department_blocked',
      position: { x: this.x, y: this.y },
    });

    console.debug(`[MeetingScheduler] blocked ${departmentId} for ${blockDuration}ms`);

    // Floating text near agent to visually connect it to the distant "IN A MEETING" overlay
    const deptLabel = departmentId.charAt(0) + departmentId.slice(1).toLowerCase();
    const floatText = this.scene.add.text(this.x, this.y - 20, `Blocking ${deptLabel}!`, {
      fontSize: '11px',
      fontFamily: 'monospace',
      color: '#ff4444',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(25);

    this.scene.tweens.add({
      targets: floatText,
      y: floatText.y - 30,
      alpha: 0,
      duration: 2000,
      ease: 'Power2',
      onComplete: () => floatText.destroy(),
    });

    // Schedule unblock
    const timerEvent = this.scene.time.delayedCall(blockDuration, () => {
      this.unblockDepartment(departmentId);
    });

    // Store visual reference for cleanup
    const entry = this._blockVisuals.get(departmentId);
    if (entry) entry.timer = timerEvent;

    // Start cooldown after blocking
    // When enraged and fewer than max blocks active, use short cooldown to quickly block another dept
    const canBlockMore = this.isEnraged && this.blockedDepts.size < this.maxSimultaneousBlocks;
    this._onCooldown = true;
    this._cooldownTimer = canBlockMore ? 2000 : CONFIG.MEETING_COOLDOWN;
  }

  /**
   * Unblock a department after duration expires.
   * @param {string} departmentId
   */
  unblockDepartment(departmentId) {
    this.blockedDepts.delete(departmentId);

    // Remove visual overlay
    this.removeBlockOverlay(departmentId);

    // Emit unblocked event
    this.scene.events.emit('department-unblocked', {
      department: departmentId,
    });

    console.debug(`[MeetingScheduler] unblocked ${departmentId}`);
  }

  /**
   * Check if department is currently blocked.
   * @param {string} departmentId
   * @returns {boolean}
   */
  isDeptBlocked(departmentId) {
    return this.blockedDepts.has(departmentId);
  }

  /** Show "IN A MEETING" text overlay on a department zone */
  showBlockOverlay(departmentId) {
    const dept = DEPARTMENTS.find((d) => d.id === departmentId);
    if (!dept) return;

    const ts = CONFIG.TILE_SIZE;
    const cx = (dept.position.x + dept.size.width / 2) * ts;
    const cy = (dept.position.y + dept.size.height / 2) * ts;

    // Dim overlay with striped pattern
    const dimRect = this.scene.add.rectangle(
      cx, cy,
      dept.size.width * ts, dept.size.height * ts,
      0x000000, 0.45
    ).setDepth(15);

    // Sign background (like a door sign)
    const signW = 140;
    const signH = 36;
    const signBg = this.scene.add.rectangle(cx, cy, signW, signH, 0x880000, 0.9)
      .setStrokeStyle(2, 0xff4444)
      .setDepth(16);

    // "IN A MEETING" text
    const meetingText = this.scene.add.text(cx, cy, 'IN A MEETING', {
      fontSize: '12px',
      fontFamily: 'monospace',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(17);

    this._blockVisuals.set(departmentId, { overlay: dimRect, signBg, text: meetingText, timer: null });
  }

  /** Remove "IN A MEETING" overlay from a department */
  removeBlockOverlay(departmentId) {
    const entry = this._blockVisuals.get(departmentId);
    if (entry) {
      if (entry.overlay) entry.overlay.destroy();
      if (entry.signBg) entry.signBg.destroy();
      if (entry.text) entry.text.destroy();
      this._blockVisuals.delete(departmentId);
    }
  }

  /**
   * Soft-lock prevention: if player carries tasks ONLY for blocked departments,
   * show "Knock Knock" prompt. Space forces delivery at reduced XP.
   */
  checkSoftLock() {
    const player = this.scene.player;
    if (!player || player.inventory.length === 0) {
      this.hideKnockPrompt();
      return;
    }

    // Check if ALL carried tasks target blocked departments
    const allBlocked = player.inventory.every((task) => {
      const dept = task.getCurrentDepartment();
      return this.blockedDepts.has(dept);
    });

    if (allBlocked && this.blockedDepts.size > 0) {
      this.showKnockPrompt();
    } else {
      this.hideKnockPrompt();
    }
  }

  /** Show "Knock Knock" prompt (Space to force delivery) */
  showKnockPrompt() {
    if (this._knockPrompt) return; // Already showing

    const player = this.scene.player;
    this._knockPrompt = this.scene.add.text(
      player.x, player.y - 30,
      'Knock Knock [SPACE] (50% XP)',
      {
        fontSize: '11px',
        fontFamily: 'monospace',
        color: '#ffaa00',
        stroke: '#000000',
        strokeThickness: 2,
      }
    ).setOrigin(0.5).setDepth(25);

    // Register Space key handler
    if (!this._spaceHandler) {
      this._spaceHandler = () => this.forceDelivery();
      this.scene.input.keyboard.on('keydown-SPACE', this._spaceHandler);
    }
  }

  /** Hide the "Knock Knock" prompt */
  hideKnockPrompt() {
    if (this._knockPrompt) {
      this._knockPrompt.destroy();
      this._knockPrompt = null;
    }
    if (this._spaceHandler) {
      this.scene.input.keyboard.off('keydown-SPACE', this._spaceHandler);
      this._spaceHandler = null;
    }
  }

  /** Force-deliver a task through a blocked department at 50% XP */
  forceDelivery() {
    const player = this.scene.player;
    if (!player || player.inventory.length === 0) return;

    // Find first task targeting a blocked department
    const index = player.inventory.findIndex((task) =>
      this.blockedDepts.has(task.getCurrentDepartment())
    );
    if (index === -1) return;

    const task = player.inventory.splice(index, 1)[0];
    const dept = task.getCurrentDepartment();

    // Calculate reduced XP (Meeting Blocker upgrade gives 75% instead of 50%)
    let xpMult = 0.5;
    if (this.scene.upgradeManager && this.scene.upgradeManager.isActive('meeting_blocker')) {
      xpMult = CONFIG.MEETING_BLOCKER_BLOCKED_XP_MULT;
    }

    // Complete the task
    task.currentStop = task.totalStops;
    task.state = TASK_STATES.DONE;

    const fullXP = this.scene.taskManager.calculateXP(task, dept);
    const xp = Math.round(fullXP * xpMult);
    const stressRelief = this.scene.taskManager.getStressRelief(task, dept);

    this.scene.taskManager.tasksDelivered++;

    this.scene.events.emit('task-delivered', {
      task,
      department: dept,
      xp,
      stressRelief,
    });

    // Return to pool
    const poolIdx = this.scene.taskManager.activeTasks.indexOf(task);
    if (poolIdx !== -1) this.scene.taskManager.activeTasks.splice(poolIdx, 1);
    task.deactivate();

    this.hideKnockPrompt();
    console.debug(`[MeetingScheduler] force delivery through blocked ${dept} at ${Math.round(xpMult * 100)}% XP`);
  }

  /** Clean up on deactivation */
  deactivate() {
    // Unblock all departments
    for (const dept of [...this.blockedDepts]) {
      this.unblockDepartment(dept);
    }
    this.hideKnockPrompt();
    super.deactivate();
  }
}
