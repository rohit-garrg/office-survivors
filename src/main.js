import Phaser from 'phaser';
import CONFIG from './config/gameConfig.js';
import { BootScene } from './scenes/BootScene.js';
import { TitleScene } from './scenes/TitleScene.js';
import { GameScene } from './scenes/GameScene.js';
import { UIScene } from './scenes/UIScene.js';
import { LevelUpScene } from './scenes/LevelUpScene.js';
import { GameOverScene } from './scenes/GameOverScene.js';
import { HowToPlayScene } from './scenes/HowToPlayScene.js';

const config = {
  type: Phaser.AUTO,
  width: CONFIG.CANVAS_WIDTH,
  height: CONFIG.CANVAS_HEIGHT,
  pixelArt: true,
  backgroundColor: '#1a1a2e',
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
