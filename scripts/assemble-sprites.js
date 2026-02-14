/**
 * Sprite Sheet Assembly Script
 *
 * Unzips PixelLab character exports and assembles individual frame PNGs
 * into single sprite sheet PNGs for Phaser's spritesheet loader.
 *
 * Player characters (8-direction):
 *   8 cols (S, SE, E, NE, N, NW, W, SW) x 5 rows (1 idle + 4 walk) = 40 frames
 *   Output: player-casual.png, player-business.png, player-executive.png
 *
 * NPC characters (4-direction):
 *   4 cols (S, E, N, W) x 5 rows (1 idle + 4 walk) = 20 frames
 *   Output: agent-micromanager.png, agent-replyall.png, agent-meeting.png,
 *           agent-chatty.png, agent-slack.png, assistant.png
 */

import sharp from 'sharp';
import { readdir, mkdir, rm, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { join, resolve } from 'path';
import { execSync } from 'child_process';

const SPRITES_DIR = resolve('public/assets/sprites');
const PLAYERS_DIR = join(SPRITES_DIR, 'Players');
const OUTPUT_DIR = SPRITES_DIR;
const FRAME_SIZE = 32;

// 8 directions for player characters (order matches PixelLab export)
const DIRS_8 = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west'];
// 4 directions for NPC characters
const DIRS_4 = ['south', 'east', 'north', 'west'];

// Map zip file name patterns to output filenames and direction count
const CHARACTER_MAP = [
  { pattern: 'Casual_Player', output: 'player-casual.png', dirs: 8 },
  { pattern: 'Player_Business', output: 'player-business.png', dirs: 8 },
  { pattern: 'Player_CEO', output: 'player-executive.png', dirs: 8 },
  { pattern: 'The_Micromanager', output: 'agent-micromanager.png', dirs: 4 },
  { pattern: 'Reply-All', output: 'agent-replyall.png', dirs: 4 },
  { pattern: 'Meeting_Schedule', output: 'agent-meeting.png', dirs: 4 },
  { pattern: 'Chatty_Coworker', output: 'agent-chatty.png', dirs: 4 },
  { pattern: 'SLack_Pinger', output: 'agent-slack.png', dirs: 4 },
  { pattern: 'NPC_Assistant', output: 'assistant.png', dirs: 4 },
];

async function findZipFile(pattern) {
  const files = await readdir(PLAYERS_DIR);
  const match = files.find(f => f.includes(pattern) && f.endsWith('.zip'));
  if (!match) {
    console.warn(`  WARNING: No zip found matching pattern "${pattern}"`);
    return null;
  }
  return join(PLAYERS_DIR, match);
}

async function unzipCharacter(zipPath) {
  const tempDir = join(SPRITES_DIR, '_temp_extract');
  if (existsSync(tempDir)) {
    await rm(tempDir, { recursive: true });
  }
  await mkdir(tempDir, { recursive: true });
  execSync(`unzip -o "${zipPath}" -d "${tempDir}"`, { stdio: 'pipe' });
  return tempDir;
}

async function assembleSheet(tempDir, directions, outputPath) {
  const dirList = directions === 8 ? DIRS_8 : DIRS_4;
  const cols = dirList.length;
  const rows = 5; // 1 idle + 4 walk frames
  const width = cols * FRAME_SIZE;
  const height = rows * FRAME_SIZE;

  // Collect all frame buffers with their positions
  const composites = [];

  for (let col = 0; col < cols; col++) {
    const dir = dirList[col];

    // Row 0: idle frame (from rotations/)
    const idlePath = join(tempDir, 'rotations', `${dir}.png`);
    if (existsSync(idlePath)) {
      const buf = await sharp(idlePath)
        .resize(FRAME_SIZE, FRAME_SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .toBuffer();
      composites.push({ input: buf, left: col * FRAME_SIZE, top: 0 });
    } else {
      console.warn(`  Missing idle: ${idlePath}`);
    }

    // Rows 1-4: walk frames (from animations/walking-4-frames/{dir}/)
    for (let frame = 0; frame < 4; frame++) {
      const framePath = join(tempDir, 'animations', 'walking-4-frames', dir, `frame_${String(frame).padStart(3, '0')}.png`);
      if (existsSync(framePath)) {
        const buf = await sharp(framePath)
          .resize(FRAME_SIZE, FRAME_SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .toBuffer();
        composites.push({ input: buf, left: col * FRAME_SIZE, top: (frame + 1) * FRAME_SIZE });
      } else {
        console.warn(`  Missing walk frame: ${framePath}`);
      }
    }
  }

  // Create the final sprite sheet
  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .png()
    .toFile(outputPath);

  console.log(`  Created: ${outputPath} (${width}x${height}, ${cols}x${rows} grid)`);
}

async function main() {
  console.log('Assembling sprite sheets...\n');

  for (const char of CHARACTER_MAP) {
    console.log(`Processing: ${char.output} (${char.dirs}-dir)`);

    const zipPath = await findZipFile(char.pattern);
    if (!zipPath) continue;

    const tempDir = await unzipCharacter(zipPath);

    try {
      const outputPath = join(OUTPUT_DIR, char.output);
      await assembleSheet(tempDir, char.dirs, outputPath);
    } finally {
      // Clean up temp directory
      await rm(tempDir, { recursive: true, force: true });
    }
  }

  // Clean up: delete zip files and individual frame PNGs (keep assembled sheets)
  console.log('\nCleaning up zip files...');
  const files = await readdir(PLAYERS_DIR);
  for (const f of files) {
    if (f.endsWith('.zip')) {
      const zipPath = join(PLAYERS_DIR, f);
      await unlink(zipPath);
      console.log(`  Deleted: ${zipPath}`);
    }
  }

  // Delete the organized assets zip too
  const organizedZip = join(SPRITES_DIR, 'office-survivors-assets-organized.zip');
  if (existsSync(organizedZip)) {
    await unlink(organizedZip);
    console.log(`  Deleted: ${organizedZip}`);
  }

  // Try to remove Players dir if empty
  try {
    const remaining = await readdir(PLAYERS_DIR);
    const pngsOrDirs = remaining.filter(f => !f.startsWith('.'));
    if (pngsOrDirs.length === 0) {
      await rm(PLAYERS_DIR, { recursive: true });
      console.log(`  Removed empty directory: ${PLAYERS_DIR}`);
    }
  } catch (e) {
    // Ignore
  }

  console.log('\nDone! Sprite sheets are in public/assets/sprites/');
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
