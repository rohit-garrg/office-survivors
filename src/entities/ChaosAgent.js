import Phaser from 'phaser';
import CONFIG from '../config/gameConfig.js';
import { randomFrom, randomInt } from '../utils/helpers.js';

/**
 * Base class for all chaos agents.
 * Provides simple tile-based movement (NOT full A* pathfinding).
 *
 * Movement logic:
 * 1. Pick cardinal direction that reduces distance to target most
 * 2. Set velocity in that direction
 * 3. If stuck (no progress for 0.5s), try perpendicular directions
 * 4. If all blocked, idle 0.5s then retry
 *
 * Intentionally imperfect — agents getting stuck behind furniture is funny.
 *
 * Education features (name labels, info panels, speech bubbles):
 * Subclasses set displayName, description, and speechLines in their constructors.
 */
export class ChaosAgent extends Phaser.GameObjects.Sprite {
  constructor(scene, x, y, texture, agentType) {
    super(scene, x, y, texture);
    console.log(`[ChaosAgent:${agentType}] initialized`);

    this.scene = scene;

    /** @type {string} Agent type identifier */
    this.agentType = agentType;

    /** @type {number} Movement speed in px/sec */
    this.speed = 0;

    /** @type {{x: number, y: number}|null} Current movement target (pixel coords) */
    this.target = null;

    /** @type {boolean} Whether agent is active on the map */
    this.isActive = false;

    /** @type {{x: number, y: number}} Last known position for stuck detection */
    this._lastPos = { x: 0, y: 0 };

    /** @type {number} Time accumulated since last significant movement */
    this._stuckTimer = 0;

    /** @type {number} Time remaining in idle wait (when stuck) */
    this._idleTimer = 0;

    /** @type {number} Threshold distance to consider "arrived" at target */
    this._arrivalThreshold = CONFIG.AGENT_ARRIVAL_THRESHOLD;

    /** @type {number} Distance threshold to consider "stuck" */
    this._stuckThreshold = CONFIG.AGENT_STUCK_THRESHOLD;

    /** @type {boolean} Whether currently in stuck-idle wait */
    this._isIdling = false;

    /** @type {boolean} Whether currently nudging perpendicular to escape obstacles */
    this._isNudging = false;

    /** @type {number} Time remaining in nudge movement */
    this._nudgeTimer = 0;

    /** @type {{x: number, y: number}} Normalized nudge direction */
    this._nudgeDir = { x: 0, y: 0 };

    /** @type {number} Consecutive stuck attempts (resets on successful movement or target change) */
    this._stuckRetries = 0;

    // === Education properties (set by subclasses) ===

    /** @type {string} Display name shown below agent */
    this.displayName = '';

    /** @type {string} Behavior description for click-to-inspect */
    this.description = '';

    /** @type {Array<string>} Periodic speech bubble lines */
    this.speechLines = [];

    // === Education state (managed by base class) ===

    /** @type {Phaser.GameObjects.Text|null} Persistent name label below agent */
    this._nameLabel = null;

    /** @type {Phaser.GameObjects.Container|null} Click-to-inspect info panel */
    this._infoPanel = null;

    /** @type {Phaser.GameObjects.Container|null} Periodic speech bubble */
    this._speechBubble = null;

    /** @type {number} Time remaining until next periodic speech */
    this._speechTimer = 0;

    // === Animation properties ===

    // === Wander stuck detection (for direction-based wanderers) ===

    /** @type {{x: number, y: number}} Last position for wander stuck check */
    this._wanderLastPos = { x: 0, y: 0 };

    /** @type {number} Time accumulated with insufficient movement */
    this._wanderStuckAccum = 0;

    /** @type {string|null} Animation prefix (set by subclasses, e.g. 'micromanager') */
    this.animPrefix = null;

    /** @type {string} Current facing direction */
    this.facing = 'south';

    /** @type {boolean} Whether currently moving (for animation state) */
    this._isWalking = false;

    // Start inactive
    this.setActive(false);
    this.setVisible(false);
  }

  /** Set up physics body. Call after adding to scene. */
  init() {
    if (!this.body) return;
    const bodySize = 20;
    this.body.setSize(bodySize, bodySize);
    this.body.setOffset(6, 10); // centered within 32x32 sprite, offset down for feet
    this.body.setCollideWorldBounds(false);
    this.setDepth(10);
  }

  /**
   * Base update: move toward target, handle stuck detection.
   * Also updates education visuals (name label, speech bubble, info panel).
   * Subclasses should call super.update() or handle movement themselves.
   */
  update(time, delta) {
    if (!this.isActive) return;

    // Handle idle wait (stuck recovery)
    if (this._isIdling) {
      this._idleTimer -= delta;
      if (this._idleTimer <= 0) {
        this._isIdling = false;
      }
      if (this.body) this.body.setVelocity(0, 0);
      this.updateAgentAnimation(0, 0);
      this.updateEducationVisuals(delta);
      return;
    }

    // Handle nudge (perpendicular slide to escape obstacles)
    if (this._isNudging) {
      this._nudgeTimer -= delta;
      if (this._nudgeTimer <= 0) {
        this._isNudging = false;
      } else if (this.body) {
        const speed = this.getEffectiveSpeed();
        const vx = this._nudgeDir.x * speed;
        const vy = this._nudgeDir.y * speed;
        this.body.setVelocity(vx, vy);
        this.updateAgentAnimation(vx, vy);
      }
      this.updateEducationVisuals(delta);
      return;
    }

    if (this.target) {
      this.moveTowardTarget(delta);
    }

    this.updateEducationVisuals(delta);
  }

  /**
   * Simple directional movement toward target.
   * Picks the cardinal direction that reduces distance most.
   * Uses stuck detection to handle wall collisions.
   */
  moveTowardTarget(delta) {
    if (!this.target || !this.body) return;

    const dx = this.target.x - this.x;
    const dy = this.target.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Arrived at target
    if (dist < this._arrivalThreshold) {
      this.body.setVelocity(0, 0);
      this.onArrived();
      return;
    }

    // Get effective speed (Executive Presence slows all agents)
    const effectiveSpeed = this.getEffectiveSpeed();

    // Determine primary movement direction
    let vx = 0;
    let vy = 0;

    if (Math.abs(dx) > Math.abs(dy)) {
      // Horizontal is primary
      vx = dx > 0 ? effectiveSpeed : -effectiveSpeed;
      // Add slight vertical component to navigate around obstacles
      if (Math.abs(dy) > this._arrivalThreshold) {
        vy = dy > 0 ? effectiveSpeed * CONFIG.AGENT_PERPENDICULAR_SPEED_FACTOR : -effectiveSpeed * CONFIG.AGENT_PERPENDICULAR_SPEED_FACTOR;
      }
    } else {
      // Vertical is primary
      vy = dy > 0 ? effectiveSpeed : -effectiveSpeed;
      // Add slight horizontal component
      if (Math.abs(dx) > this._arrivalThreshold) {
        vx = dx > 0 ? effectiveSpeed * CONFIG.AGENT_PERPENDICULAR_SPEED_FACTOR : -effectiveSpeed * CONFIG.AGENT_PERPENDICULAR_SPEED_FACTOR;
      }
    }

    this.body.setVelocity(vx, vy);

    // Update animation based on velocity direction
    this.updateAgentAnimation(vx, vy);

    // Stuck detection: if we haven't moved much in 0.5s, idle and retry
    const movedDist = Phaser.Math.Distance.Between(
      this.x, this.y, this._lastPos.x, this._lastPos.y
    );

    this._stuckTimer += delta;
    if (this._stuckTimer >= CONFIG.AGENT_STUCK_CHECK_INTERVAL) {
      if (movedDist < this._stuckThreshold) {
        this._stuckRetries++;
        if (this._stuckRetries >= CONFIG.AGENT_STUCK_MAX_RETRIES) {
          // Exhausted nudge attempts — escalate
          this._stuckRetries = 0;
          this.onStuck();
        } else {
          // Nudge perpendicular to target direction
          this._isNudging = true;
          this._nudgeTimer = CONFIG.AGENT_STUCK_NUDGE_DURATION;
          const dx = this.target.x - this.x;
          const dy = this.target.y - this.y;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          const sign = Math.random() > 0.5 ? 1 : -1;
          this._nudgeDir = { x: (-dy / len) * sign, y: (dx / len) * sign };
          this.body.setVelocity(0, 0);
          console.debug(`[ChaosAgent:${this.agentType}] stuck, nudging perpendicular (attempt ${this._stuckRetries})`);
        }
      }
      this._lastPos.x = this.x;
      this._lastPos.y = this.y;
      this._stuckTimer = 0;
    }
  }

  /**
   * Update walk/idle animation for NPC based on velocity direction.
   * Uses 4-direction mapping (south, east, north, west).
   * @param {number} vx - Velocity X
   * @param {number} vy - Velocity Y
   */
  updateAgentAnimation(vx, vy) {
    if (!this.animPrefix) return;

    const isMoving = Math.abs(vx) > 0.1 || Math.abs(vy) > 0.1;

    // Determine facing direction from velocity (4-cardinal only)
    if (isMoving) {
      if (Math.abs(vx) > Math.abs(vy)) {
        this.facing = vx > 0 ? 'east' : 'west';
      } else {
        this.facing = vy > 0 ? 'south' : 'north';
      }
    }

    const wasWalking = this._isWalking;
    this._isWalking = isMoving;

    const animKey = isMoving
      ? `${this.animPrefix}-walk-${this.facing}`
      : `${this.animPrefix}-idle-${this.facing}`;

    if (this.anims.currentAnim?.key !== animKey && this.scene.anims.exists(animKey)) {
      this.play(animKey, true);
    }
  }

  /**
   * Called when agent arrives at its target.
   * Override in subclasses to define arrival behavior.
   */
  onArrived() {
    this.target = null;
    // Play idle animation
    this.updateAgentAnimation(0, 0);
  }

  /**
   * Called when agent is stuck after max nudge retries.
   * Default: clear target so subclass update() picks a new one.
   * Override in subclasses for custom recovery.
   */
  onStuck() {
    this.target = null;
    if (this.body) this.body.setVelocity(0, 0);
    this.updateAgentAnimation(0, 0);

    // Force random wander for 1.5s to escape the wall before re-acquiring a target
    this._isNudging = true;
    this._nudgeTimer = 1500;
    const angle = Math.random() * Math.PI * 2;
    this._nudgeDir = { x: Math.cos(angle), y: Math.sin(angle) };

    console.debug(`[ChaosAgent:${this.agentType}] stuck, wandering to escape`);
  }

  /** Set a new movement target in pixel coordinates */
  setTarget(x, y) {
    this.target = { x, y };
    this._stuckTimer = 0;
    this._isIdling = false;
    this._isNudging = false;
    this._stuckRetries = 0;
    this._lastPos.x = this.x;
    this._lastPos.y = this.y;
  }

  /**
   * Update target coordinates without resetting stuck detection.
   * Use for continuously-tracking agents (e.g., Micromanager following player).
   * Unlike setTarget(), this preserves stuck timer, retry count, and nudge state.
   */
  updateTargetPosition(x, y) {
    if (!this.target) {
      this.setTarget(x, y);
      return;
    }
    this.target.x = x;
    this.target.y = y;
  }

  /**
   * Get effective speed factoring in Executive Presence upgrade.
   * @returns {number} Speed in px/sec
   */
  getEffectiveSpeed() {
    let speed = this.speed;
    if (this.scene.upgradeManager && this.scene.upgradeManager.isActive('executive_presence')) {
      speed *= CONFIG.EXECUTIVE_PRESENCE_SLOW_FACTOR;
    }
    return speed;
  }

  /**
   * Check if a direction-based wanderer is stuck against furniture.
   * Call each frame after setting velocity. Returns true if stuck long enough
   * to warrant a forced direction change.
   * @param {number} delta - Frame delta in ms
   * @returns {boolean} True if agent should change direction
   */
  checkWanderStuck(delta) {
    const movedDist = Phaser.Math.Distance.Between(
      this.x, this.y, this._wanderLastPos.x, this._wanderLastPos.y
    );

    if (movedDist < CONFIG.AGENT_WANDER_STUCK_THRESHOLD) {
      this._wanderStuckAccum += delta;
    } else {
      this._wanderStuckAccum = 0;
    }

    this._wanderLastPos.x = this.x;
    this._wanderLastPos.y = this.y;

    if (this._wanderStuckAccum >= CONFIG.AGENT_WANDER_STUCK_TIME) {
      this._wanderStuckAccum = 0;
      return true;
    }
    return false;
  }

  // ========================
  // Education: Name Labels
  // ========================

  /** Create persistent name label below agent */
  createNameLabel() {
    if (!this.displayName) return;
    this._nameLabel = this.scene.add.text(this.x, this.y + 16, this.displayName, {
      fontSize: '8px',
      fontFamily: 'monospace',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5, 0).setDepth(11);
  }

  /** Destroy name label */
  destroyNameLabel() {
    if (this._nameLabel) {
      this._nameLabel.destroy();
      this._nameLabel = null;
    }
  }

  // ========================
  // Education: Click-to-Inspect
  // ========================

  /** Show info panel with behavior description above agent */
  showInfoPanel() {
    if (!this.description) return;
    this.hideInfoPanel();

    // Hide speech bubble to avoid overlap
    this.hideAgentSpeech();

    const padding = 8;
    const maxWidth = 180;

    const label = this.scene.add.text(0, 0, this.description, {
      fontSize: '10px',
      fontFamily: 'monospace',
      color: '#ffffff',
      wordWrap: { width: maxWidth - padding * 2 },
    }).setOrigin(0.5);

    const bgWidth = Math.min(maxWidth, label.width + padding * 2);
    const bgHeight = label.height + padding * 2;

    const bg = this.scene.add.rectangle(0, 0, bgWidth, bgHeight, 0x000000, 0.85)
      .setStrokeStyle(1, 0xffffff);

    this._infoPanel = this.scene.add.container(this.x, this.y - 36, [bg, label])
      .setDepth(30);

    // Auto-dismiss after configured duration
    this._infoPanelTimer = this.scene.time.delayedCall(CONFIG.AGENT_INFO_PANEL_DURATION, () => {
      this.hideInfoPanel();
    });
  }

  /** Destroy info panel */
  hideInfoPanel() {
    if (this._infoPanel) {
      this._infoPanel.destroy();
      this._infoPanel = null;
    }
    if (this._infoPanelTimer) {
      this._infoPanelTimer.destroy();
      this._infoPanelTimer = null;
    }
  }

  // ========================
  // Education: Periodic Speech Bubbles
  // ========================

  /** Show a random speech bubble above the agent */
  showAgentSpeech() {
    if (!this.speechLines || this.speechLines.length === 0) return;
    this.hideAgentSpeech();

    const text = randomFrom(this.speechLines);

    const label = this.scene.add.text(0, 0, text, {
      fontSize: '9px',
      fontFamily: 'monospace',
      color: '#333333',
    }).setOrigin(0.5);

    const bgWidth = label.width + 14;
    const bgHeight = label.height + 10;

    const bg = this.scene.add.rectangle(0, 0, bgWidth, bgHeight, 0xffffff, 0.92)
      .setStrokeStyle(1, 0x999999);

    this._speechBubble = this.scene.add.container(this.x, this.y - 28, [bg, label])
      .setDepth(24);

    // Auto-hide after AGENT_SPEECH_DURATION
    this._speechBubbleTimer = this.scene.time.delayedCall(CONFIG.AGENT_SPEECH_DURATION, () => {
      this.hideAgentSpeech();
    });
  }

  /** Destroy periodic speech bubble */
  hideAgentSpeech() {
    if (this._speechBubble) {
      this._speechBubble.destroy();
      this._speechBubble = null;
    }
    if (this._speechBubbleTimer) {
      this._speechBubbleTimer.destroy();
      this._speechBubbleTimer = null;
    }
  }

  // ========================
  // Education: Frame Update
  // ========================

  /** Update positions of all education visuals + tick speech timer */
  updateEducationVisuals(delta) {
    // Update name label position
    if (this._nameLabel) {
      this._nameLabel.setPosition(this.x, this.y + 16);
    }

    // Update info panel position
    if (this._infoPanel) {
      this._infoPanel.setPosition(this.x, this.y - 36);
    }

    // Update speech bubble position
    if (this._speechBubble) {
      this._speechBubble.setPosition(this.x, this.y - 28);
    }

    // Periodic speech timer
    if (this.speechLines && this.speechLines.length > 0) {
      this._speechTimer -= delta;
      if (this._speechTimer <= 0) {
        this.showAgentSpeech();
        this._speechTimer = randomInt(CONFIG.AGENT_SPEECH_INTERVAL_MIN, CONFIG.AGENT_SPEECH_INTERVAL_MAX);
      }
    }
  }

  /**
   * Activate this agent at the given position.
   * @param {number} x - Pixel X
   * @param {number} y - Pixel Y
   */
  activate(x, y) {
    this.isActive = true;
    this.setPosition(x, y);
    this.setActive(true);
    this.setVisible(true);
    this._lastPos.x = x;
    this._lastPos.y = y;
    this._stuckTimer = 0;
    this._idleTimer = 0;
    this._isIdling = false;
    this._isNudging = false;
    this._stuckRetries = 0;

    if (this.body) {
      this.body.enable = true;
    }

    // Education: create name label and enable click-to-inspect
    this.createNameLabel();
    this._speechTimer = randomInt(CONFIG.AGENT_SPEECH_INTERVAL_MIN, CONFIG.AGENT_SPEECH_INTERVAL_MAX);

    // Play initial idle animation
    this.facing = 'south';
    this.updateAgentAnimation(0, 0);

    if (this.description) {
      this.setInteractive({ useHandCursor: true });
      this.on('pointerdown', this._onPointerDown, this);
    }

    console.log(`[ChaosAgent:${this.agentType}] activated at (${Math.round(x)}, ${Math.round(y)})`);
  }

  /** Handler for click-to-inspect */
  _onPointerDown() {
    this.showInfoPanel();
  }

  /** Deactivate this agent (remove from play) */
  deactivate() {
    this.isActive = false;
    this.setActive(false);
    this.setVisible(false);
    this.target = null;

    if (this.body) {
      this.body.enable = false;
      this.body.setVelocity(0, 0);
    }

    // Education: clean up all visuals
    this.destroyNameLabel();
    this.hideInfoPanel();
    this.hideAgentSpeech();

    if (this.description) {
      this.off('pointerdown', this._onPointerDown, this);
      this.removeInteractive();
    }

    this.setPosition(-100, -100);
    console.log(`[ChaosAgent:${this.agentType}] deactivated`);
  }
}
