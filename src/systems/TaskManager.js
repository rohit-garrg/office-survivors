import CONFIG from '../config/gameConfig.js';
import { TASKS } from '../config/taskData.js';
import { UPGRADES } from '../config/upgradeData.js';
import { TASK_SPAWN_POINTS, DEPARTMENT_COLORS } from '../config/mapData.js';
import { Task, TASK_STATES } from '../entities/Task.js';
import { randomFrom, weightedRandom, tileToPixel, distance } from '../utils/helpers.js';

/**
 * TaskManager: handles task spawning, tier selection, delivery, and expiry.
 * Manages the task object pool (30 entities).
 */
export class TaskManager {
  constructor(scene) {
    console.log('[TaskManager] initialized');

    /** @type {Phaser.Scene} */
    this.scene = scene;

    /** @type {Task[]} Object pool of Task entities */
    this.taskPool = [];

    /** @type {Task[]} Currently active (spawned on map) tasks */
    this.activeTasks = [];

    /** @type {number} Timestamp of last task spawn */
    this.lastSpawnTime = 0;

    /** @type {number} Current spawn interval in ms */
    this.currentSpawnInterval = CONFIG.TASK_SPAWN_INTERVAL_BASE;

    /** @type {number} Total tasks delivered this game */
    this.tasksDelivered = 0;

    /** @type {Map<string, number>} Delivery count per department (for Departmental Favorite) */
    this.deliveryCounts = new Map();

    /** @type {number} Timestamp of last junk task delivery (for Reply-All chain mechanic) */
    this.lastJunkDeliveryTime = 0;

    /** @type {number} Count of junk tasks delivered in current chain window */
    this.junkChainCount = 0;

    /** @type {Map<string, number>} Hot zone expiry times per department (timestamp) */
    this.hotZones = new Map();
  }

  /** Initialize the task object pool and event listeners */
  init() {
    // Listen for department unblocks to create hot zones
    this._onDeptUnblocked = (data) => {
      this.hotZones.set(data.department, this.scene.time.now + CONFIG.PRESSURE_HOT_ZONE_DURATION);
      console.debug(`[TaskManager] Hot Zone: ${data.department} for ${CONFIG.PRESSURE_HOT_ZONE_DURATION / 1000}s`);
    };
    this.scene.events.on('department-unblocked', this._onDeptUnblocked);

    // Create 30 task entities in the pool
    for (let i = 0; i < 30; i++) {
      const task = new Task(this.scene, -100, -100);
      this.scene.add.existing(task);
      this.scene.physics.add.existing(task);
      task.body.enable = false;
      task.deactivate();
      this.taskPool.push(task);
    }
    console.log('[TaskManager] pool created with 30 tasks');
  }

  /** Per-frame update: check for spawns, expiry, update visuals */
  update(time, delta) {
    // Ramp spawn interval from BASE down to MIN over the game duration
    const elapsed = this.scene.elapsedTime || 0;
    const progress = Math.min(elapsed / CONFIG.GAME_DURATION, 1);
    this.currentSpawnInterval = CONFIG.TASK_SPAWN_INTERVAL_BASE -
      (CONFIG.TASK_SPAWN_INTERVAL_BASE - CONFIG.TASK_SPAWN_INTERVAL_MIN) * progress;

    // Check spawn
    if (time - this.lastSpawnTime >= this.currentSpawnInterval) {
      this.spawnTask(time);
      this.lastSpawnTime = time;
    }

    // Check expiry and update visuals
    this.checkExpiry(time);

    // Update active task visuals (flashing)
    for (const task of this.activeTasks) {
      task.update(time, delta);
    }
  }

  /** Spawn a new task based on current tier and spawn rules */
  spawnTask(currentTime) {
    // Check hard cap
    if (this.activeTasks.length >= CONFIG.TASK_MAX_ON_MAP) {
      console.debug('[TaskManager] max tasks on map, skipping spawn');
      return;
    }

    // Get a task from the pool
    const task = this.getFromPool();
    if (!task) {
      console.debug('[TaskManager] pool exhausted, skipping spawn');
      return;
    }

    // Select spawn point
    const spawnPoint = this.selectSpawnPoint();
    if (!spawnPoint) {
      console.debug('[TaskManager] no spawn point available');
      this.returnToPool(task);
      return;
    }

    // Get current tier for task pool selection
    const tierKey = this.scene.progressionManager
      ? this.scene.progressionManager.getTierKey()
      : 'intern';

    // Select a random task from the tier pool
    const taskData = this.selectTask(tierKey);
    if (!taskData) {
      this.returnToPool(task);
      return;
    }

    // Resolve random department assignment
    let department = taskData.dept;
    let route = taskData.route ? [...taskData.route] : null;

    if (department === 'random') {
      const deptIds = Object.keys(DEPARTMENT_COLORS);
      department = randomFrom(deptIds);
    }

    const pos = tileToPixel(spawnPoint.x, spawnPoint.y, CONFIG.TILE_SIZE);

    task.spawn({
      name: taskData.name,
      department: department,
      route: route,
      stops: taskData.stops,
      x: pos.x,
      y: pos.y,
      spawnTime: currentTime,
      isDecoy: false,
    });

    this.activeTasks.push(task);
    this.scene.events.emit('task-spawned', { task });
  }

  /**
   * Select a task using tier-weighted selection.
   * 60% current tier, 30% one tier below, 10% one tier above.
   * Multi-stop tasks are blocked before Manager tier.
   * @param {string} tierKey - e.g., 'intern', 'associate'
   * @returns {object|null}
   */
  selectTask(tierKey) {
    const tierOrder = CONFIG.TIER_ORDER.map((t) => t.toLowerCase());
    const currentIdx = tierOrder.indexOf(tierKey);
    if (currentIdx === -1) return null;

    // Build weighted tier options
    const candidates = [];
    candidates.push({ item: tierKey, weight: CONFIG.TASK_TIER_WEIGHT_CURRENT });
    if (currentIdx > 0) {
      candidates.push({ item: tierOrder[currentIdx - 1], weight: CONFIG.TASK_TIER_WEIGHT_BELOW });
    }
    if (currentIdx < tierOrder.length - 1) {
      candidates.push({ item: tierOrder[currentIdx + 1], weight: CONFIG.TASK_TIER_WEIGHT_ABOVE });
    }

    // Try up to 10 times to get a valid task (re-roll multi-stop for low tiers)
    const playerLevel = this.scene.progressionManager ? this.scene.progressionManager.level : 1;
    for (let attempt = 0; attempt < 10; attempt++) {
      const selectedTier = weightedRandom(candidates);
      const pool = TASKS[selectedTier];
      if (!pool || pool.length === 0) continue;

      const task = randomFrom(pool);

      // Block multi-stop tasks before Manager tier (level 5+)
      if (task.stops > 1 && playerLevel < 5) {
        continue; // re-roll
      }

      return task;
    }

    // Fallback: grab any single-stop task from current tier
    const pool = TASKS[tierKey];
    if (!pool) return null;
    const singleStops = pool.filter((t) => t.stops === 1);
    return singleStops.length > 0 ? randomFrom(singleStops) : randomFrom(pool);
  }

  /**
   * Pick a random unoccupied spawn point.
   * @returns {{x: number, y: number}|null}
   */
  selectSpawnPoint() {
    // Filter out spawn points that already have a task nearby
    const available = TASK_SPAWN_POINTS.filter((point) => {
      const px = point.x * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;
      const py = point.y * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;
      return !this.activeTasks.some((task) => {
        const dist = distance(px, py, task.x, task.y);
        return dist < CONFIG.TILE_SIZE; // Within 1 tile = occupied
      });
    });

    if (available.length === 0) return null;
    return randomFrom(available);
  }

  /**
   * Handle task delivery when player overlaps a department zone.
   * @param {Task} task
   * @param {string} departmentId
   */
  handleDelivery(task, departmentId) {
    const isMultiStop = task.totalStops > 1;
    const isLastStop = task.currentStop >= task.totalStops - 1;

    task.advanceStop();

    if (task.state === TASK_STATES.DONE) {
      // Fully delivered
      const xp = this.calculateXP(task, departmentId);
      const stressRelief = this.getStressRelief(task, departmentId);
      this.tasksDelivered++;

      // Track per-department delivery count
      const count = this.deliveryCounts.get(departmentId) || 0;
      this.deliveryCounts.set(departmentId, count + 1);

      this.scene.events.emit('task-delivered', {
        task,
        department: departmentId,
        xp,
        stressRelief,
      });

      // Remove from active list and return to pool
      const idx = this.activeTasks.indexOf(task);
      if (idx !== -1) this.activeTasks.splice(idx, 1);
      this.returnToPool(task);

      console.debug(`[TaskManager] delivered: "${task.taskName}" +${xp}XP`);
    } else {
      // Multi-stop: partial delivery. GameScene keeps task in inventory.
      // Track partial delivery for this department too
      const count = this.deliveryCounts.get(departmentId) || 0;
      this.deliveryCounts.set(departmentId, count + 1);
      console.debug(`[TaskManager] partial delivery: "${task.taskName}" stop ${task.currentStop}/${task.totalStops}`);
    }
  }

  /**
   * Calculate XP reward for a delivered task with tier scaling.
   * Single-stop: base 20 + 5 per tier above intern.
   * Multi-2: base 45 + 10 per tier above manager.
   * Multi-3: base 80 + 10 per tier above director.
   * @param {Task} task
   * @param {string} [departmentId] - Department being delivered to (for Dept Favorite bonus)
   * @returns {number}
   */
  calculateXP(task, departmentId) {
    const tierIdx = this.scene.progressionManager
      ? CONFIG.TIER_ORDER.indexOf(this.scene.progressionManager.currentTier)
      : 0;

    let xp;
    if (task.totalStops === 1) {
      xp = CONFIG.TASK_XP_SINGLE_BASE + tierIdx * 5;
    } else if (task.totalStops === 2) {
      // Manager is index 2 in TIER_ORDER
      const bonus = Math.max(0, tierIdx - 2) * 10;
      xp = CONFIG.TASK_XP_MULTI_2_BASE + bonus;
    } else if (task.totalStops === 3) {
      // Director is index 3 in TIER_ORDER
      const bonus = Math.max(0, tierIdx - 3) * 10;
      xp = CONFIG.TASK_XP_MULTI_3_BASE + bonus;
    } else {
      xp = CONFIG.TASK_XP_SINGLE_BASE;
    }

    // Reply-All "junk mail" XP: 50% normally, full XP on chain (2nd+ junk in window)
    if (task.isReplyAll) {
      const hasFilter = this.scene.upgradeManager &&
        this.scene.upgradeManager.isActive('reply_all_filter');
      if (!hasFilter) {
        // Check chain: if 2nd+ junk delivered within chain window, give full XP
        const now = this.scene.time.now;
        if (now - this.lastJunkDeliveryTime <= CONFIG.REPLYALL_CHAIN_WINDOW && this.junkChainCount >= 1) {
          xp = Math.round(xp * CONFIG.REPLYALL_CHAIN_XP_MULT);
          console.debug(`[TaskManager] Reply-All chain bonus! Full XP (chain #${this.junkChainCount + 1})`);
        } else {
          xp = Math.round(xp * CONFIG.REPLYALL_TASK_XP_MULT);
        }
        // Update chain tracking
        if (now - this.lastJunkDeliveryTime <= CONFIG.REPLYALL_CHAIN_WINDOW) {
          this.junkChainCount++;
        } else {
          this.junkChainCount = 1;
        }
        this.lastJunkDeliveryTime = now;
      }
    }

    // Apply XP multiplier from upgrades (LinkedIn Thought Leader: 2x for 60s)
    if (this.scene.upgradeManager && this.scene.upgradeManager.isActive('linkedin_thought_leader')) {
      const upgrade = UPGRADES.find((u) => u.id === 'linkedin_thought_leader');
      xp = Math.round(xp * upgrade.apply.value);
    }

    // Departmental Favorite: 2x XP on favorite dept deliveries
    if (departmentId && this.scene.upgradeManager &&
        this.scene.upgradeManager.isActive('departmental_favorite') &&
        this.scene.upgradeManager.favoriteDeptId === departmentId) {
      xp = Math.round(xp * CONFIG.DEPT_FAVORITE_XP_MULT);
    }

    // Post-CEO milestone XP multiplier (stacks per milestone)
    if (this.scene.progressionManager && this.scene.progressionManager.milestoneXPMultiplier > 0) {
      xp = Math.round(xp * this.scene.progressionManager.getMilestoneXPMultiplier());
    }

    // Pressure bonus: risk-reward XP bonuses
    const pressureResult = this.calculatePressureBonus(departmentId);
    if (pressureResult.multiplier > 1) {
      xp = Math.round(xp * pressureResult.multiplier);
    }

    return xp;
  }

  /**
   * Calculate pressure bonus multiplier based on agent proximity, stress, and hot zones.
   * @param {string} departmentId
   * @returns {{multiplier: number, reasons: string[]}}
   */
  calculatePressureBonus(departmentId) {
    let bonus = 0;
    const reasons = [];
    const player = this.scene.player;

    // Agent within 128px during delivery
    if (player && this.scene.waveManager) {
      const agents = this.scene.waveManager.getAllActiveAgents();
      for (const agent of agents) {
        const dist = distance(player.x, player.y, agent.x, agent.y);
        if (dist <= CONFIG.PRESSURE_AGENT_RANGE) {
          bonus += CONFIG.PRESSURE_AGENT_XP_BONUS;
          reasons.push('UNDER PRESSURE');
          break; // Only count once
        }
      }
    }

    // Stress above threshold during delivery
    if (this.scene.stressManager && this.scene.stressManager.currentStress >= CONFIG.PRESSURE_STRESS_THRESHOLD) {
      bonus += CONFIG.PRESSURE_STRESS_XP_BONUS;
      reasons.push('CLUTCH DELIVERY');
    }

    // Hot zone: recently unblocked department
    if (departmentId) {
      const expiry = this.hotZones.get(departmentId);
      if (expiry && this.scene.time.now < expiry) {
        bonus += CONFIG.PRESSURE_HOT_ZONE_XP_BONUS;
        reasons.push('HOT ZONE');
      }
    }

    // Cap total multiplier
    const multiplier = Math.min(1 + bonus, CONFIG.PRESSURE_MAX_MULTIPLIER);

    if (reasons.length > 0) {
      this.scene.events.emit('pressure-bonus', { multiplier, reasons });
      console.debug(`[TaskManager] Pressure bonus: ${multiplier.toFixed(2)}x (${reasons.join(', ')})`);
    }

    return { multiplier, reasons };
  }

  /**
   * Get the most-delivered-to department ID.
   * @returns {string|null}
   */
  getMostDeliveredDept() {
    let maxDept = null;
    let maxCount = 0;
    for (const [dept, count] of this.deliveryCounts) {
      if (count > maxCount) {
        maxCount = count;
        maxDept = dept;
      }
    }
    return maxDept;
  }

  /**
   * Get the second-most-delivered-to department (excludes a given dept).
   * Used to force Corner Office and Dept Favorite onto different departments.
   * @param {string} excludeDept - Department to exclude
   * @returns {string|null}
   */
  getSecondMostDeliveredDept(excludeDept) {
    let maxDept = null;
    let maxCount = 0;
    for (const [dept, count] of this.deliveryCounts) {
      if (dept === excludeDept) continue;
      if (count > maxCount) {
        maxCount = count;
        maxDept = dept;
      }
    }
    return maxDept;
  }

  /**
   * Get stress relief amount for a delivered task.
   * @param {Task} task
   * @param {string} [departmentId] - Department being delivered to (for Dept Favorite bonus)
   * @returns {number}
   */
  getStressRelief(task, departmentId) {
    let relief;
    if (task.totalStops === 1) relief = CONFIG.TASK_RELIEF_SINGLE;
    else if (task.totalStops === 2) relief = CONFIG.TASK_RELIEF_MULTI_2;
    else if (task.totalStops === 3) relief = CONFIG.TASK_RELIEF_MULTI_3;
    else relief = CONFIG.TASK_RELIEF_SINGLE;

    // Departmental Favorite: 2x stress relief on favorite dept deliveries
    if (departmentId && this.scene.upgradeManager &&
        this.scene.upgradeManager.isActive('departmental_favorite') &&
        this.scene.upgradeManager.favoriteDeptId === departmentId) {
      relief = Math.round(relief * CONFIG.DEPT_FAVORITE_RELIEF_MULT);
    }

    return relief;
  }

  /** Check all active tasks for expiry */
  checkExpiry(currentTime) {
    const expired = [];
    for (const task of this.activeTasks) {
      if (task.isExpired(currentTime)) {
        expired.push(task);
      }
    }

    for (const task of expired) {
      const stressPenalty = task.isReplyAll
        ? CONFIG.REPLYALL_TASK_EXPIRY_STRESS
        : CONFIG.TASK_EXPIRY_STRESS;
      console.debug(`[TaskManager] expired: "${task.taskName}" (stress: ${stressPenalty}%)`);
      this.scene.events.emit('task-expired', {
        task,
        stressPenalty,
      });

      const idx = this.activeTasks.indexOf(task);
      if (idx !== -1) this.activeTasks.splice(idx, 1);
      this.returnToPool(task);
    }
  }

  /**
   * Get an inactive task from the pool.
   * @returns {Task|null}
   */
  getFromPool() {
    for (const task of this.taskPool) {
      if (task.state === TASK_STATES.IDLE) {
        return task;
      }
    }
    return null;
  }

  /** Return a task to the pool */
  returnToPool(task) {
    task.deactivate();
  }

  /** Get count of active tasks on map (SPAWNED state only) */
  getActiveCount() {
    return this.activeTasks.length;
  }

  /** Get all active tasks (for stress calculation) */
  getActiveTasks() {
    return this.activeTasks;
  }

  /** Clean up */
  destroy() {
    this.activeTasks = [];
    this.taskPool = [];
    this.hotZones.clear();
    if (this._onDeptUnblocked) {
      this.scene.events.off('department-unblocked', this._onDeptUnblocked);
    }
  }
}
