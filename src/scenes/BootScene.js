import Phaser from 'phaser';
import CONFIG from '../config/gameConfig.js';
import { DEPARTMENTS, DEPARTMENT_COLORS } from '../config/mapData.js';

/**
 * BootScene: loads real sprite assets, generates programmatic textures,
 * and provides fallback placeholders for any missing files.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
    console.log('[BootScene] initialized');
  }

  preload() {
    console.log('[BootScene] preload - loading assets');

    // === Loading bar ===
    const cx = this.cameras.main.width / 2;
    const cy = this.cameras.main.height / 2;
    const barW = 320;
    const barH = 24;

    const barBg = this.add.rectangle(cx, cy, barW, barH, 0x333333);
    const barFill = this.add.rectangle(cx - barW / 2 + 2, cy, 0, barH - 4, 0x4169E1).setOrigin(0, 0.5);
    const loadText = this.add.text(cx, cy - 30, 'Loading...', {
      fontSize: '16px', fontFamily: 'monospace', color: '#aaaaaa',
    }).setOrigin(0.5);

    this.load.on('progress', (value) => {
      barFill.width = (barW - 4) * value;
    });
    this.load.on('complete', () => {
      barBg.destroy();
      barFill.destroy();
      loadText.destroy();
    });

    // === Character sprite sheets ===
    // Player (8-dir): 256x160, 8 cols x 5 rows, 32x32 frames
    this.load.spritesheet('player-casual', 'assets/sprites/player-casual.png', { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('player-business', 'assets/sprites/player-business.png', { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('player-executive', 'assets/sprites/player-executive.png', { frameWidth: 32, frameHeight: 32 });

    // Agents (4-dir): 128x160, 4 cols x 5 rows, 32x32 frames
    this.load.spritesheet('agent-micromanager', 'assets/sprites/agent-micromanager.png', { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('agent-replyall', 'assets/sprites/agent-replyall.png', { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('agent-meeting', 'assets/sprites/agent-meeting.png', { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('agent-chatty', 'assets/sprites/agent-chatty.png', { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('agent-slack', 'assets/sprites/agent-slack.png', { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('agent-assistant', 'assets/sprites/assistant.png', { frameWidth: 32, frameHeight: 32 });

    // === Tileset ===
    this.load.image('tileset', 'assets/tiles/floor-wall-tileset-80x96.png');

    // === Furniture ===
    this.load.image('furniture-desk-monitor', 'assets/furniture/desk-with-monitor-32x32.png');
    this.load.image('furniture-desk-items', 'assets/furniture/desk-with-items-32x32.png');
    this.load.image('furniture-desk-boss', 'assets/furniture/desk-boss-32x32.png');
    this.load.image('furniture-desk-corner', 'assets/furniture/desk-corner-64x64.png');
    this.load.image('furniture-desk-long', 'assets/furniture/desk-long-64x64.png');
    this.load.image('furniture-printer-large', 'assets/furniture/printer-large-32x32.png');
    this.load.image('furniture-printer-modern', 'assets/furniture/printer-modern-32x32.png');
    this.load.image('furniture-filing-cabinet', 'assets/furniture/filing-cabinet-large-32x32.png');
    this.load.image('furniture-filing-tall', 'assets/furniture/filing-cabinet-tall-32x32.png');
    this.load.image('furniture-filing-wide', 'assets/furniture/filing-cabinet-wide-32x32.png');
    this.load.image('furniture-bookshelf', 'assets/furniture/bookshelf-tall-32x32.png');
    this.load.image('furniture-chair', 'assets/furniture/chair-swivel-a-32x32.png');
    this.load.image('furniture-chair-boss', 'assets/furniture/chair-boss-32x32.png');
    this.load.image('furniture-computer', 'assets/furniture/computer-desktop-32x32.png');
    this.load.image('furniture-table-round', 'assets/furniture/table-round-32x32.png');
    this.load.image('furniture-sofa', 'assets/furniture/sofa-small-32x32.png');

    // === Environment ===
    this.load.image('env-plant-large', 'assets/environment/plant-large-32x32.png');
    this.load.image('env-plant-small', 'assets/environment/plant-small-16x16.png');
    this.load.image('env-water-cooler', 'assets/environment/water-cooler-32x64.png');
    this.load.image('env-water-dispenser', 'assets/environment/water-dispenser-32x32.png');
    this.load.image('env-coffee-machine', 'assets/environment/coffee-machine-16x16.png');
    this.load.image('env-vending-machine', 'assets/environment/vending-machine-32x32.png');
    this.load.image('env-box-closed', 'assets/environment/box-closed-32x32.png');

    // === Decor ===
    this.load.image('decor-whiteboard', 'assets/decor/whiteboard-chart-32x32.png');
    this.load.image('decor-notice-board', 'assets/decor/notice-board-32x32.png');
    this.load.image('decor-calendar', 'assets/decor/calendar-32x32.png');
    this.load.image('decor-documents', 'assets/decor/documents-stack-32x32.png');
    this.load.image('decor-documents-blue', 'assets/decor/documents-blue-32x32.png');
    this.load.image('decor-wall-clock', 'assets/decor/wall-clock-16x16.png');
    this.load.image('decor-wall-graph', 'assets/decor/wall-graph-16x16.png');
    this.load.image('decor-wall-note', 'assets/decor/wall-note-16x16.png');
    this.load.image('decor-wall-shelf', 'assets/decor/wall-shelf-16x16.png');
    this.load.image('decor-books', 'assets/decor/books-16x16.png');
    this.load.image('decor-papers', 'assets/decor/papers-16x16.png');
    this.load.image('decor-folders', 'assets/decor/folders-16x16.png');
    this.load.image('decor-trash-bin', 'assets/decor/trash-bin-16x16.png');
  }

  create() {
    console.log('[BootScene] create - generating textures');

    // === Generate programmatic textures ===

    // --- Placeholder fallbacks (kept for safety) ---

    // Player placeholder (used if spritesheet fails to load)
    const playerGfx = this.make.graphics({ add: false });
    playerGfx.fillStyle(0x4169E1, 1);
    playerGfx.fillRect(0, 0, 32, 32);
    playerGfx.fillStyle(0xffffff, 1);
    playerGfx.fillRect(6, 6, 20, 20);
    playerGfx.generateTexture('player', 32, 32);
    playerGfx.destroy();

    // Department zone textures (semi-transparent colored areas)
    for (const dept of DEPARTMENTS) {
      const gfx = this.make.graphics({ add: false });
      const color = parseInt(dept.color.replace('#', ''), 16);
      gfx.fillStyle(color, 0.3);
      gfx.fillRect(0, 0, 32, 32);
      gfx.lineStyle(2, color, 0.6);
      gfx.strokeRect(0, 0, 32, 32);
      gfx.generateTexture(`zone_${dept.id}`, 32, 32);
      gfx.destroy();
    }

    // --- Task document icons (16x16) ---
    const deptIds = Object.keys(DEPARTMENT_COLORS);
    for (const id of deptIds) {
      const color = parseInt(DEPARTMENT_COLORS[id].replace('#', ''), 16);
      this.generateTaskIcon(`task_${id}`, color, 1);
      this.generateTaskIcon(`task_decoy_${id}`, color, 0.5);
    }

    // --- Wall placeholder (used when tileset unavailable) ---
    const wallGfx = this.make.graphics({ add: false });
    wallGfx.fillStyle(0x444444, 1);
    wallGfx.fillRect(0, 0, 32, 32);
    wallGfx.lineStyle(1, 0x333333, 1);
    wallGfx.strokeRect(0, 0, 32, 32);
    wallGfx.generateTexture('wall', 32, 32);
    wallGfx.destroy();

    // --- Obstacle placeholders ---
    const deskGfx = this.make.graphics({ add: false });
    deskGfx.fillStyle(0x8B6914, 1);
    deskGfx.fillRect(0, 0, 32, 32);
    deskGfx.lineStyle(1, 0x6B4F12, 1);
    deskGfx.strokeRect(0, 0, 32, 32);
    deskGfx.generateTexture('desk', 32, 32);
    deskGfx.destroy();

    const printerGfx = this.make.graphics({ add: false });
    printerGfx.fillStyle(0x999999, 1);
    printerGfx.fillRect(0, 0, 32, 32);
    printerGfx.lineStyle(1, 0x777777, 1);
    printerGfx.strokeRect(0, 0, 32, 32);
    printerGfx.generateTexture('printer', 32, 32);
    printerGfx.destroy();

    const tableGfx = this.make.graphics({ add: false });
    tableGfx.fillStyle(0x7B5B14, 1);
    tableGfx.fillRect(0, 0, 32, 32);
    tableGfx.lineStyle(1, 0x5B4112, 1);
    tableGfx.strokeRect(0, 0, 32, 32);
    tableGfx.generateTexture('table', 32, 32);
    tableGfx.destroy();

    // --- Agent placeholders (kept as fallback) ---
    const agentColors = {
      micromanager: 0xFF0000,
      replyallguy: 0xFFFF00,
      meetingscheduler: 0x888888,
      chattycolleague: 0xFF69B4,
      slackpinger: 0xFF8C00,
    };
    for (const [key, color] of Object.entries(agentColors)) {
      const gfx = this.make.graphics({ add: false });
      gfx.fillStyle(color, 1);
      gfx.fillRect(0, 0, 24, 24);
      gfx.generateTexture(`agent_${key}`, 24, 24);
      gfx.destroy();
    }

    // Assistant placeholder
    const assistGfx = this.make.graphics({ add: false });
    assistGfx.fillStyle(0x22cc44, 1);
    assistGfx.fillRect(0, 0, 24, 24);
    assistGfx.fillStyle(0xffffff, 1);
    assistGfx.fillRect(4, 4, 16, 16);
    assistGfx.generateTexture('assistant_placeholder', 24, 24);
    assistGfx.destroy();

    // Floor tile (light beige)
    const floorGfx = this.make.graphics({ add: false });
    floorGfx.fillStyle(0xF5F0E8, 1);
    floorGfx.fillRect(0, 0, 32, 32);
    floorGfx.generateTexture('floor', 32, 32);
    floorGfx.destroy();

    // Particle texture: 4x4 white filled circle
    const particleGfx = this.make.graphics({ add: false });
    particleGfx.fillStyle(0xffffff, 1);
    particleGfx.fillCircle(2, 2, 2);
    particleGfx.generateTexture('particle', 4, 4);
    particleGfx.destroy();

    // --- Paper stack overlay (32x32 sprite sheet, 4 frames: 128x32) ---
    this.generatePaperStack();

    // --- Motivational posters (32x32 each) ---
    this.generatePosters();

    // === Register animations ===
    this.registerPlayerAnimations();
    this.registerAgentAnimations();

    console.log('[BootScene] all assets loaded and textures generated');
    this.scene.start('TitleScene');
  }

  /**
   * Generate a task document icon with folded corner.
   * @param {string} key - Texture key
   * @param {number} color - Fill color
   * @param {number} alpha - Opacity (1 = normal, 0.5 = decoy)
   */
  generateTaskIcon(key, color, alpha) {
    const gfx = this.make.graphics({ add: false });
    const canvas = 24; // Enlarged from 16 to 24 for glow halo
    const s = 16;      // Document icon size stays 16x16
    const fold = 4;
    const ox = (canvas - s) / 2; // Offset to center 16x16 doc in 24x24 canvas
    const oy = (canvas - s) / 2;

    // Glow halo behind the document
    gfx.fillStyle(color, alpha * CONFIG.TASK_GLOW_ALPHA);
    gfx.fillCircle(canvas / 2, canvas / 2, 11);

    // Document body
    gfx.fillStyle(0xffffff, alpha);
    gfx.beginPath();
    gfx.moveTo(ox + 1, oy + 1);
    gfx.lineTo(ox + s - fold - 1, oy + 1);
    gfx.lineTo(ox + s - 1, oy + fold + 1);
    gfx.lineTo(ox + s - 1, oy + s - 1);
    gfx.lineTo(ox + 1, oy + s - 1);
    gfx.closePath();
    gfx.fillPath();

    // Folded corner triangle
    gfx.fillStyle(color, alpha);
    gfx.beginPath();
    gfx.moveTo(ox + s - fold - 1, oy + 1);
    gfx.lineTo(ox + s - 1, oy + fold + 1);
    gfx.lineTo(ox + s - fold - 1, oy + fold + 1);
    gfx.closePath();
    gfx.fillPath();

    // Color stripe (department identifier)
    gfx.fillStyle(color, alpha);
    gfx.fillRect(ox + 3, oy + 6, 10, 2);
    gfx.fillRect(ox + 3, oy + 10, 7, 2);

    // Document border
    gfx.lineStyle(1, color, alpha * 0.8);
    gfx.beginPath();
    gfx.moveTo(ox + 1, oy + 1);
    gfx.lineTo(ox + s - fold - 1, oy + 1);
    gfx.lineTo(ox + s - 1, oy + fold + 1);
    gfx.lineTo(ox + s - 1, oy + s - 1);
    gfx.lineTo(ox + 1, oy + s - 1);
    gfx.closePath();
    gfx.strokePath();

    gfx.generateTexture(key, canvas, canvas);
    gfx.destroy();
  }

  /** Generate paper stack overlay: 4-frame spritesheet (128x32) */
  generatePaperStack() {
    const gfx = this.make.graphics({ add: false });
    const frameW = 32;
    const frameH = 32;

    // Frame 0: empty (transparent) — no drawing needed

    // Frame 1: small stack (2-3 papers) — centered at bottom of frame
    const f1x = frameW;
    gfx.fillStyle(0xffffff, 0.9);
    gfx.fillRect(f1x + 10, 20, 14, 2);
    gfx.lineStyle(1, 0xcccccc, 0.7);
    gfx.strokeRect(f1x + 10, 20, 14, 2);
    gfx.fillStyle(0xffffff, 0.95);
    gfx.fillRect(f1x + 9, 18, 14, 2);
    gfx.lineStyle(1, 0xbbbbbb, 0.7);
    gfx.strokeRect(f1x + 9, 18, 14, 2);

    // Frame 2: medium stack (4-5 papers)
    const f2x = frameW * 2;
    for (let i = 0; i < 4; i++) {
      const offset = (i % 2 === 0) ? 0 : 1;
      gfx.fillStyle(0xffffff, 0.85 + i * 0.03);
      gfx.fillRect(f2x + 8 + offset, 22 - i * 2, 16, 2);
      gfx.lineStyle(1, 0xbbbbbb, 0.6);
      gfx.strokeRect(f2x + 8 + offset, 22 - i * 2, 16, 2);
    }

    // Frame 3: tall wobbly stack (6+ papers, one sliding off)
    const f3x = frameW * 3;
    for (let i = 0; i < 6; i++) {
      const offset = Math.sin(i * 0.8) * 2;
      gfx.fillStyle(0xffffff, 0.8 + i * 0.03);
      gfx.fillRect(f3x + 7 + offset, 22 - i * 2, 18, 2);
      gfx.lineStyle(1, 0xaaaaaa, 0.6);
      gfx.strokeRect(f3x + 7 + offset, 22 - i * 2, 18, 2);
    }
    // Sliding paper
    gfx.fillStyle(0xffffff, 0.7);
    gfx.save();
    gfx.fillRect(f3x + 20, 16, 10, 2);
    gfx.restore();

    gfx.generateTexture('paper-stack', frameW * 4, frameH);
    gfx.destroy();
  }

  /** Generate motivational poster wall decorations (32x32 each) */
  generatePosters() {
    const posterConfigs = [
      { key: 'poster-1', frameColor: 0xcc3333, innerColor: 0xff6666 },
      { key: 'poster-2', frameColor: 0x3366cc, innerColor: 0x6699ff },
      { key: 'poster-3', frameColor: 0xccaa00, innerColor: 0xffdd44 },
      { key: 'poster-4', frameColor: 0x33aa33, innerColor: 0x66dd66 },
    ];

    for (const cfg of posterConfigs) {
      const gfx = this.make.graphics({ add: false });
      // Frame border
      gfx.fillStyle(cfg.frameColor, 1);
      gfx.fillRect(2, 2, 28, 28);
      // Inner area
      gfx.fillStyle(cfg.innerColor, 0.6);
      gfx.fillRect(5, 5, 22, 22);
      // Abstract shape (varies per poster)
      gfx.fillStyle(0xffffff, 0.5);
      if (cfg.key === 'poster-1') {
        gfx.fillTriangle(16, 8, 10, 22, 22, 22);
      } else if (cfg.key === 'poster-2') {
        gfx.fillCircle(16, 16, 8);
      } else if (cfg.key === 'poster-3') {
        gfx.fillRect(10, 10, 12, 12);
      } else {
        gfx.fillStyle(0xffffff, 0.4);
        gfx.fillRect(8, 14, 16, 3);
        gfx.fillRect(14, 8, 3, 16);
      }
      gfx.generateTexture(cfg.key, 32, 32);
      gfx.destroy();
    }
  }

  /**
   * Register walk cycle animations for all 3 player variants.
   *
   * Sprite sheet layout (8 cols x 5 rows):
   *   Col 0=S, 1=SE, 2=E, 3=NE, 4=N, 5=NW, 6=W, 7=SW
   *   Row 0=idle, Rows 1-4=walk frames
   *
   * Frame index = row * 8 + col (for 8-dir sheets)
   *
   * The CEO executive sprite only has 4 cardinal directions
   * (cols 0,2,4,6). Diagonal anims fall back to nearest cardinal.
   */
  registerPlayerAnimations() {
    const variants = ['player-casual', 'player-business', 'player-executive'];
    // Direction name -> column index in sprite sheet
    const dirCols8 = { south: 0, 'south-east': 1, east: 2, 'north-east': 3, north: 4, 'north-west': 5, west: 6, 'south-west': 7 };
    const cols = 8;

    for (const variant of variants) {
      // Check if texture loaded
      if (!this.textures.exists(variant)) {
        console.warn(`[BootScene] Texture ${variant} not loaded, skipping animations`);
        continue;
      }

      for (const [dir, col] of Object.entries(dirCols8)) {
        // Idle animation (single frame)
        this.anims.create({
          key: `${variant}-idle-${dir}`,
          frames: [{ key: variant, frame: col }],
          frameRate: 1,
        });

        // Walk animation (4 frames)
        const walkFrames = [];
        for (let row = 1; row <= 4; row++) {
          walkFrames.push({ key: variant, frame: row * cols + col });
        }
        this.anims.create({
          key: `${variant}-walk-${dir}`,
          frames: walkFrames,
          frameRate: 8,
          repeat: -1,
        });
      }
    }
  }

  /**
   * Register walk cycle animations for NPC characters (4-direction).
   *
   * Sprite sheet layout (4 cols x 5 rows):
   *   Col 0=S, 1=E, 2=N, 3=W
   *   Row 0=idle, Rows 1-4=walk frames
   */
  registerAgentAnimations() {
    const agents = [
      { sheet: 'agent-micromanager', prefix: 'micromanager' },
      { sheet: 'agent-replyall', prefix: 'replyall' },
      { sheet: 'agent-meeting', prefix: 'meeting' },
      { sheet: 'agent-chatty', prefix: 'chatty' },
      { sheet: 'agent-slack', prefix: 'slack' },
      { sheet: 'agent-assistant', prefix: 'assistant' },
    ];
    const dirCols4 = { south: 0, east: 1, north: 2, west: 3 };
    const cols = 4;

    for (const agent of agents) {
      if (!this.textures.exists(agent.sheet)) {
        console.warn(`[BootScene] Texture ${agent.sheet} not loaded, skipping animations`);
        continue;
      }

      for (const [dir, col] of Object.entries(dirCols4)) {
        // Idle
        this.anims.create({
          key: `${agent.prefix}-idle-${dir}`,
          frames: [{ key: agent.sheet, frame: col }],
          frameRate: 1,
        });

        // Walk
        const walkFrames = [];
        for (let row = 1; row <= 4; row++) {
          walkFrames.push({ key: agent.sheet, frame: row * cols + col });
        }
        this.anims.create({
          key: `${agent.prefix}-walk-${dir}`,
          frames: walkFrames,
          frameRate: 8,
          repeat: -1,
        });
      }
    }
  }
}
