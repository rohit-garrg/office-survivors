/**
 * Generate OG image (1200x630) from game sprites.
 * Creates a pixel-art scene with game characters and office elements.
 *
 * Usage: node scripts/generate-og-image.js
 * Output: public/og-image.png
 */
import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.join(__dirname, '..', 'public', 'assets');
const OUT = path.join(__dirname, '..', 'public', 'og-image.png');

const W = 1200;
const H = 630;
const SCALE = 3; // Scale pixel art 3x for OG image

// Department colors
const DEPT_COLORS = {
  CEO:         { r: 255, g: 215, b: 0 },
  MARKETING:   { r: 255, g: 140, b: 0 },
  ENGINEERING: { r: 65,  g: 105, b: 225 },
  FINANCE:     { r: 46,  g: 139, b: 87 },
  HR:          { r: 139, g: 92,  b: 246 },
};

/** Extract a 32x32 frame from a sprite sheet */
async function extractFrame(file, col, row) {
  return sharp(path.join(ASSETS, file))
    .extract({ left: col * 32, top: row * 32, width: 32, height: 32 })
    .resize(32 * SCALE, 32 * SCALE, { kernel: 'nearest' })
    .toBuffer();
}

/** Extract a raw tile from a sprite sheet at given size */
async function extractTile(file, x, y, w, h) {
  return sharp(path.join(ASSETS, file))
    .extract({ left: x, top: y, width: w, height: h })
    .toBuffer();
}

/** Load and scale a 32x32 asset */
async function loadAsset(file) {
  return sharp(path.join(ASSETS, file))
    .resize(32 * SCALE, 32 * SCALE, { kernel: 'nearest' })
    .toBuffer();
}

/** Create a colored rectangle */
function colorRect(w, h, r, g, b, a = 255) {
  return sharp({
    create: { width: w, height: h, channels: 4, background: { r, g, b, alpha: a / 255 } }
  }).png().toBuffer();
}

/** Create text as SVG rendered to PNG */
function textImage(text, fontSize, color = '#FFFFFF', fontWeight = 'bold') {
  const svgW = text.length * fontSize * 0.65;
  const svgH = fontSize * 1.4;
  const svg = `<svg width="${Math.ceil(svgW)}" height="${Math.ceil(svgH)}" xmlns="http://www.w3.org/2000/svg">
    <text x="0" y="${fontSize}" font-family="monospace, 'Courier New'" font-size="${fontSize}" font-weight="${fontWeight}" fill="${color}">${text}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function main() {
  console.log('[OG Image] Generating 1200x630 OG image...');

  const composites = [];

  // === BACKGROUND ===
  // Dark office background
  const bg = await colorRect(W, H, 26, 26, 46); // #1a1a2e

  // Floor area (warm grey)
  composites.push({
    input: await colorRect(W - 80, H - 160, 62, 58, 52),
    left: 40, top: 120,
  });

  // Department zones (colored strips at edges)
  const zoneH = 80;
  const zoneW = 140;
  // Left side departments
  composites.push({
    input: await colorRect(zoneW, zoneH, ...Object.values(DEPT_COLORS.CEO), 180),
    left: 40, top: 130,
  });
  composites.push({
    input: await colorRect(zoneW, zoneH, ...Object.values(DEPT_COLORS.MARKETING), 180),
    left: 40, top: 220,
  });
  composites.push({
    input: await colorRect(zoneW, zoneH, ...Object.values(DEPT_COLORS.ENGINEERING), 180),
    left: 40, top: 380,
  });
  // Right side departments
  composites.push({
    input: await colorRect(zoneW, zoneH, ...Object.values(DEPT_COLORS.FINANCE), 180),
    left: W - 40 - zoneW, top: 220,
  });
  composites.push({
    input: await colorRect(zoneW, zoneH, ...Object.values(DEPT_COLORS.HR), 180),
    left: W - 40 - zoneW, top: 380,
  });

  // === FURNITURE ===
  const deskImg = await loadAsset('furniture/desk-with-monitor-32x32.png');
  const plantImg = await loadAsset('environment/plant-large-32x32.png');
  const printerImg = await loadAsset('furniture/printer-modern-32x32.png');
  const whiteboardImg = await loadAsset('decor/whiteboard-chart-32x32.png');
  const chairImg = await loadAsset('furniture/chair-swivel-a-32x32.png');
  const filingImg = await loadAsset('furniture/filing-cabinet-tall-32x32.png');

  // Desk clusters
  const S = 32 * SCALE;
  composites.push({ input: deskImg, left: 300, top: 200 });
  composites.push({ input: chairImg, left: 300, top: 200 + S });
  composites.push({ input: deskImg, left: 300 + S + 10, top: 200 });
  composites.push({ input: chairImg, left: 300 + S + 10, top: 200 + S });

  composites.push({ input: deskImg, left: 700, top: 320 });
  composites.push({ input: chairImg, left: 700, top: 320 + S });
  composites.push({ input: deskImg, left: 700 + S + 10, top: 320 });

  // Decorative elements
  composites.push({ input: plantImg, left: 200, top: 350 });
  composites.push({ input: plantImg, left: 900, top: 180 });
  composites.push({ input: printerImg, left: 550, top: 370 });
  composites.push({ input: whiteboardImg, left: 500, top: 130 });
  composites.push({ input: filingImg, left: 850, top: 350 });

  // === CHARACTERS ===
  // Player (casual - facing down, frame 0 row 0)
  const playerImg = await extractFrame('sprites/player-casual.png', 0, 0);
  composites.push({ input: playerImg, left: 520, top: 260 });

  // Player business variant (smaller, background)
  const playerBiz = await extractFrame('sprites/player-business.png', 2, 0);
  composites.push({ input: playerBiz, left: 380, top: 350 });

  // Chaos agents
  const microImg = await extractFrame('sprites/agent-micromanager.png', 0, 0);
  composites.push({ input: microImg, left: 700, top: 220 });

  const replyImg = await extractFrame('sprites/agent-replyall.png', 0, 0);
  composites.push({ input: replyImg, left: 250, top: 280 });

  const chattyImg = await extractFrame('sprites/agent-chatty.png', 0, 0);
  composites.push({ input: chattyImg, left: 820, top: 400 });

  // === TASK DOTS (colored circles representing tasks) ===
  const taskSize = 20;
  const taskPositions = [
    { x: 460, y: 310, c: DEPT_COLORS.ENGINEERING },
    { x: 620, y: 200, c: DEPT_COLORS.CEO },
    { x: 750, y: 440, c: DEPT_COLORS.HR },
    { x: 350, y: 180, c: DEPT_COLORS.MARKETING },
    { x: 880, y: 280, c: DEPT_COLORS.FINANCE },
    { x: 560, y: 420, c: DEPT_COLORS.ENGINEERING },
  ];
  for (const t of taskPositions) {
    const circle = sharp({
      create: { width: taskSize, height: taskSize, channels: 4, background: { r: t.c.r, g: t.c.g, b: t.c.b, alpha: 0.9 } }
    }).png().toBuffer();
    composites.push({ input: await circle, left: t.x, top: t.y });
  }

  // === TEXT OVERLAY ===
  // Title
  const titleText = await textImage('OFFICE SURVIVORS', 52, '#FFFFFF');
  const titleMeta = await sharp(titleText).metadata();
  composites.push({
    input: titleText,
    left: Math.floor((W - titleMeta.width) / 2),
    top: 20,
  });

  // Subtitle
  const subText = await textImage('Survive the Corporate Workday', 22, '#AAAACC');
  const subMeta = await sharp(subText).metadata();
  composites.push({
    input: subText,
    left: Math.floor((W - subMeta.width) / 2),
    top: 78,
  });

  // Stress bar (decorative HUD element)
  // Bar background
  composites.push({
    input: await colorRect(200, 16, 40, 40, 40),
    left: W - 240, top: 135,
  });
  // Bar fill (red-orange gradient feel)
  composites.push({
    input: await colorRect(130, 12, 220, 60, 40),
    left: W - 238, top: 137,
  });
  // Bar label
  const stressLabel = await textImage('STRESS 65%', 14, '#FF6633');
  composites.push({ input: stressLabel, left: W - 240, top: 120 });

  // Bottom attribution
  const creditText = await textImage('Built with AI  |  Phaser 3  |  Pixel Art', 16, '#666688');
  const creditMeta = await sharp(creditText).metadata();
  composites.push({
    input: creditText,
    left: Math.floor((W - creditMeta.width) / 2),
    top: H - 35,
  });

  // === COMPOSE FINAL IMAGE ===
  const result = await sharp(bg)
    .composite(composites)
    .png()
    .toFile(OUT);

  console.log(`[OG Image] Saved to ${OUT} (${result.size} bytes)`);
}

main().catch(err => {
  console.error('[OG Image] Error:', err);
  process.exit(1);
});
