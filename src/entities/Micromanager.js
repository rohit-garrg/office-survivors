import { ChaosAgent } from './ChaosAgent.js';
import CONFIG from '../config/gameConfig.js';
import Phaser from 'phaser';

/**
 * The Micromanager: follows the player and slows them down when in range.
 *
 * - Moves toward player at MICROMANAGER_SPEED (110 px/s)
 * - Within MICROMANAGER_RANGE (80px): player speed * MICROMANAGER_SLOW_FACTOR (0.6)
 * - Effect ends immediately when player moves out of range
 * - Counterplay: sprint away (player sprint speed > Micromanager speed)
 */
export class Micromanager extends ChaosAgent {
  constructor(scene, x, y) {
    const texture = scene.textures.exists('agent-micromanager') ? 'agent-micromanager' : 'agent_micromanager';
    super(scene, x, y, texture, 'micromanager');
    this.speed = CONFIG.MICROMANAGER_SPEED;
    this.animPrefix = scene.textures.exists('agent-micromanager') ? 'micromanager' : null;

    // Education properties
    this.displayName = 'Micromanager';
    this.description = 'Follows you. Slows speed to 60% when near. Sprint to escape.';
    this.speechLines = [
      'Let me check on that...',
      'Quick status update?',
      'I need visibility on this.',
      'Can you cc me on that?',
      'Just circling back...',
      'Where are we on this?',
    ];

    /** @type {boolean} Whether slow aura is currently applied */
    this._slowActive = false;
  }

  /** Follow player, apply/remove slow aura based on distance */
  update(time, delta) {
    if (!this.isActive) return;

    // Always target the player (use updateTargetPosition to preserve stuck detection)
    const player = this.scene.player;
    if (player) {
      this.updateTargetPosition(player.x, player.y);
    }

    // Base movement (handles stuck detection, idle, etc.)
    super.update(time, delta);

    // Check slow aura
    if (this.isPlayerInRange()) {
      this.applySlowAura();
      // Stress while slowed: being micromanaged is stressful
      if (this._slowActive) {
        const stressManager = this.scene.stressManager;
        if (stressManager) {
          const stressAmount = CONFIG.MICROMANAGER_STRESS_RATE * (delta / 1000);
          stressManager.addInstantStress(stressAmount, 'micromanager-slow');
        }
      }
    } else {
      this.removeSlowAura();
    }
  }

  /** Don't clear target on arrival — keep chasing player */
  onArrived() {
    // Do nothing; keep following
  }

  /**
   * Check if player is within slow aura range.
   * @returns {boolean}
   */
  isPlayerInRange() {
    const player = this.scene.player;
    if (!player) return false;
    const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
    return dist <= CONFIG.MICROMANAGER_RANGE;
  }

  /** Apply the slow debuff to the player */
  applySlowAura() {
    if (this._slowActive) return;
    const player = this.scene.player;
    if (!player) return;

    // AirPods: immune to slow
    if (player.isImmuneToSlow()) {
      return;
    }

    this._slowActive = true;
    player.setSpeedModifier('micromanager_slow', CONFIG.MICROMANAGER_SLOW_FACTOR);
    player.setTint(0xff8888); // Red tint = slowed

    this.scene.events.emit('agent-disruption', {
      type: 'micromanager',
      effect: 'slow',
      position: { x: this.x, y: this.y },
    });

    console.debug('[Micromanager] slow aura applied');
  }

  /** Remove the slow debuff from the player */
  removeSlowAura() {
    if (!this._slowActive) return;

    this._slowActive = false;
    const player = this.scene.player;
    if (player) {
      player.removeSpeedModifier('micromanager_slow');
      player.clearTint();
    }

    console.debug('[Micromanager] slow aura removed');
  }

  /** Clean up slow on deactivation */
  deactivate() {
    this.removeSlowAura();
    super.deactivate();
  }
}
