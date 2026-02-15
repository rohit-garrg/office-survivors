import Phaser from 'phaser';
import CONFIG from './config/gameConfig.js';
import { BootScene } from './scenes/BootScene.js';
import { TitleScene } from './scenes/TitleScene.js';
import { GameScene } from './scenes/GameScene.js';
import { UIScene } from './scenes/UIScene.js';
import { LevelUpScene } from './scenes/LevelUpScene.js';
import { GameOverScene } from './scenes/GameOverScene.js';
import { HowToPlayScene } from './scenes/HowToPlayScene.js';

// Sync #game-container height with actual visible viewport (excludes mobile URL bar)
function syncContainerHeight() {
  const container = document.getElementById('game-container');
  if (container) {
    container.style.height = window.innerHeight + 'px';
  }
}
syncContainerHeight();
window.addEventListener('resize', syncContainerHeight);

const config = {
  type: Phaser.AUTO,
  width: CONFIG.CANVAS_WIDTH,
  height: CONFIG.CANVAS_HEIGHT,
  pixelArt: true,
  backgroundColor: '#1a1a2e',
  parent: 'game-container',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: {
      debug: CONFIG.DEBUG.SHOW_COLLISION_BODIES,
    },
  },
  scene: [BootScene, TitleScene, GameScene, UIScene, LevelUpScene, GameOverScene, HowToPlayScene],
};

const game = new Phaser.Game(config);

export default game;
