import Phaser from 'phaser';
import CONFIG from '../config/gameConfig.js';
import { normalizeVelocity } from '../utils/helpers.js';

/**
 * Sprite variant mapping: tier -> sprite sheet key.
 * Casual = Intern + Associate (levels 1-4)
 * Business = Manager + Director (levels 5-8)
 * Executive = CEO (level 9)
 */
const TIER_SPRITES = {
  INTERN: 'player-casual',
  ASSOCIATE: 'player-casual',
  MANAGER: 'player-business',
  DIRECTOR: 'player-business',
  CEO: 'player-executive',
};

/**
 * Map velocity direction to animation direction name.
 * Uses 8-direction for player (diagonals included).
 */
function getDirection8(vx, vy) {
  if (vx === 0 && vy === 0) return null;
  if (vx === 0 && vy > 0) return 'south';
  if (vx === 0 && vy < 0) return 'north';
  if (vx > 0 && vy === 0) return 'east';
  if (vx < 0 && vy === 0) return 'west';
  if (vx > 0 && vy > 0) return 'south-east';
  if (vx < 0 && vy > 0) return 'south-west';
  if (vx > 0 && vy < 0) return 'north-east';
  if (vx < 0 && vy < 0) return 'north-west';
  return 'south';
}

export class Player extends Phaser.GameObjects.Sprite {
  constructor(scene, x, y) {
    // Start with the casual variant (or fallback placeholder)
    const initialTexture = scene.textures.exists('player-casual') ? 'player-casual' : 'player';
    super(scene, x, y, initialTexture, 0);
    console.log('[Player] initialized');

    this.scene = scene;

    /** @type {Array} Tasks currently carried */
    this.inventory = [];

    /** @type {number} Current stamina (0-100) */
    this.stamina = CONFIG.PLAYER_STAMINA_MAX;

    /** @type {boolean} Whether currently sprinting */
    this.isSprinting = false;

    /** @type {boolean} Whether frozen by Chatty Colleague */
    this.isFrozen = false;

    /** @type {number} Current move speed */
    this.currentSpeed = CONFIG.PLAYER_SPEED;

    /** @type {Map<string, number>} Speed modifiers: key -> multiplier */
    this.speedModifiers = new Map();

    /** @type {number} Max task capacity (can be increased by upgrades) */
    this.taskCapacity = CONFIG.PLAYER_TASK_CAPACITY;

    /** @type {number} Pickup radius (can be increased by upgrades) */
    this.pickupRadius = CONFIG.PLAYER_PICKUP_RADIUS;

    /** @type {string} Current sprite variant key */
    this.currentVariant = initialTexture;

    /** @type {string} Current facing direction for animations */
    this.facing = 'south';

    /** @type {boolean} Whether walking (for animation state) */
    this.isMoving = false;

    /** @type {boolean} Whether using real sprite sheets */
    this.hasRealSprites = scene.textures.exists('player-casual');

    /** @type {Phaser.GameObjects.Sprite|null} Paper stack child overlay */
    this.paperStack = null;
  }

  /** Set up physics body, paper stack, and add to scene */
  init() {
    this.scene.add.existing(this);
    this.scene.physics.add.existing(this);

    // Physics body setup — centered within 32x32 sprite
    this.body.setCollideWorldBounds(false);
    const bodySize = 20;
    this.body.setSize(bodySize, bodySize);
    this.body.setOffset(6, 10); // offset slightly down so feet are collision reference

    this.setDepth(10);

    // Ground shadow ellipse (visual grounding — no other object has one)
    this.shadow = this.scene.add.ellipse(this.x, this.y + 10, 24, 10, 0x000000, 0.25);
    this.shadow.setDepth(9);

    // Set initial animation
    if (this.hasRealSprites) {
      this.play(`${this.currentVariant}-idle-south`);
    }

    // Paper stack overlay (child sprite, follows player)
    this.createPaperStack();
  }

  /** Create paper stack child sprite */
  createPaperStack() {
    if (!this.scene.textures.exists('paper-stack')) return;

    this.paperStack = this.scene.add.sprite(this.x, this.y, 'paper-stack', 0);
    this.paperStack.setDepth(11); // Above player
    this.paperStack.setVisible(false);
    // Paper stack is a 128x32 texture, 4 frames of 32x32
    // We'll manually set the crop/frame region
  }

  /** Handle movement input and sprint logic */
  update(time, delta) {
    if (this.isFrozen) {
      this.body.setVelocity(0, 0);
      this.updateAnimation(0, 0);
      this.updateShadow();
      this.updatePaperStack();
      return;
    }

    this.handleSprint(delta);
    this.handleMovement();
    this.updateShadow();
    this.updatePaperStack();
  }

  /** Track shadow position to follow player */
  updateShadow() {
    if (this.shadow) {
      this.shadow.setPosition(this.x, this.y + 10);
    }
  }

  /** Process WASD/arrow key input and set velocity */
  handleMovement() {
    const cursors = this.scene.cursors;
    const wasd = this.scene.wasd;

    let vx = 0;
    let vy = 0;

    if (cursors.left.isDown || wasd.A.isDown) vx = -1;
    else if (cursors.right.isDown || wasd.D.isDown) vx = 1;

    if (cursors.up.isDown || wasd.W.isDown) vy = -1;
    else if (cursors.down.isDown || wasd.S.isDown) vy = 1;

    // Apply sprint multiplier to speed
    let speed = this.currentSpeed;
    if (this.isSprinting && this.stamina > 0) {
      speed *= CONFIG.PLAYER_SPRINT_MULTIPLIER;
    }

    // Normalize diagonal movement
    const velocity = normalizeVelocity(vx, vy, speed);
    this.body.setVelocity(velocity.x, velocity.y);

    // Update animation based on movement direction
    this.updateAnimation(vx, vy);
  }

  /**
   * Update walk/idle animation based on movement input.
   * @param {number} vx - Input direction X (-1, 0, 1)
   * @param {number} vy - Input direction Y (-1, 0, 1)
   */
  updateAnimation(vx, vy) {
    if (!this.hasRealSprites) return;

    const dir = getDirection8(vx, vy);
    const wasMoving = this.isMoving;
    this.isMoving = dir !== null;

    if (dir) {
      this.facing = dir;
    }

    // Determine which animation to play
    const animDir = this.resolveAnimDirection(this.facing);
    const animKey = this.isMoving
      ? `${this.currentVariant}-walk-${animDir}`
      : `${this.currentVariant}-idle-${animDir}`;

    // Only change animation if state changed
    if (this.anims.currentAnim?.key !== animKey) {
      this.play(animKey, true);
    }
  }

  /**
   * Resolve animation direction, falling back to cardinal for executive.
   * The CEO executive sprite only has S, E, N, W (no diagonals).
   * @param {string} dir - 8-direction name
   * @returns {string} - Direction name that has a valid animation
   */
  resolveAnimDirection(dir) {
    // Check if animation exists for this direction
    const testKey = `${this.currentVariant}-idle-${dir}`;
    if (this.scene.anims.exists(testKey)) {
      // For executive, check if the frame actually has content
      // (diagonal columns in the sheet are empty)
      if (this.currentVariant === 'player-executive' && dir.includes('-')) {
        // Map diagonal to nearest cardinal
        const fallbacks = {
          'south-east': 'east',
          'south-west': 'west',
          'north-east': 'east',
          'north-west': 'west',
        };
        return fallbacks[dir] || dir;
      }
      return dir;
    }
    return 'south'; // ultimate fallback
  }

  /**
   * Switch sprite variant when tier changes.
   * @param {string} tier - New tier name (INTERN, ASSOCIATE, etc.)
   */
  switchVariant(tier) {
    const newVariant = TIER_SPRITES[tier];
    if (!newVariant || newVariant === this.currentVariant) return;
    if (!this.scene.textures.exists(newVariant)) {
      console.warn(`[Player] Variant texture ${newVariant} not loaded`);
      return;
    }

    const oldVariant = this.currentVariant;
    this.currentVariant = newVariant;

    // Brief white flash transition effect
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(150, () => {
      this.clearTint();
      // Play idle in current facing direction
      const animDir = this.resolveAnimDirection(this.facing);
      this.play(`${this.currentVariant}-idle-${animDir}`, true);
    });

    console.log(`[Player] sprite variant: ${oldVariant} -> ${newVariant} (tier: ${tier})`);
  }

  /** Update paper stack position and frame based on inventory count */
  updatePaperStack() {
    if (!this.paperStack) return;

    this.paperStack.setPosition(this.x, this.y - 8);

    const count = this.inventory.length;
    if (count === 0) {
      this.paperStack.setVisible(false);
    } else {
      this.paperStack.setVisible(true);
      // frame 0 = empty (unused), 1 = small, 2 = medium, 3 = tall
      let frame;
      if (count <= 2) frame = 1;
      else if (count <= 4) frame = 2;
      else frame = 3;
      // Paper stack is a 128x32 single texture. Set crop to show correct frame.
      this.paperStack.setCrop(frame * 32, 0, 32, 32);
    }
  }

  /** Handle sprint: drain/regen stamina */
  handleSprint(delta) {
    const shiftKey = this.scene.shiftKey;
    const deltaSeconds = delta / 1000;

    if (shiftKey.isDown && this.stamina > 0 && !CONFIG.DEBUG.INFINITE_STAMINA) {
      this.isSprinting = true;
      this.stamina -= CONFIG.PLAYER_STAMINA_DRAIN * deltaSeconds;
      if (this.stamina < 0) this.stamina = 0;
    } else {
      this.isSprinting = false;
      if (this.stamina < CONFIG.PLAYER_STAMINA_MAX && !CONFIG.DEBUG.INFINITE_STAMINA) {
        this.stamina += CONFIG.PLAYER_STAMINA_REGEN * deltaSeconds;
        if (this.stamina > CONFIG.PLAYER_STAMINA_MAX) {
          this.stamina = CONFIG.PLAYER_STAMINA_MAX;
        }
      }
    }

    if (CONFIG.DEBUG.INFINITE_STAMINA) {
      this.stamina = CONFIG.PLAYER_STAMINA_MAX;
      this.isSprinting = shiftKey.isDown;
    }
  }

  /**
   * Try to pick up a task (check capacity, radius).
   * @param {import('./Task.js').Task} task
   * @returns {boolean} Whether pickup succeeded
   */
  tryPickup(task) {
    if (this.inventory.length >= this.taskCapacity) {
      return false;
    }

    const dist = Phaser.Math.Distance.Between(this.x, this.y, task.x, task.y);
    if (dist > this.pickupRadius) {
      return false;
    }

    this.inventory.push(task);
    return true;
  }

  /**
   * Deliver a matching task to a department.
   * @param {string} departmentId
   * @returns {import('./Task.js').Task|null} The delivered task, or null
   */
  deliverTask(departmentId) {
    const index = this.inventory.findIndex(
      (task) => task.getCurrentDepartment() === departmentId
    );
    if (index === -1) return null;

    const task = this.inventory.splice(index, 1)[0];
    return task;
  }

  /**
   * Freeze player for a duration (Chatty Colleague effect).
   * Blocked by Noise-Cancelling AirPods (movement_immunity).
   * @param {number} duration - ms
   */
  freeze(duration) {
    // AirPods: immune to all movement impairment
    if (this.scene.upgradeManager && this.scene.upgradeManager.isActive('noise_cancelling_airpods')) {
      console.debug('[Player] freeze blocked by Noise-Cancelling AirPods');
      return;
    }

    this.isFrozen = true;
    this.body.setVelocity(0, 0);
    this.setTint(0x88aaff); // Visual freeze indicator

    this.scene.time.delayedCall(duration, () => {
      this.isFrozen = false;
      this.clearTint();
    });
  }

  /**
   * Check if player is immune to speed debuffs (Noise-Cancelling AirPods).
   * Called by Micromanager slow effect.
   * @returns {boolean}
   */
  isImmuneToSlow() {
    return this.scene.upgradeManager &&
      this.scene.upgradeManager.isActive('noise_cancelling_airpods');
  }

  /**
   * Apply speed modifier.
   * @param {string} key - Modifier identifier
   * @param {number} multiplier - Speed multiplier (e.g., 0.6 for slow, 1.2 for boost)
   */
  setSpeedModifier(key, multiplier) {
    this.speedModifiers.set(key, multiplier);
    this.recalculateSpeed();
  }

  /** Remove a speed modifier */
  removeSpeedModifier(key) {
    this.speedModifiers.delete(key);
    this.recalculateSpeed();
  }

  /** Recalculate current speed from base + all modifiers */
  recalculateSpeed() {
    let speed = CONFIG.PLAYER_SPEED;
    for (const multiplier of this.speedModifiers.values()) {
      speed *= multiplier;
    }
    this.currentSpeed = speed;
  }
}
