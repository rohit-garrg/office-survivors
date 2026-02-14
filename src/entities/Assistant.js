import Phaser from 'phaser';
import { TASK_STATES } from './Task.js';
import { DEPARTMENTS } from '../config/mapData.js';
import CONFIG from '../config/gameConfig.js';

/**
 * Assistant states:
 * WANDER    — Random movement, waiting for delivery timer
 * FETCHING  — Moving toward a SPAWNED task on the map
 * DELIVERING — Carrying a task, following waypoints to the department door
 */
const ASSISTANT_STATES = {
  WANDER: 'WANDER',
  FETCHING: 'FETCHING',
  DELIVERING: 'DELIVERING',
};

// All assistant tuning constants now live in gameConfig.js:
// ASSISTANT_PICKUP_RANGE, ASSISTANT_WAYPOINT_RANGE,
// ASSISTANT_FETCH_TIMEOUT, ASSISTANT_DELIVER_TIMEOUT, ASSISTANT_SEEK_DELAY

/**
 * Pre-computed door waypoints for each department.
 * Each has an "approach" point (in the open corridor near the door)
 * and an "entry" point (just inside the zone past the door).
 *
 * Calculated from ROOM_WALLS door gaps in mapData.js:
 *   Left depts (CEO, Marketing, Engineering): door on right wall at x=7
 *   Right depts (Finance, HR): door on left wall at x=32
 */
const DEPT_DOOR_WAYPOINTS = (() => {
  const ts = CONFIG.TILE_SIZE;
  const half = ts / 2;
  return {
    CEO: {
      // Door gap at tiles (7, 3-4). Approach from east, enter west.
      approach: { x: 9 * ts + half, y: 3 * ts + ts },   // (304, 128)
      entry:    { x: 5 * ts + half, y: 3 * ts + ts },    // (176, 128)
    },
    MARKETING: {
      // Door gap at tiles (7, 9-10)
      approach: { x: 9 * ts + half, y: 9 * ts + ts },    // (304, 320)
      entry:    { x: 5 * ts + half, y: 9 * ts + ts },     // (176, 320)
    },
    ENGINEERING: {
      // Door gap at tiles (7, 19-20)
      approach: { x: 9 * ts + half, y: 19 * ts + ts },   // (304, 640)
      entry:    { x: 5 * ts + half, y: 19 * ts + ts },    // (176, 640)
    },
    FINANCE: {
      // Door gap at tiles (32, 9-10). Approach from west, enter east.
      approach: { x: 30 * ts + half, y: 9 * ts + ts },   // (976, 320)
      entry:    { x: 34 * ts + half, y: 9 * ts + ts },    // (1104, 320)
    },
    HR: {
      // Door gap at tiles (32, 19-20)
      approach: { x: 30 * ts + half, y: 19 * ts + ts },  // (976, 640)
      entry:    { x: 34 * ts + half, y: 19 * ts + ts },   // (1104, 640)
    },
  };
})();

/**
 * NPC Assistant: spawned by the Strategic Delegation upgrade.
 * Walks to a task on the map, picks it up, navigates through the department
 * door, and delivers it. Repeats on a timer.
 */
export class Assistant extends Phaser.GameObjects.Sprite {
  constructor(scene, x, y) {
    const texture = scene.textures.exists('agent-assistant') ? 'agent-assistant' : 'assistant';
    super(scene, x, y, texture, 0);
    console.log('[Assistant] initialized');

    /** @type {string|null} Animation prefix for walk/idle */
    this._animPrefix = scene.textures.exists('agent-assistant') ? 'assistant' : null;

    /** @type {string} Current facing direction */
    this._facing = 'south';

    /** @type {number} Interval in ms between delivery cycles */
    this.deliveryInterval = CONFIG.ASSISTANT_DELIVERY_INTERVAL;

    /** @type {number} Time accumulator for delivery timer */
    this._deliveryTimer = 0;

    /** @type {boolean} Whether assistant is active */
    this.isActive = false;


    /** @type {string} Current behavior state */
    this._state = ASSISTANT_STATES.WANDER;

    /** @type {{x: number, y: number}|null} Current wander target */
    this._wanderTarget = null;

    /** @type {number} Movement speed (px/sec) */
    this._speed = CONFIG.ASSISTANT_SPEED;

    /** @type {import('./Task.js').Task|null} Task being fetched or carried */
    this._targetTask = null;

    /** @type {string|null} Department ID we're delivering to */
    this._deliveryDeptId = null;

    /** @type {Array<{x: number, y: number}>} Waypoints to follow for delivery */
    this._waypoints = [];

    /** @type {number} Current waypoint index */
    this._waypointIdx = 0;

    /** @type {number} Time spent in current action state (for timeout) */
    this._actionTimer = 0;

    /** @type {number} Stuck detection timer (ms) */
    this._stuckTimer = 0;

    /** @type {{x: number, y: number}} Last position for stuck detection */
    this._lastPos = { x: 0, y: 0 };
  }

  /**
   * Activate the assistant at a position.
   * @param {number} x
   * @param {number} y
   */
  activate(x, y) {
    this.setPosition(x, y);
    this.setActive(true);
    this.setVisible(true);
    this.setDepth(9);
    this.isActive = true;
    this._deliveryTimer = 0;
    this._state = ASSISTANT_STATES.WANDER;
    this._targetTask = null;
    this._deliveryDeptId = null;
    this._waypoints = [];
    this._waypointIdx = 0;
    this._actionTimer = 0;
    this._stuckTimer = 0;
    this._lastPos = { x, y };

    // Set body offset for 32x32 sprite
    if (this.body) {
      this.body.setSize(20, 20);
      this.body.setOffset(6, 10);
    }

    // Play initial idle animation
    this._facing = 'south';
    this.updateAssistantAnimation(0, 0);

    this.pickNewWanderTarget();
  }

  /** Deactivate the assistant */
  deactivate() {
    this.isActive = false;
    this._state = ASSISTANT_STATES.WANDER;
    this._targetTask = null;
    this._deliveryDeptId = null;
    this._waypoints = [];
    this.setActive(false);
    this.setVisible(false);
    if (this.body) this.body.setVelocity(0, 0);
  }

  /** Main update: state machine drives behavior */
  update(time, delta) {
    if (!this.isActive) return;

    // Stuck detection: if barely moved, try to break free
    this._stuckTimer += delta;
    if (this._stuckTimer >= CONFIG.ASSISTANT_STUCK_CHECK_INTERVAL) {
      const moved = Phaser.Math.Distance.Between(
        this.x, this.y, this._lastPos.x, this._lastPos.y
      );
      if (moved < CONFIG.ASSISTANT_STUCK_MOVE_THRESHOLD) {
        this.handleStuck();
      }
      this._lastPos = { x: this.x, y: this.y };
      this._stuckTimer = 0;
    }

    switch (this._state) {
      case ASSISTANT_STATES.WANDER:
        this.updateWander(delta);
        break;
      case ASSISTANT_STATES.FETCHING:
        this.updateFetching(delta);
        break;
      case ASSISTANT_STATES.DELIVERING:
        this.updateDelivering(delta);
        break;
    }
  }

  // ──────────────────────────────────────────
  // WANDER STATE
  // ──────────────────────────────────────────

  /** Wander randomly and accumulate the delivery timer */
  updateWander(delta) {
    this.moveToward(this._wanderTarget);

    if (this._wanderTarget) {
      const dist = Phaser.Math.Distance.Between(
        this.x, this.y, this._wanderTarget.x, this._wanderTarget.y
      );
      if (dist < CONFIG.ASSISTANT_WANDER_ARRIVAL_RANGE) {
        this.pickNewWanderTarget();
      }
    }

    // Seek a new task every 5 seconds while wandering
    this._deliveryTimer += delta;
    if (this._deliveryTimer >= CONFIG.ASSISTANT_SEEK_DELAY) {
      this._deliveryTimer = 0;
      this.seekTask();
    }
  }

  /** Pick a random walkable point on the open floor area */
  pickNewWanderTarget() {
    const mapW = CONFIG.MAP_WIDTH_TILES * CONFIG.TILE_SIZE;
    const mapH = CONFIG.MAP_HEIGHT_TILES * CONFIG.TILE_SIZE;
    const margin = CONFIG.TILE_SIZE * 3;
    this._wanderTarget = {
      x: margin + Math.random() * (mapW - margin * 2),
      y: margin + Math.random() * (mapH - margin * 2),
    };
  }

  // ──────────────────────────────────────────
  // FETCHING STATE
  // ──────────────────────────────────────────

  /**
   * Find the nearest SPAWNED task on the map and start moving toward it.
   * Prefers single-stop tasks. Skips decoys.
   */
  seekTask() {
    const taskManager = this.scene.taskManager;
    if (!taskManager) return;

    const activeTasks = taskManager.getActiveTasks();

    let bestTask = null;
    let bestDist = Infinity;
    let bestIsSingle = false;

    for (const task of activeTasks) {
      if (task.state !== TASK_STATES.SPAWNED) continue;
      if (task.isDecoy) continue;

      const dist = Phaser.Math.Distance.Between(this.x, this.y, task.x, task.y);
      const isSingle = task.totalStops === 1;

      // Prefer single-stop; among same type pick nearest
      if ((!bestTask) ||
          (isSingle && !bestIsSingle) ||
          (isSingle === bestIsSingle && dist < bestDist)) {
        bestTask = task;
        bestDist = dist;
        bestIsSingle = isSingle;
      }
    }

    if (bestTask) {
      this._targetTask = bestTask;
      this._state = ASSISTANT_STATES.FETCHING;
      this._actionTimer = 0;
      console.debug(`[Assistant] seeking task: "${bestTask.taskName}" (${Math.round(bestDist)}px away)`);
    } else {
      console.debug('[Assistant] no tasks on map to fetch');
    }
  }

  /** Move toward the target task; pick it up when close enough */
  updateFetching(delta) {
    const task = this._targetTask;

    // Timeout — give up and try again later
    this._actionTimer += delta;
    if (this._actionTimer >= CONFIG.ASSISTANT_FETCH_TIMEOUT) {
      console.debug('[Assistant] fetch timeout, returning to wander');
      this.resetToWander();
      return;
    }

    // If the task was picked up by the player or expired, abort
    if (!task || task.state !== TASK_STATES.SPAWNED) {
      console.debug('[Assistant] target task gone, returning to wander');
      this.resetToWander();
      return;
    }

    this.moveToward({ x: task.x, y: task.y });

    const dist = Phaser.Math.Distance.Between(this.x, this.y, task.x, task.y);
    if (dist <= CONFIG.ASSISTANT_PICKUP_RANGE) {
      this.pickUpTask();
    }
  }

  /** Pick up the target task and plan waypoints to the department door */
  pickUpTask() {
    const task = this._targetTask;
    const taskManager = this.scene.taskManager;
    if (!task || !taskManager) {
      this.resetToWander();
      return;
    }

    // Capture department BEFORE any state mutation
    let deptId;
    if (task.route && task.route.length > 0) {
      // For multi-stop: NPC delivers to the LAST department (completes all stops)
      deptId = task.route[task.route.length - 1];
    } else {
      deptId = task.department;
    }
    this._deliveryDeptId = deptId;

    // Remove from active tasks on map
    const idx = taskManager.activeTasks.indexOf(task);
    if (idx !== -1) taskManager.activeTasks.splice(idx, 1);

    // Hide the task sprite (still held by reference for delivery)
    task.setVisible(false);
    task.setActive(false);
    if (task.body) task.body.enable = false;

    // Build waypoints through the department door
    const doorWP = DEPT_DOOR_WAYPOINTS[deptId];
    if (doorWP) {
      this._waypoints = [
        { x: doorWP.approach.x, y: doorWP.approach.y },
        { x: doorWP.entry.x, y: doorWP.entry.y },
      ];
    } else {
      // Unknown department — fallback to zone center
      const dept = DEPARTMENTS.find((d) => d.id === deptId);
      if (dept) {
        const ts = CONFIG.TILE_SIZE;
        this._waypoints = [{
          x: dept.position.x * ts + (dept.size.width * ts) / 2,
          y: dept.position.y * ts + (dept.size.height * ts) / 2,
        }];
      } else {
        console.warn(`[Assistant] unknown department "${deptId}", force-delivering`);
        this.completeDelivery();
        return;
      }
    }
    this._waypointIdx = 0;
    this._actionTimer = 0;
    this._state = ASSISTANT_STATES.DELIVERING;

    console.debug(`[Assistant] picked up "${task.taskName}", delivering to ${deptId} (${this._waypoints.length} waypoints)`);
  }

  // ──────────────────────────────────────────
  // DELIVERING STATE
  // ──────────────────────────────────────────

  /** Follow waypoints toward the department; deliver when final waypoint reached */
  updateDelivering(delta) {
    if (!this._targetTask || this._waypoints.length === 0) {
      this.resetToWander();
      return;
    }

    // Timeout — force-complete delivery to prevent infinite stuck
    this._actionTimer += delta;
    if (this._actionTimer >= CONFIG.ASSISTANT_DELIVER_TIMEOUT) {
      console.debug('[Assistant] delivery timeout, force-completing');
      this.completeDelivery();
      return;
    }

    const wp = this._waypoints[this._waypointIdx];
    this.moveToward(wp);

    const dist = Phaser.Math.Distance.Between(this.x, this.y, wp.x, wp.y);
    if (dist <= CONFIG.ASSISTANT_WAYPOINT_RANGE) {
      this._waypointIdx++;
      if (this._waypointIdx >= this._waypoints.length) {
        // Reached final waypoint (inside department) — deliver
        this.completeDelivery();
      }
    }
  }

  /**
   * Complete the delivery: award XP, relieve stress, emit event, return task to pool.
   */
  completeDelivery() {
    const task = this._targetTask;
    const taskManager = this.scene.taskManager;
    const deptId = this._deliveryDeptId;

    if (!task || !taskManager) {
      this.resetToWander();
      return;
    }

    const taskName = task.taskName;

    // Calculate rewards BEFORE mutating task state
    const xp = taskManager.calculateXP(task, deptId);
    const stressRelief = taskManager.getStressRelief(task, deptId);
    taskManager.tasksDelivered++;

    // Track per-department delivery count
    const count = taskManager.deliveryCounts.get(deptId) || 0;
    taskManager.deliveryCounts.set(deptId, count + 1);

    // Mark as fully done
    task.currentStop = task.totalStops;
    task.state = TASK_STATES.DONE;

    // Emit delivery event
    this.scene.events.emit('task-delivered', {
      task,
      department: deptId,
      xp,
      stressRelief,
    });

    // Return to pool
    task.deactivate();

    console.log(`[Assistant] delivered "${taskName}" to ${deptId} +${xp}XP -${stressRelief}%stress`);

    this.resetToWander();
  }

  // ──────────────────────────────────────────
  // MOVEMENT
  // ──────────────────────────────────────────

  /**
   * Set velocity toward a target point.
   * @param {{x: number, y: number}|null} target
   */
  moveToward(target) {
    if (!target || !this.body) return;

    const angle = Phaser.Math.Angle.Between(
      this.x, this.y, target.x, target.y
    );
    const vx = Math.cos(angle) * this._speed;
    const vy = Math.sin(angle) * this._speed;
    this.body.setVelocity(vx, vy);
    this.updateAssistantAnimation(vx, vy);
  }

  // ──────────────────────────────────────────
  // STUCK HANDLING
  // ──────────────────────────────────────────

  /** When stuck against a wall, nudge in a random direction */
  handleStuck() {
    if (this._state === ASSISTANT_STATES.WANDER) {
      this.pickNewWanderTarget();
    } else {
      // Random nudge to break free from walls
      const nudgeAngle = Math.random() * Math.PI * 2;
      if (this.body) {
        this.body.setVelocity(
          Math.cos(nudgeAngle) * this._speed * 1.5,
          Math.sin(nudgeAngle) * this._speed * 1.5
        );
      }
    }
  }

  // ──────────────────────────────────────────
  // RESET
  // ──────────────────────────────────────────

  /** Return to wander state and clear all held references */
  resetToWander() {
    this._targetTask = null;
    this._deliveryDeptId = null;
    this._waypoints = [];
    this._waypointIdx = 0;
    this._actionTimer = 0;
    this._state = ASSISTANT_STATES.WANDER;
    this.pickNewWanderTarget();
  }

  // ──────────────────────────────────────────
  // ANIMATION
  // ──────────────────────────────────────────

  /**
   * Update walk/idle animation based on velocity.
   * @param {number} vx
   * @param {number} vy
   */
  updateAssistantAnimation(vx, vy) {
    if (!this._animPrefix) return;

    const isMoving = Math.abs(vx) > 0.1 || Math.abs(vy) > 0.1;

    if (isMoving) {
      if (Math.abs(vx) > Math.abs(vy)) {
        this._facing = vx > 0 ? 'east' : 'west';
      } else {
        this._facing = vy > 0 ? 'south' : 'north';
      }
    }

    const animKey = isMoving
      ? `${this._animPrefix}-walk-${this._facing}`
      : `${this._animPrefix}-idle-${this._facing}`;

    if (this.anims.currentAnim?.key !== animKey && this.scene.anims.exists(animKey)) {
      this.play(animKey, true);
    }
  }
}
