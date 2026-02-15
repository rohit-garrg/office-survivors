/**
 * Utility functions for Office Survivors.
 */

/**
 * Get a random element from an array.
 * @param {Array} array
 * @returns {*}
 */
export function randomFrom(array) {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Get a random integer between min (inclusive) and max (inclusive).
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Convert tile coordinates to pixel coordinates (center of tile).
 * @param {number} tileX
 * @param {number} tileY
 * @param {number} tileSize
 * @returns {{x: number, y: number}}
 */
export function tileToPixel(tileX, tileY, tileSize) {
  return {
    x: tileX * tileSize + tileSize / 2,
    y: tileY * tileSize + tileSize / 2,
  };
}

/**
 * Convert pixel coordinates to tile coordinates.
 * @param {number} pixelX
 * @param {number} pixelY
 * @param {number} tileSize
 * @returns {{x: number, y: number}}
 */
export function pixelToTile(pixelX, pixelY, tileSize) {
  return {
    x: Math.floor(pixelX / tileSize),
    y: Math.floor(pixelY / tileSize),
  };
}

/**
 * Calculate distance between two points.
 * @param {number} x1
 * @param {number} y1
 * @param {number} x2
 * @param {number} y2
 * @returns {number}
 */
export function distance(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Normalize a velocity vector to prevent faster diagonal movement.
 * @param {number} vx
 * @param {number} vy
 * @param {number} speed
 * @returns {{x: number, y: number}}
 */
export function normalizeVelocity(vx, vy, speed) {
  if (vx === 0 && vy === 0) return { x: 0, y: 0 };
  const magnitude = Math.sqrt(vx * vx + vy * vy);
  return {
    x: (vx / magnitude) * speed,
    y: (vy / magnitude) * speed,
  };
}

/**
 * Weighted random selection. Takes an array of { item, weight } objects.
 * @param {Array<{item: *, weight: number}>} weightedItems
 * @returns {*}
 */
export function weightedRandom(weightedItems) {
  const totalWeight = weightedItems.reduce((sum, entry) => sum + entry.weight, 0);
  let random = Math.random() * totalWeight;
  for (const entry of weightedItems) {
    random -= entry.weight;
    if (random <= 0) return entry.item;
  }
  return weightedItems[weightedItems.length - 1].item;
}

/**
 * Clamp a value between min and max.
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Format seconds as M:SS string.
 * @param {number} totalSeconds
 * @returns {string}
 */
export function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Parse a hex color string to a Phaser-compatible integer.
 * @param {string} hex - e.g., '#FFD700'
 * @returns {number}
 */
export function hexToInt(hex) {
  return parseInt(hex.replace('#', ''), 16);
}

/**
 * Check if the device supports touch input.
 * @returns {boolean}
 */
export function isTouchDevice() {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}
