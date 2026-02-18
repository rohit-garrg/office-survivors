import { UPGRADES } from '../config/upgradeData.js';
import { DEPARTMENTS } from '../config/mapData.js';
import { randomFrom } from '../utils/helpers.js';
import CONFIG from '../config/gameConfig.js';
import { TASK_STATES } from '../entities/Task.js';

/**
 * UpgradeManager: manages the upgrade pool, active effects, and durations.
 *
 * Filters available upgrades by player level (tier gating).
 * Tracks active timed upgrades and handles expiry.
 * Applies upgrade effects to game systems.
 */
export class UpgradeManager {
  constructor(scene) {
    console.log('[UpgradeManager] initialized');

    /** @type {Phaser.Scene} */
    this.scene = scene;

    /** @type {Array<{id: string, expiresAt: number}>} Currently active timed upgrades */
    this.activeTimedUpgrades = [];

    /** @type {Set<string>} IDs of permanently applied upgrades */
    this.permanentUpgrades = new Set();

    /** @type {Map<string, number>} Remaining charges for limited-use upgrades */
    this.chargesRemaining = new Map();

    /** @type {Set<string>} All upgrade IDs that have been granted (to avoid duplicates) */
    this.grantedUpgrades = new Set();

    /** @type {string|null} Department expanded by Corner Office */
    this.cornerOfficeDept = null;

    /** @type {string|null} Department chosen by Departmental Favorite */
    this.favoriteDeptId = null;

    /** @type {number} Fast Tracker charges remaining */
    this.fastTrackerCharges = 0;

    /** @type {boolean} Whether task navigation arrows should be shown (Reply-All Filter) */
    this.taskNavigationActive = false;

    /** @type {boolean} Whether Executive Presence slow is currently active */
    this.executivePresenceActive = false;

    /** @type {Phaser.Time.TimerEvent|null} EP slow expiry timer */
    this._epTimer = null;

    /** @type {Set<string>} Agent types that spawned since last level-up (for smart offers) */
    this._newAgentsSinceLevelUp = new Set();
  }

  /** Initialize and register event listeners */
  init() {
    this._onUpgradeSelected = (data) => {
      this.applyUpgrade(data.upgrade.id);
    };
    this.scene.events.on('upgrade-selected', this._onUpgradeSelected);

    // Track new agent spawns for smart upgrade offers
    this._onAgentSpawned = (data) => {
      if (data && data.type) {
        this._newAgentsSinceLevelUp.add(data.type);
      }
    };
    this.scene.events.on('agent-spawned', this._onAgentSpawned);
  }

  /** Per-frame update: check timed upgrade expiry */
  update(time, delta) {
    const expired = [];
    for (const entry of this.activeTimedUpgrades) {
      entry.remaining -= delta;
      if (entry.remaining <= 0) {
        expired.push(entry);
      }
    }

    for (const entry of expired) {
      this.expireUpgrade(entry.id);
    }
  }

  /**
   * Get 3 random upgrade options filtered by player level.
   * Excludes already-granted permanent/instant upgrades.
   * @param {number} playerLevel
   * @returns {Array}
   */
  getUpgradeOptions(playerLevel) {
    // Filter upgrades by level gate
    let available = UPGRADES.filter((u) => playerLevel >= u.availableFrom);

    // Exclude already-granted permanent upgrades
    // Timed upgrades can be re-offered (timer refreshes)
    // Inbox Zero is instant but one-shot per game
    available = available.filter((u) => {
      if (u.duration === 'permanent' && this.grantedUpgrades.has(u.id)) return false;
      if (u.duration === 'instant' && this.grantedUpgrades.has(u.id)) return false;
      return true;
    });

    // Reactive agent-gating: anti-agent upgrades only appear after their target agent has spawned
    const waveManager = this.scene.waveManager;
    if (waveManager) {
      available = available.filter((u) => {
        // requiresAgent: specific agent type must have spawned
        if (u.requiresAgent) {
          const hasSpawned = waveManager.spawnedTypes.has(u.requiresAgent);
          // Fallback: if player is 2+ levels past the agent's levelGate, offer anyway
          if (!hasSpawned) {
            const agentConfig = waveManager.getAgentConfig(u.requiresAgent);
            if (agentConfig && playerLevel >= agentConfig.levelGate + 3
                && (this.scene.elapsedTime || 0) >= agentConfig.timeGate) return true;
            return false;
          }
        }
        // requiresAgentCount: N agent types must have spawned
        if (u.requiresAgentCount) {
          if (waveManager.spawnedTypes.size < u.requiresAgentCount) return false;
        }
        return true;
      });
    }

    // Smart offers: if a new agent spawned since last level-up, guarantee one anti-agent upgrade
    let guaranteed = null;
    if (this._newAgentsSinceLevelUp.size > 0) {
      const antiAgentOptions = available.filter((u) =>
        u.category === 'anti_agent' &&
        (u.requiresAgent && this._newAgentsSinceLevelUp.has(u.requiresAgent))
      );
      if (antiAgentOptions.length > 0) {
        guaranteed = antiAgentOptions[Math.floor(Math.random() * antiAgentOptions.length)];
      }
    }
    this._newAgentsSinceLevelUp.clear();

    // Shuffle and pick up to 3
    const shuffled = [...available].sort(() => Math.random() - 0.5);
    let picks = shuffled.slice(0, 3);

    // Ensure guaranteed upgrade is in the picks (replace last slot if needed)
    if (guaranteed && !picks.find((u) => u.id === guaranteed.id)) {
      picks[picks.length - 1] = guaranteed;
    }

    return picks;
  }

  /**
   * Apply a selected upgrade by ID.
   * @param {string} upgradeId
   */
  applyUpgrade(upgradeId) {
    const upgrade = UPGRADES.find((u) => u.id === upgradeId);
    if (!upgrade) {
      console.warn(`[UpgradeManager] unknown upgrade: ${upgradeId}`);
      return;
    }

    console.log(`[UpgradeManager] applying: ${upgrade.name}`);
    this.grantedUpgrades.add(upgradeId);

    const player = this.scene.player;
    const apply = upgrade.apply;

    switch (apply.type) {
      case 'speed_boost':
        // Coffee IV Drip: +20% speed (permanent)
        player.setSpeedModifier('coffee_iv_drip', 1 + apply.value);
        this.permanentUpgrades.add(upgradeId);
        break;

      case 'carry_capacity':
        // Extra Hands: +1 capacity (permanent)
        player.taskCapacity += apply.value;
        this.permanentUpgrades.add(upgradeId);
        this.scene.events.emit('upgrade-capacity-changed', { capacity: player.taskCapacity });
        break;

      case 'speed_reader':
        // Speed Reader: +40% pickup radius AND +40% delivery zone size (permanent)
        player.pickupRadius = Math.round(player.pickupRadius * (1 + apply.pickupBoost));
        this.permanentUpgrades.add(upgradeId);
        // Expand ALL department zones
        for (const dept of DEPARTMENTS) {
          this.expandDepartmentZone(dept.id, apply.deliveryZoneBoost);
        }
        console.debug(`[UpgradeManager] Speed Reader: expanded all dept zones by ${apply.deliveryZoneBoost}x`);
        break;

      case 'water_cooler_boost':
        // Deep Breaths: halve water cooler cooldown (permanent)
        this.permanentUpgrades.add(upgradeId);
        console.debug('[UpgradeManager] Deep Breaths: water cooler cooldown halved');
        break;

      case 'stress_decay':
        // Stress Ball: permanent passive stress decay bonus
        // StressManager checks isActive('stress_ball') each frame
        this.permanentUpgrades.add(upgradeId);
        console.debug('[UpgradeManager] Stress Ball: +0.25%/sec passive stress decay activated');
        break;

      case 'movement_resistance':
        // Noise-Cancelling AirPods: 70% freeze resistance + 50% slow resistance (permanent)
        // Player.freeze() and Micromanager check getMovementResistance()/getSlowResistance()
        this.permanentUpgrades.add(upgradeId);
        // If currently frozen, unfreeze immediately (resistance kicks in on next freeze)
        if (player.isFrozen) {
          player.isFrozen = false;
          player.clearTint();
        }
        // If currently slowed by micromanager, reapply with resistance
        // (remove and let next frame re-apply with new resistance values)
        player.removeSpeedModifier('micromanager_slow');
        break;

      case 'agent_slow_on_delivery':
        // Executive Presence: delivery-triggered agent slow (permanent upgrade, conditional effect)
        this.permanentUpgrades.add(upgradeId);
        // Listen for deliveries to trigger the slow
        this._epDeliveryHandler = () => this.triggerExecutivePresence();
        this.scene.events.on('task-delivered', this._epDeliveryHandler);
        console.debug('[UpgradeManager] Executive Presence: delivery-triggered agent slow activated');
        break;

      case 'task_navigation':
        // Reply-All Filter: decoy reveal + navigation arrows on all tasks (permanent)
        // Also does what old decoy_reveal did
        this.permanentUpgrades.add(upgradeId);
        this.taskNavigationActive = true;
        break;

      case 'corner_office': {
        // Corner Office: expand best dept by 2x + auto-deliver proximity (permanent)
        // If Dept Favorite already claimed a dept, use the second-most-delivered
        this.permanentUpgrades.add(upgradeId);
        let coDept = null;
        if (this.scene.taskManager) {
          coDept = this.favoriteDeptId
            ? this.scene.taskManager.getSecondMostDeliveredDept(this.favoriteDeptId)
            : this.scene.taskManager.getMostDeliveredDept();
        }
        if (coDept) {
          this.cornerOfficeDept = coDept;
          this.expandDepartmentZone(coDept, apply.zoneMultiplier);
          console.debug(`[UpgradeManager] Corner Office: expanded ${coDept} by ${apply.zoneMultiplier}x + auto-deliver`);
        } else {
          // Fallback: pick a random department (excluding favorite)
          const deptList = DEPARTMENTS.map((d) => d.id).filter((d) => d !== this.favoriteDeptId);
          this.cornerOfficeDept = randomFrom(deptList);
          this.expandDepartmentZone(this.cornerOfficeDept, apply.zoneMultiplier);
          console.debug(`[UpgradeManager] Corner Office: expanded ${this.cornerOfficeDept} (random) by ${apply.zoneMultiplier}x`);
        }
        break;
      }

      case 'meeting_blocker':
        // Meeting Blocker: halve block durations + 75% XP through blocks (permanent)
        // MeetingScheduler (Phase 3) checks isActive('meeting_blocker')
        this.permanentUpgrades.add(upgradeId);
        break;

      case 'favorite_dept': {
        // Departmental Favorite: 2x XP + 2x stress relief on most-delivered dept (permanent)
        // If Corner Office already claimed a dept, use the second-most-delivered
        this.permanentUpgrades.add(upgradeId);
        let favDept = null;
        if (this.scene.taskManager) {
          favDept = this.cornerOfficeDept
            ? this.scene.taskManager.getSecondMostDeliveredDept(this.cornerOfficeDept)
            : this.scene.taskManager.getMostDeliveredDept();
        }
        this.favoriteDeptId = favDept;
        if (favDept) {
          console.debug(`[UpgradeManager] Departmental Favorite: ${favDept} = 2x XP + 2x relief`);
        }
        break;
      }

      case 'instant_deliver_all':
        // Inbox Zero: deliver all held tasks instantly
        this.instantDeliverAll();
        break;

      case 'xp_multiplier':
        // LinkedIn Thought Leader: 2x XP for 60s
        this.addTimedUpgrade(upgradeId, upgrade.duration);
        break;

      case 'spawn_assistant':
        // Strategic Delegation: spawn NPC assistant
        this.permanentUpgrades.add(upgradeId);
        this.spawnAssistant(apply.interval);
        break;

      case 'skip_last_stop':
        // Fast Tracker: 5 charges, skip last stop + 3% stress relief per use
        this.permanentUpgrades.add(upgradeId);
        this.fastTrackerCharges = apply.charges;
        this.chargesRemaining.set(upgradeId, apply.charges);
        break;

      default:
        console.warn(`[UpgradeManager] unhandled apply type: ${apply.type}`);
    }

    this.scene.events.emit('upgrade-activated', {
      upgrade,
      duration: upgrade.duration,
    });
  }

  /**
   * Add a timed upgrade that will expire.
   * @param {string} id
   * @param {number} durationMs
   */
  addTimedUpgrade(id, durationMs) {
    // Remove existing if re-applied (refresh timer)
    this.activeTimedUpgrades = this.activeTimedUpgrades.filter((u) => u.id !== id);
    this.activeTimedUpgrades.push({ id, remaining: durationMs, total: durationMs });
  }

  /**
   * Get AirPods resistance values from the upgrade data.
   * @returns {{freezeReduction: number, slowResistance: number}|null}
   */
  getAirPodsResistance() {
    if (!this.isActive('noise_cancelling_airpods')) return null;
    const upgrade = UPGRADES.find((u) => u.id === 'noise_cancelling_airpods');
    return upgrade ? { freezeReduction: upgrade.apply.freezeReduction, slowResistance: upgrade.apply.slowResistance } : null;
  }

  /** Trigger Executive Presence: slow all agents for 8s on delivery */
  triggerExecutivePresence() {
    if (!this.isActive('executive_presence')) return;

    this.executivePresenceActive = true;

    // Reset timer if already active (refresh window)
    if (this._epTimer) this._epTimer.remove();
    this._epTimer = this.scene.time.delayedCall(CONFIG.EXECUTIVE_PRESENCE_DURATION, () => {
      this.executivePresenceActive = false;
      this._epTimer = null;
      console.debug('[UpgradeManager] Executive Presence slow expired');
    });

    console.debug('[UpgradeManager] Executive Presence triggered: agents slowed for 8s');
  }

  /**
   * Check if a specific upgrade is currently active.
   * @param {string} upgradeId
   * @returns {boolean}
   */
  isActive(upgradeId) {
    if (this.permanentUpgrades.has(upgradeId)) return true;
    return this.activeTimedUpgrades.some((u) => u.id === upgradeId);
  }

  /**
   * Use a charge of Fast Tracker. Returns true if a charge was consumed.
   * Also grants stress relief per charge.
   * @returns {boolean}
   */
  useFastTrackerCharge() {
    if (this.fastTrackerCharges <= 0) return false;
    this.fastTrackerCharges--;
    this.chargesRemaining.set('fast_tracker', this.fastTrackerCharges);

    // Stress relief per skip
    if (this.scene.stressManager) {
      this.scene.stressManager.relieveStress(CONFIG.FAST_TRACKER_STRESS_RELIEF);
    }

    console.debug(`[UpgradeManager] Fast Tracker charge used, ${this.fastTrackerCharges} remaining, -${CONFIG.FAST_TRACKER_STRESS_RELIEF}% stress`);
    if (this.fastTrackerCharges <= 0) {
      this.permanentUpgrades.delete('fast_tracker');
      this.scene.events.emit('upgrade-expired', {
        upgrade: UPGRADES.find((u) => u.id === 'fast_tracker'),
      });
    }
    return true;
  }

  /**
   * Remove an expired timed upgrade and revert its effects.
   * @param {string} upgradeId
   */
  expireUpgrade(upgradeId) {
    this.activeTimedUpgrades = this.activeTimedUpgrades.filter((u) => u.id !== upgradeId);
    const upgrade = UPGRADES.find((u) => u.id === upgradeId);

    console.log(`[UpgradeManager] expired: ${upgrade ? upgrade.name : upgradeId}`);

    this.scene.events.emit('upgrade-expired', { upgrade });
  }

  /**
   * Get all currently active upgrades for UI display.
   * @returns {Array<{id: string, name: string, remaining: number|null, total: number|null, charges: number|null}>}
   */
  getActiveUpgradesList() {
    const list = [];

    // Timed upgrades
    for (const entry of this.activeTimedUpgrades) {
      const upgrade = UPGRADES.find((u) => u.id === entry.id);
      if (upgrade) {
        list.push({
          id: entry.id,
          name: upgrade.name,
          remaining: entry.remaining,
          total: entry.total,
          charges: null,
        });
      }
    }

    // Fast Tracker (if has charges)
    if (this.fastTrackerCharges > 0) {
      list.push({
        id: 'fast_tracker',
        name: 'Fast Tracker',
        remaining: null,
        total: null,
        charges: this.fastTrackerCharges,
      });
    }

    return list;
  }

  /**
   * Expand a department's delivery zone by a multiplier.
   * Resizes the zone and its static physics body.
   * @param {string} deptId
   * @param {number} multiplier
   */
  expandDepartmentZone(deptId, multiplier) {
    if (!this.scene.departmentZones) return;
    for (const zone of this.scene.departmentZones) {
      if (zone.deptId === deptId) {
        const body = zone.body;
        const oldW = body.width;
        const oldH = body.height;
        const newW = oldW * multiplier;
        const newH = oldH * multiplier;

        // For static bodies, resize the zone itself and update body
        zone.setSize(newW, newH);
        body.setSize(newW, newH);
        // Re-center: shift position so center stays the same
        body.setOffset(-(newW - oldW) / 2, -(newH - oldH) / 2);
        body.updateFromGameObject();

        console.debug(`[UpgradeManager] expanded ${deptId} zone by ${multiplier}x`);
        break;
      }
    }
  }

  /** Instantly deliver all tasks currently held by the player (Inbox Zero) */
  instantDeliverAll() {
    const player = this.scene.player;
    if (!player || player.inventory.length === 0) return;

    const tasks = [...player.inventory];
    player.inventory.length = 0; // Clear inventory

    for (const task of tasks) {
      // Capture last destination before mutating state
      const lastDept = task.route
        ? task.route[task.route.length - 1]
        : task.department;

      task.currentStop = task.totalStops;
      task.state = TASK_STATES.DONE;

      const xp = this.scene.taskManager.calculateXP(task, lastDept);
      const stressRelief = this.scene.taskManager.getStressRelief(task, lastDept);
      this.scene.taskManager.tasksDelivered++;

      this.scene.events.emit('task-delivered', {
        task,
        department: lastDept,
        xp,
        stressRelief,
      });

      // Return to pool
      const idx = this.scene.taskManager.activeTasks.indexOf(task);
      if (idx !== -1) this.scene.taskManager.activeTasks.splice(idx, 1);
      task.deactivate();
    }

    console.log(`[UpgradeManager] Inbox Zero: delivered ${tasks.length} tasks`);
  }

  /**
   * Spawn the NPC assistant for Strategic Delegation.
   * @param {number} interval - Auto-delivery interval in ms
   */
  spawnAssistant(interval) {
    // Dynamic import to avoid circular dependencies
    import('../entities/Assistant.js').then(({ Assistant }) => {
      const player = this.scene.player;
      const offset = CONFIG.ASSISTANT_SPAWN_OFFSET;
      const assistant = new Assistant(this.scene, player.x + offset, player.y);
      assistant.deliveryInterval = interval;
      this.scene.add.existing(assistant);
      this.scene.physics.add.existing(assistant);

      // Collide with walls and obstacles
      this.scene.physics.add.collider(assistant, this.scene.wallGroup);
      this.scene.physics.add.collider(assistant, this.scene.obstacleGroup);

      assistant.activate(player.x + offset, player.y);
      this.scene.assistant = assistant;
      console.log('[UpgradeManager] Assistant NPC spawned');
    });
  }

  /** Clean up */
  destroy() {
    this.activeTimedUpgrades = [];
    this.permanentUpgrades.clear();
    this.chargesRemaining.clear();
    this.grantedUpgrades.clear();
    this.cornerOfficeDept = null;
    this.favoriteDeptId = null;
    this.taskNavigationActive = false;
    this.executivePresenceActive = false;
    if (this._epTimer) { this._epTimer.remove(); this._epTimer = null; }
    this.scene.events.off('upgrade-selected', this._onUpgradeSelected);
    this.scene.events.off('agent-spawned', this._onAgentSpawned);
    if (this._epDeliveryHandler) {
      this.scene.events.off('task-delivered', this._epDeliveryHandler);
    }
  }
}
