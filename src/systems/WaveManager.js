import { AGENT_SCHEDULE } from '../config/agentSchedule.js';
import { TASK_SPAWN_POINTS } from '../config/mapData.js';
import { randomFrom, tileToPixel, distance } from '../utils/helpers.js';
import CONFIG from '../config/gameConfig.js';
import { Micromanager } from '../entities/Micromanager.js';
import { ReplyAllGuy } from '../entities/ReplyAllGuy.js';
import { MeetingScheduler } from '../entities/MeetingScheduler.js';
import { ChattyColleague } from '../entities/ChattyColleague.js';
import { SlackPinger } from '../entities/SlackPinger.js';

/**
 * WaveManager: manages chaos agent spawn schedule.
 *
 * Agents spawn when BOTH conditions are met:
 * 1. Enough game time has passed (timeGate)
 * 2. Player has reached minimum level (levelGate)
 *
 * Agent counts can increase in the final minutes (maxCountTime).
 * All agents are persistent (never despawn once spawned).
 */
export class WaveManager {
  constructor(scene) {
    console.log('[WaveManager] initialized');

    /** @type {Phaser.Scene} */
    this.scene = scene;

    /** @type {Map<string, Array>} Active agents by type */
    this.activeAgents = new Map();

    /** @type {Set<string>} Agent types that have been initially spawned */
    this.spawnedTypes = new Set();

    /** @type {Set<string>} Agent types that have been scaled up to maxCount */
    this.scaledTypes = new Set();

    /** @type {MeetingScheduler|null} Reference to the meeting scheduler (for delivery blocking) */
    this.meetingScheduler = null;
  }

  /** Initialize: set up maps for each agent type */
  init() {
    for (const config of AGENT_SCHEDULE) {
      this.activeAgents.set(config.type, []);
    }
  }

  /**
   * Per-frame update: check spawn conditions, update all active agents.
   * @param {number} time - Phaser time
   * @param {number} delta - ms since last frame
   */
  update(time, delta) {
    const elapsedTime = this.scene.elapsedTime || 0;
    const playerLevel = this.scene.progressionManager
      ? this.scene.progressionManager.level
      : 1;

    // Check each agent type's spawn conditions
    for (const config of AGENT_SCHEDULE) {
      // Check initial spawn
      if (!this.spawnedTypes.has(config.type)) {
        if (this.checkSpawnConditions(config, elapsedTime, playerLevel)) {
          // Spawn initialCount agents
          for (let i = 0; i < config.initialCount; i++) {
            this.spawnAgent(config.type);
          }
          this.spawnedTypes.add(config.type);

          this.scene.events.emit('agent-spawned', {
            type: config.type,
            name: config.name,
          });

          console.log(`[WaveManager] first spawn: ${config.name} (x${config.initialCount})`);
        }
      }

      // Check scale-up (max count increase at maxCountTime)
      if (this.spawnedTypes.has(config.type) &&
          !this.scaledTypes.has(config.type) &&
          config.maxCountTime &&
          config.maxCount > config.initialCount) {

        const currentCount = this.activeAgents.get(config.type).length;
        if (elapsedTime >= config.maxCountTime && currentCount < config.maxCount) {
          const toSpawn = config.maxCount - currentCount;
          for (let i = 0; i < toSpawn; i++) {
            this.spawnAgent(config.type);
          }
          this.scaledTypes.add(config.type);

          this.scene.events.emit('agent-spawned', {
            type: config.type,
            name: config.name,
          });

          console.log(`[WaveManager] scale-up: ${config.name} -> ${config.maxCount}`);
        }
      }
    }

    // Update all active agents
    for (const [type, agents] of this.activeAgents) {
      for (const agent of agents) {
        if (agent.isActive) {
          agent.update(time, delta);
        }
      }
    }
  }

  /**
   * Check if an agent type's spawn conditions are met.
   * @param {object} agentConfig - From AGENT_SCHEDULE
   * @param {number} elapsedTime - Seconds elapsed
   * @param {number} playerLevel - Current player level
   * @returns {boolean}
   */
  checkSpawnConditions(agentConfig, elapsedTime, playerLevel) {
    return elapsedTime >= agentConfig.timeGate && playerLevel >= agentConfig.levelGate;
  }

  /**
   * Spawn a new chaos agent of the given type.
   * @param {string} agentType - Agent type key from AGENT_SCHEDULE
   * @returns {ChaosAgent|null} The spawned agent, or null if failed
   */
  spawnAgent(agentType) {
    const pos = this.getAgentSpawnPosition();
    if (!pos) {
      console.warn(`[WaveManager] no valid spawn position for ${agentType}`);
      return null;
    }

    let agent;
    switch (agentType) {
      case 'micromanager':
        agent = new Micromanager(this.scene, pos.x, pos.y);
        break;
      case 'reply_all_guy':
        agent = new ReplyAllGuy(this.scene, pos.x, pos.y);
        break;
      case 'meeting_scheduler':
        agent = new MeetingScheduler(this.scene, pos.x, pos.y);
        this.meetingScheduler = agent;
        break;
      case 'chatty_colleague':
        agent = new ChattyColleague(this.scene, pos.x, pos.y);
        break;
      case 'slack_pinger':
        agent = new SlackPinger(this.scene, pos.x, pos.y);
        break;
      default:
        console.warn(`[WaveManager] unknown agent type: ${agentType}`);
        return null;
    }

    // Add to scene and set up physics
    this.scene.add.existing(agent);
    this.scene.physics.add.existing(agent);
    agent.init();

    // Set up wall/obstacle collisions
    this.scene.physics.add.collider(agent, this.scene.wallGroup);
    this.scene.physics.add.collider(agent, this.scene.obstacleGroup);

    agent.activate(pos.x, pos.y);

    // Track agent
    const agents = this.activeAgents.get(agentType) || [];
    agents.push(agent);
    this.activeAgents.set(agentType, agents);

    return agent;
  }

  /**
   * Get a valid spawn position for an agent.
   * Uses task spawn points, picks one at least 160px from player.
   * @returns {{x: number, y: number}|null}
   */
  getAgentSpawnPosition() {
    const player = this.scene.player;
    if (!player) return null;

    // Filter spawn points far from player
    const minDist = CONFIG.REPLYALL_MIN_SPAWN_DIST; // 160px
    const validPoints = TASK_SPAWN_POINTS.filter((point) => {
      const pos = tileToPixel(point.x, point.y, CONFIG.TILE_SIZE);
      return distance(pos.x, pos.y, player.x, player.y) >= minDist;
    });

    if (validPoints.length === 0) {
      // Fallback: use any spawn point
      const point = randomFrom(TASK_SPAWN_POINTS);
      return tileToPixel(point.x, point.y, CONFIG.TILE_SIZE);
    }

    const point = randomFrom(validPoints);
    return tileToPixel(point.x, point.y, CONFIG.TILE_SIZE);
  }

  /**
   * Get agent config from schedule by type.
   * @param {string} agentType
   * @returns {object|null}
   */
  getAgentConfig(agentType) {
    return AGENT_SCHEDULE.find((c) => c.type === agentType) || null;
  }

  /**
   * Remove a specific agent from tracking.
   * @param {import('../entities/ChaosAgent.js').ChaosAgent} agent
   */
  removeAgent(agent) {
    const agents = this.activeAgents.get(agent.agentType);
    if (agents) {
      const idx = agents.indexOf(agent);
      if (idx !== -1) agents.splice(idx, 1);
    }
    agent.deactivate();
  }

  /**
   * Get all active agents as a flat list.
   * @returns {Array}
   */
  getAllActiveAgents() {
    const all = [];
    for (const agents of this.activeAgents.values()) {
      for (const agent of agents) {
        if (agent.isActive) all.push(agent);
      }
    }
    return all;
  }

  /** Clean up all agents and event listeners */
  destroy() {
    for (const agents of this.activeAgents.values()) {
      for (const agent of agents) {
        agent.deactivate();
        agent.destroy();
      }
    }
    this.activeAgents.clear();
    this.spawnedTypes.clear();
    this.scaledTypes.clear();
    this.meetingScheduler = null;
  }
}
