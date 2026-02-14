import { ChaosAgent } from './ChaosAgent.js';
import CONFIG from '../config/gameConfig.js';
import { randomFrom, randomInt } from '../utils/helpers.js';
import Phaser from 'phaser';

/** Speech bubble texts for the Chatty Colleague (freeze-triggered) */
export const CHATTY_SPEECHES = [
  'So about my weekend...',
  'Quick question, do you have 5 minutes?',
  'Have you seen the new org chart?',
  "I'm not one to gossip, but...",
  'Did you see that email?',
  'Can I pick your brain for a sec?',
];

/**
 * The Chatty Colleague: wanders randomly, freezes player on contact.
 *
 * - Wanders randomly, changes direction every 2-4 seconds
 * - On player overlap: freeze player for CHATTY_FREEZE_DURATION (2.5s)
 * - Shows speech bubble with random line
 * - After freeze: walks away (180-degree turn), 6s cooldown
 * - Freeze does NOT pause game timer or stress accumulation
 */
export class ChattyColleague extends ChaosAgent {
  constructor(scene, x, y) {
    const texture = scene.textures.exists('agent-chatty') ? 'agent-chatty' : 'agent_chattycolleague';
    super(scene, x, y, texture, 'chatty_colleague');
    this.speed = CONFIG.CHATTY_SPEED;
    this.animPrefix = scene.textures.exists('agent-chatty') ? 'chatty' : null;

    // Education properties
    this.displayName = 'Chatty Colleague';
    this.description = 'Freezes you for 2.5s on contact. Keep your distance!';
    this.speechLines = [
      'OMG you won\'t believe...',
      'So anyway...',
      'One more thing...',
      'Real quick question...',
      'Between us...',
      'Did you hear about...?',
    ];

    /** @type {number} Time until next direction change */
    this._directionTimer = 0;

    /** @type {{x: number, y: number}} Current wander direction */
    this._wanderDir = { x: 0, y: 0 };

    /** @type {boolean} Whether on cooldown after a freeze */
    this._onCooldown = false;

    /** @type {number} Cooldown time remaining */
    this._cooldownTimer = 0;

    /** @type {Phaser.GameObjects.Container|null} Freeze-triggered speech bubble (separate from periodic) */
    this._freezeBubble = null;

    /** @type {boolean} Whether currently walking away after freeze */
    this._walkingAway = false;
  }

  /** Wander randomly, check for player overlap */
  update(time, delta) {
    if (!this.isActive) return;

    // Handle cooldown
    if (this._onCooldown) {
      this._cooldownTimer -= delta;
      if (this._cooldownTimer <= 0) {
        this._onCooldown = false;
        this._walkingAway = false;
      }
    }

    // Wander: change direction periodically
    this._directionTimer -= delta;
    if (this._directionTimer <= 0) {
      this.changeDirection();
    }

    // Move in current wander direction
    const effectiveSpeed = this.getEffectiveSpeed();
    const vx = this._wanderDir.x * effectiveSpeed;
    const vy = this._wanderDir.y * effectiveSpeed;
    if (this.body) {
      this.body.setVelocity(vx, vy);
    }
    this.updateAgentAnimation(vx, vy);

    // Keep agent within map bounds
    this.clampToMap();

    // Stuck detection: force direction change if blocked by furniture
    if (this.checkWanderStuck(delta)) {
      this.changeDirection();
    }

    // Check for player overlap (only if not on cooldown)
    if (!this._onCooldown) {
      this.checkPlayerOverlap();
    }

    // Update freeze bubble position if active
    if (this._freezeBubble) {
      this._freezeBubble.setPosition(this.x, this.y - 30);
    }

    // Base class handles education visuals (name label, periodic speech, info panel)
    this.updateEducationVisuals(delta);
  }

  /**
   * Pick a wander direction with player-seeking bias.
   * AGENT_WANDER_SEEK_CHANCE (35%) → compass direction closest to player.
   * Otherwise → random direction excluding the current one.
   */
  changeDirection() {
    const directions = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
      { x: 1, y: 1 },
      { x: -1, y: -1 },
      { x: 1, y: -1 },
      { x: -1, y: 1 },
    ];

    let dir;
    const player = this.scene.player;

    if (player && Math.random() < CONFIG.AGENT_WANDER_SEEK_CHANCE) {
      // Pick the compass direction closest to the player (dot product)
      const dx = player.x - this.x;
      const dy = player.y - this.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const nx = dx / len;
      const ny = dy / len;

      let bestDot = -Infinity;
      let bestDir = directions[0];
      for (const d of directions) {
        const mag = Math.sqrt(d.x * d.x + d.y * d.y);
        const dot = (d.x / mag) * nx + (d.y / mag) * ny;
        if (dot > bestDot) {
          bestDot = dot;
          bestDir = d;
        }
      }
      dir = bestDir;
    } else {
      // Random direction excluding the current one
      const currentX = this._wanderDir.x;
      const currentY = this._wanderDir.y;
      const filtered = directions.filter((d) => {
        const mag = Math.sqrt(d.x * d.x + d.y * d.y);
        return !(Math.abs(d.x / mag - currentX) < 0.01 && Math.abs(d.y / mag - currentY) < 0.01);
      });
      dir = randomFrom(filtered.length > 0 ? filtered : directions);
    }

    const mag = Math.sqrt(dir.x * dir.x + dir.y * dir.y);
    this._wanderDir = { x: dir.x / mag, y: dir.y / mag };
    this._directionTimer = randomInt(CONFIG.AGENT_WANDER_DIR_CHANGE_MIN, CONFIG.AGENT_WANDER_DIR_CHANGE_MAX);
  }

  /** Keep agent within playable map area */
  clampToMap() {
    const margin = CONFIG.TILE_SIZE * 2;
    const maxX = CONFIG.MAP_WIDTH_TILES * CONFIG.TILE_SIZE - margin;
    const maxY = CONFIG.MAP_HEIGHT_TILES * CONFIG.TILE_SIZE - margin;

    if (this.x < margin || this.x > maxX || this.y < margin || this.y > maxY) {
      // Reverse direction when hitting map edge
      this._wanderDir.x = -this._wanderDir.x;
      this._wanderDir.y = -this._wanderDir.y;
    }
  }

  /** Check if player is overlapping this agent */
  checkPlayerOverlap() {
    const player = this.scene.player;
    if (!player || player.isFrozen) return;

    const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
    // Overlap = within combined half-sizes
    if (dist < CONFIG.CHATTY_FREEZE_OVERLAP_DIST) {
      this.freezePlayer();
    }
  }

  /** Freeze the player and show freeze bubble */
  freezePlayer() {
    const player = this.scene.player;
    if (!player) return;

    // AirPods: immune to freeze
    if (player.isImmuneToSlow()) {
      console.debug('[ChattyColleague] freeze blocked by AirPods');
      // Still go on cooldown
      this._onCooldown = true;
      this._cooldownTimer = CONFIG.CHATTY_COOLDOWN;
      this.walkAway();
      return;
    }

    // Freeze the player
    player.freeze(CONFIG.CHATTY_FREEZE_DURATION);

    // Stop chatty while talking
    if (this.body) this.body.setVelocity(0, 0);

    // Show freeze bubble
    this.showFreezeBubble();

    this.scene.events.emit('agent-disruption', {
      type: 'chatty_colleague',
      effect: 'freeze',
      position: { x: this.x, y: this.y },
    });

    console.debug('[ChattyColleague] froze player');

    // After freeze ends, walk away
    this.scene.time.delayedCall(CONFIG.CHATTY_FREEZE_DURATION, () => {
      this.hideFreezeBubble();
      this.walkAway();
    });

    // Start cooldown
    this._onCooldown = true;
    this._cooldownTimer = CONFIG.CHATTY_COOLDOWN;
  }

  /** Walk away from player (180-degree turn) */
  walkAway() {
    this._walkingAway = true;
    // Reverse current direction
    this._wanderDir.x = -this._wanderDir.x;
    this._wanderDir.y = -this._wanderDir.y;
    // If standing still, pick a random away direction
    if (this._wanderDir.x === 0 && this._wanderDir.y === 0) {
      this._wanderDir = { x: Math.random() > 0.5 ? 1 : -1, y: Math.random() > 0.5 ? 1 : -1 };
    }
    this._directionTimer = CONFIG.CHATTY_WALK_AWAY_DURATION;
  }

  /** Get a random freeze speech bubble text */
  getRandomSpeech() {
    return randomFrom(CHATTY_SPEECHES);
  }

  /** Show a freeze-triggered speech bubble above the agent */
  showFreezeBubble() {
    this.hideFreezeBubble(); // Clean up any existing

    // Also hide periodic speech to avoid overlap
    this.hideAgentSpeech();

    const text = this.getRandomSpeech();

    // White rounded rect background + text
    const bg = this.scene.add.rectangle(0, 0, text.length * 6 + 16, 22, 0xffffff, 0.95)
      .setStrokeStyle(1, 0x333333);
    const label = this.scene.add.text(0, 0, text, {
      fontSize: '10px',
      fontFamily: 'monospace',
      color: '#333333',
    }).setOrigin(0.5);

    this._freezeBubble = this.scene.add.container(this.x, this.y - 30, [bg, label])
      .setDepth(25);

    // Auto-hide after freeze duration
    this.scene.time.delayedCall(CONFIG.CHATTY_FREEZE_DURATION, () => {
      this.hideFreezeBubble();
    });
  }

  /** Remove the freeze bubble */
  hideFreezeBubble() {
    if (this._freezeBubble) {
      this._freezeBubble.destroy();
      this._freezeBubble = null;
    }
  }

  /** Override: skip periodic speech when freeze bubble is active */
  showAgentSpeech() {
    if (this._freezeBubble) return;
    super.showAgentSpeech();
  }

  /** Clean up on deactivation */
  deactivate() {
    this.hideFreezeBubble();
    super.deactivate();
  }
}
