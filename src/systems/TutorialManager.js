import CONFIG from '../config/gameConfig.js';
import { isTouchDevice } from '../utils/helpers.js';

/**
 * Direction hint for each department relative to center corridor.
 * Used on first task pickup to orient new players.
 */
const DEPT_HINTS = {
  CEO:         { name: 'CEO Office', color: 'gold',   dir: 'top-left' },
  MARKETING:   { name: 'Marketing',  color: 'orange', dir: 'left side' },
  ENGINEERING: { name: 'Engineering', color: 'blue',   dir: 'bottom-left' },
  FINANCE:     { name: 'Finance',    color: 'green',  dir: 'right side' },
  HR:          { name: 'HR',         color: 'purple', dir: 'bottom-right' },
};

/**
 * TutorialManager: lightweight in-game hints for first-time players.
 *
 * Created by UIScene. Listens to GameScene events.
 * All flags are session-only (reset each new game).
 */
export class TutorialManager {
  /**
   * @param {Phaser.Scene} uiScene - The UIScene instance
   * @param {import('../ui/Toast.js').Toast} toast - Toast instance for showing hints
   */
  constructor(uiScene, toast) {
    this.uiScene = uiScene;
    this.toast = toast;

    // Session flags — prevent repeat hints
    this._shownMoveHint = false;
    this._shownDeliveryHint = false;
    this._shownCapacityHint = false;

    // Idle timer handle (cancelled if player moves)
    this._idleTimer = null;

    const gameScene = uiScene.scene.get('GameScene');
    if (!gameScene) return;

    this.gameScene = gameScene;

    // === Hint A: idle at start (skip on touch — existing tap-to-move toast covers it) ===
    if (!isTouchDevice()) {
      this._idleTimer = gameScene.time.delayedCall(CONFIG.TUTORIAL_IDLE_DELAY, () => {
        if (!this._shownMoveHint) {
          this._shownMoveHint = true;
          this.toast.show('Use WASD or Arrow Keys to move');
        }
      });
    }

    // === Hint B: first task pickup (non-decoy) ===
    this._onTaskPickedUp = (data) => {
      if (this._shownDeliveryHint) return;
      if (data.task.isDecoy) return;

      this._shownDeliveryHint = true;
      const deptId = data.task.getCurrentDepartment();
      const hint = DEPT_HINTS[deptId];
      if (hint) {
        gameScene.time.delayedCall(800, () => {
          this.toast.show(`Deliver to ${hint.name}! (${hint.color} zone, ${hint.dir})`);
        });
      }
    };
    gameScene.events.on('task-picked-up', this._onTaskPickedUp);

    // === Hint C: inventory full ===
    this._onTaskPickupFailed = (data) => {
      if (this._shownCapacityHint) return;
      if (data.reason !== 'capacity') return;

      this._shownCapacityHint = true;
      const cap = data.player.taskCapacity;
      this.toast.show(`Inventory full! Deliver tasks first. (${data.player.inventory.length}/${cap})`);
    };
    gameScene.events.on('task-pickup-failed', this._onTaskPickupFailed);

    console.debug('[TutorialManager] initialized');
  }

  /** Called each frame from UIScene.update(). Cancels idle timer once player moves. */
  update() {
    if (this._shownMoveHint || !this._idleTimer) return;

    const player = this.gameScene?.player;
    if (!player) return;

    // If player has any velocity, they moved — cancel idle hint
    const body = player.body;
    if (body && (Math.abs(body.velocity.x) > 5 || Math.abs(body.velocity.y) > 5)) {
      this._shownMoveHint = true;
      this._idleTimer.remove();
      this._idleTimer = null;
    }
  }

  /** Clean up event listeners */
  destroy() {
    if (this._idleTimer) {
      this._idleTimer.remove();
      this._idleTimer = null;
    }

    const gameScene = this.gameScene;
    if (gameScene) {
      if (this._onTaskPickedUp) {
        gameScene.events.off('task-picked-up', this._onTaskPickedUp);
      }
      if (this._onTaskPickupFailed) {
        gameScene.events.off('task-pickup-failed', this._onTaskPickupFailed);
      }
    }

    console.debug('[TutorialManager] destroyed');
  }
}
