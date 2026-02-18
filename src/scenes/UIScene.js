import Phaser from 'phaser';
import CONFIG from '../config/gameConfig.js';
import { HUD } from '../ui/HUD.js';
import { FloatingText } from '../ui/FloatingText.js';
import { Toast } from '../ui/Toast.js';
import { TutorialManager } from '../systems/TutorialManager.js';
import { DEPARTMENT_COLORS } from '../config/mapData.js';
import { isTouchDevice } from '../utils/helpers.js';

/** Descriptions shown on first spawn of each agent type (toast + info panel) */
const AGENT_INTRO_DESCRIPTIONS = {
  micromanager: 'Follows you around and slows you by 40% when nearby.',
  reply_all_guy: 'Walks to desks and floods the floor with extra tasks.',
  meeting_scheduler: 'Blocks departments so you can\'t deliver there.',
  chatty_colleague: 'Wanders the office and freezes you for 2.5s on contact.',
  slack_pinger: 'Spawns fake tasks that waste a carry slot.',
};

export class UIScene extends Phaser.Scene {
  constructor() {
    super({ key: 'UIScene' });
    console.log('[UIScene] initialized');

    /** @type {Set<string>} Agent types that have already been introduced */
    this._introducedAgents = new Set();
  }

  /** Set up HUD elements and register event listeners */
  create() {
    console.log('[UIScene] create');

    // Reset per-game state (constructor only runs once per scene lifetime)
    this._introducedAgents = new Set();

    this.hud = new HUD(this);
    this.hud.create();

    this.floatingText = new FloatingText(this);
    this.toast = new Toast(this);
    this.tutorialManager = new TutorialManager(this, this.toast);

    // Sprint hint and sound prompt tracking flags
    this._hasShownSprintHint = false;
    this._hasEverSprinted = false;
    this._hasShownSoundPrompt = false;

    // Create a FloatingText on GameScene for world-space text (scrolls with camera)
    const gameScene = this.scene.get('GameScene');
    this.gameFloatingText = new FloatingText(gameScene);

    this.registerEventListeners();

    // Register shutdown lifecycle
    this.events.once('shutdown', this.shutdown, this);
  }

  /** Listen for events from GameScene and update HUD accordingly */
  registerEventListeners() {
    const gameScene = this.scene.get('GameScene');
    if (!gameScene) {
      console.warn('[UIScene] GameScene not found');
      return;
    }

    // Store callback references for proper cleanup in shutdown()
    this._onStressChanged = (data) => {
      this.hud.updateStress(data.percent);
    };

    this._onXPGained = (data) => {
      this.hud.updateXP(data.current, data.needed);
    };

    this._onLevelUp = (data) => {
      this.hud.updateLevel(data.level, data.tier);
    };

    this._onGameTimerTick = (data) => {
      this.hud.updateTimer(data.remaining);
    };

    this._onTaskPickedUp = (data) => {
      const task = data.task;
      const player = data.player;
      const deptColor = DEPARTMENT_COLORS[task.getCurrentDepartment()] || '#ffffff';
      this.gameFloatingText.show(task.taskName, player.x, player.y, deptColor);
    };

    this._onTaskDelivered = (data) => {
      const player = gameScene.player;
      if (player) {
        this.gameFloatingText.show(`+${data.xp} XP`, player.x, player.y, '#44ff44');
      }
    };

    this._onTaskPartialDelivery = (data) => {
      const player = gameScene.player;
      if (player) {
        this.gameFloatingText.show(
          `Stop ${data.currentStop}/${data.totalStops}`,
          player.x, player.y, '#ffaa00'
        );
      }
    };

    this._onUpgradeActivated = (data) => {
      const player = gameScene.player;
      if (player) {
        this.gameFloatingText.show(data.upgrade.name, player.x, player.y, '#FFD700');
      }
    };

    this._onUpgradeExpired = (data) => {
      if (data.upgrade) {
        const player = gameScene.player;
        if (player) {
          this.gameFloatingText.show(`${data.upgrade.name} expired`, player.x, player.y, '#ff4444');
        }
      }
    };

    this._onUpgradeCapacityChanged = (data) => {
      this.hud.updateTaskCapacity(data.capacity);
    };

    this._onMilestoneBonus = (data) => {
      const player = gameScene.player;
      if (player) {
        const multText = data.xpMultiplier ? `${data.xpMultiplier.toFixed(1)}x` : '+XP';
        if (data.isIPOBell) {
          this.gameFloatingText.show('IPO BELL!', player.x, player.y - 20, '#FFD700');
          this.gameFloatingText.show(
            `CEO Perk: ${multText} XP Multiplier`,
            player.x, player.y, '#FFD700'
          );
        } else {
          this.gameFloatingText.show(
            `CEO Perk: ${multText} XP Multiplier`,
            player.x, player.y, '#FFD700'
          );
        }
      }
    };

    this._onAgentSpawned = (data) => {
      const player = gameScene.player;
      if (player) {
        this.gameFloatingText.show(
          `${data.name} appeared!`,
          player.x, player.y, '#ff4444'
        );

        // First-spawn intro: show toast with name + description
        const agentType = data.type;
        if (agentType && !this._introducedAgents.has(agentType) && AGENT_INTRO_DESCRIPTIONS[agentType]) {
          this._introducedAgents.add(agentType);
          this.toast.show(
            `${data.name}: ${AGENT_INTRO_DESCRIPTIONS[agentType]}`,
            { duration: 5000 }
          );
        }
      }
    };

    this._onAgentDisruption = (data) => {
      const player = gameScene.player;
      if (!player) return;

      let text = '';
      let color = '#ff4444';
      switch (data.effect) {
        case 'slow':
          text = 'MICROMANAGED!';
          break;
        case 'freeze':
          text = 'TRAPPED IN CHAT!';
          color = '#ff69b4';
          break;
        case 'task_burst':
          text = 'REPLY-ALL EXPLOSION!';
          color = '#ffff00';
          break;
        case 'department_blocked':
          text = 'MEETING CALLED!';
          color = '#888888';
          break;
        case 'decoy_spawned':
          text = '*ping*';
          color = '#ff8c00';
          break;
        case 'decoy_picked_up':
          text = 'FAKE TASK! +2% Stress';
          color = '#ff8c00';
          break;
        default:
          return;
      }
      this.gameFloatingText.show(text, player.x, player.y, color);
    };

    this._onDeptBlocked = (data) => {
      this.hud.showDeptBlocked(data.department);
    };

    this._onDeptUnblocked = (data) => {
      this.hud.hideDeptBlocked(data.department);
    };

    // === Pressure bonus floating text ===
    this._onPressureBonus = (data) => {
      const player = gameScene.player;
      if (player && data.reasons && data.reasons.length > 0) {
        const text = data.reasons.join(' + ') + ` (${data.multiplier.toFixed(1)}x)`;
        this.gameFloatingText.show(text, player.x, player.y - 20, '#ff9900');
      }
    };
    gameScene.events.on('pressure-bonus', this._onPressureBonus);

    // === Water cooler floating text feedback ===
    this._onWaterCoolerUsed = (data) => {
      const player = gameScene.player;
      if (player) {
        this.gameFloatingText.show(
          `-${data.stressRelief}% Stress`,
          player.x, player.y, '#44ccff'
        );
        gameScene.time.delayedCall(200, () => {
          if (player) {
            this.gameFloatingText.show(
              `+${data.staminaRestore} Stamina`,
              player.x, player.y + 20, '#44ccff'
            );
          }
        });
      }
    };

    // === Sprint hint toast: show when stress hits threshold and player hasn't sprinted ===
    this._onShiftDown = () => {
      this._hasEverSprinted = true;
    };
    if (gameScene.input && gameScene.input.keyboard) {
      gameScene.input.keyboard.on('keydown-SHIFT', this._onShiftDown);
    }

    this._onStressForHint = (data) => {
      if (!this._hasShownSprintHint &&
          !this._hasEverSprinted &&
          data.percent >= CONFIG.SPRINT_HINT_STRESS_THRESHOLD) {
        this._hasShownSprintHint = true;
        const sprintMsg = isTouchDevice() ? 'Hold the RUN button to sprint!' : 'Hold SHIFT to sprint!';
        this.toast.show(sprintMsg);
      }
    };
    gameScene.events.on('stress-changed', this._onStressForHint);

    // === Mobile onboarding toast ===
    if (isTouchDevice()) {
      gameScene.time.delayedCall(2000, () => {
        this.toast.show('Use the joystick to move. Hold RUN to sprint!');
      });
    }

    // === Sound prompt toast: 5s after game start, if sound is muted ===
    this._soundPromptTimer = gameScene.time.delayedCall(CONFIG.SOUND_PROMPT_DELAY, () => {
      if (this._hasShownSoundPrompt) return;

      const soundManager = gameScene.soundManager;
      const isMuted = !soundManager ||
                      !soundManager.initialized ||
                      soundManager.muted ||
                      (soundManager.ctx && soundManager.ctx.state === 'suspended');

      if (isMuted) {
        this._hasShownSoundPrompt = true;
        const soundMsg = isTouchDevice()
          ? 'Play with sound for the best experience!'
          : 'Play with sound for the best experience! Press M to toggle.';
        this.toast.show(soundMsg);
      }
    });

    // Register all listeners
    gameScene.events.on('stress-changed', this._onStressChanged);
    gameScene.events.on('xp-gained', this._onXPGained);
    gameScene.events.on('level-up', this._onLevelUp);
    gameScene.events.on('game-timer-tick', this._onGameTimerTick);
    gameScene.events.on('task-picked-up', this._onTaskPickedUp);
    gameScene.events.on('task-delivered', this._onTaskDelivered);
    gameScene.events.on('task-partial-delivery', this._onTaskPartialDelivery);
    gameScene.events.on('upgrade-activated', this._onUpgradeActivated);
    gameScene.events.on('upgrade-expired', this._onUpgradeExpired);
    gameScene.events.on('upgrade-capacity-changed', this._onUpgradeCapacityChanged);
    gameScene.events.on('milestone-bonus', this._onMilestoneBonus);
    gameScene.events.on('agent-spawned', this._onAgentSpawned);
    gameScene.events.on('agent-disruption', this._onAgentDisruption);
    gameScene.events.on('department-blocked', this._onDeptBlocked);
    gameScene.events.on('department-unblocked', this._onDeptUnblocked);
    gameScene.events.on('water-cooler-used', this._onWaterCoolerUsed);
  }

  /** Update HUD elements each frame (stamina, task indicators, upgrades) */
  update(time, delta) {
    const gameScene = this.scene.get('GameScene');
    if (!gameScene || !gameScene.player) return;

    const player = gameScene.player;

    // Update stamina bar every frame
    this.hud.updateStamina(player.stamina, CONFIG.PLAYER_STAMINA_MAX);

    // Update task indicators every frame
    this.hud.updateTasks(player.inventory);

    // Update tutorial hints
    if (this.tutorialManager) {
      this.tutorialManager.update();
    }

    // Update active upgrade indicators
    if (gameScene.upgradeManager) {
      const activeUpgrades = gameScene.upgradeManager.getActiveUpgradesList();
      this.hud.updateUpgrades(activeUpgrades);
    }
  }

  /** Clean up event listeners (removes only UIScene's callbacks, not other systems') */
  shutdown() {
    const gameScene = this.scene.get('GameScene');
    if (gameScene) {
      gameScene.events.off('stress-changed', this._onStressChanged);
      gameScene.events.off('xp-gained', this._onXPGained);
      gameScene.events.off('level-up', this._onLevelUp);
      gameScene.events.off('game-timer-tick', this._onGameTimerTick);
      gameScene.events.off('task-picked-up', this._onTaskPickedUp);
      gameScene.events.off('task-delivered', this._onTaskDelivered);
      gameScene.events.off('task-partial-delivery', this._onTaskPartialDelivery);
      gameScene.events.off('upgrade-activated', this._onUpgradeActivated);
      gameScene.events.off('upgrade-expired', this._onUpgradeExpired);
      gameScene.events.off('upgrade-capacity-changed', this._onUpgradeCapacityChanged);
      gameScene.events.off('milestone-bonus', this._onMilestoneBonus);
      gameScene.events.off('agent-spawned', this._onAgentSpawned);
      gameScene.events.off('agent-disruption', this._onAgentDisruption);
      gameScene.events.off('department-blocked', this._onDeptBlocked);
      gameScene.events.off('department-unblocked', this._onDeptUnblocked);
      gameScene.events.off('water-cooler-used', this._onWaterCoolerUsed);
      gameScene.events.off('pressure-bonus', this._onPressureBonus);

      // Sprint hint cleanup
      gameScene.events.off('stress-changed', this._onStressForHint);
      if (this._onShiftDown && gameScene.input && gameScene.input.keyboard) {
        gameScene.input.keyboard.off('keydown-SHIFT', this._onShiftDown);
      }

      // Sound prompt cleanup
      if (this._soundPromptTimer) {
        this._soundPromptTimer.remove();
      }
    }

    // Tutorial cleanup
    if (this.tutorialManager) {
      this.tutorialManager.destroy();
    }

    // Toast cleanup
    if (this.toast) {
      this.toast.destroy();
    }
  }
}
