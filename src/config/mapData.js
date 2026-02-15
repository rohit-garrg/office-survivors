/**
 * Map layout data: spawn points, department delivery zones, player start.
 *
 * All positions are in tile coordinates (multiply by TILE_SIZE for pixels).
 * Map is 40 x 30 tiles (1280 x 960 px).
 */

/** Predefined tile coordinates where tasks can spawn (central open floor) */
export const TASK_SPAWN_POINTS = [
  // Open floor between departments (y 8-11)
  { x: 10, y: 8 },
  { x: 16, y: 8 },
  { x: 22, y: 8 },
  { x: 28, y: 8 },
  { x: 12, y: 11 },
  { x: 20, y: 11 },
  { x: 27, y: 11 },
  // Central corridor (y 13-15)
  { x: 10, y: 15 },
  { x: 17, y: 15 },
  { x: 22, y: 15 },
  { x: 30, y: 15 },
  { x: 12, y: 13 },
  { x: 25, y: 13 },
  { x: 9, y: 10 },
  { x: 31, y: 10 },
  // South corridor between Engineering and HR (y 18-21)
  { x: 12, y: 19 },
  { x: 18, y: 19 },
  { x: 16, y: 21 },
];

/** Player starting position in tile coordinates */
export const PLAYER_START = { x: 20, y: 17 };

/**
 * Department delivery zones.
 *
 * position: top-left corner in tile coordinates.
 * size: width x height in tiles.
 * color: hex color string for rendering.
 * name: display name shown in HUD.
 * id: key used in task route/dept references.
 */
export const DEPARTMENTS = [
  {
    id: 'CEO',
    name: 'CEO Office',
    position: { x: 1, y: 2 },
    size: { width: 6, height: 4 },
    color: '#FFD700', // Gold
  },
  {
    id: 'MARKETING',
    name: 'Marketing',
    position: { x: 1, y: 8 },
    size: { width: 6, height: 4 },
    color: '#FF8C00', // Orange
  },
  {
    id: 'ENGINEERING',
    name: 'Engineering',
    position: { x: 1, y: 18 },
    size: { width: 6, height: 4 },
    color: '#4169E1', // Blue
  },
  {
    id: 'FINANCE',
    name: 'Finance',
    position: { x: 33, y: 8 },
    size: { width: 6, height: 4 },
    color: '#2E8B57', // Green
  },
  {
    id: 'HR',
    name: 'HR',
    position: { x: 33, y: 18 },
    size: { width: 6, height: 4 },
    color: '#8B5CF6', // Purple
  },
];

/** Department color lookup by ID */
export const DEPARTMENT_COLORS = {
  CEO: '#FFD700',
  MARKETING: '#FF8C00',
  ENGINEERING: '#4169E1',
  FINANCE: '#2E8B57',
  HR: '#8B5CF6',
};

/**
 * Static obstacle positions (desks, printers, etc.) in tile coordinates.
 * Each has a position and size in tiles.
 */
export const OBSTACLES = [
  // Desks in open floor area
  { type: 'desk', x: 14, y: 9, width: 2, height: 2 },
  { type: 'desk', x: 17, y: 9, width: 2, height: 2 },
  { type: 'desk', x: 3, y: 13, width: 2, height: 2 },
  { type: 'desk', x: 34, y: 13, width: 2, height: 2 },
  // Printers
  { type: 'printer', x: 14, y: 13, width: 2, height: 2 },
  { type: 'printer', x: 21, y: 13, width: 2, height: 2 },
];

/**
 * Room wall segments. Each defines a rectangular wall region in tile coords.
 * The map perimeter wall is generated programmatically from map dimensions.
 */
export const ROOM_WALLS = [
  // CEO Office walls (door gap at right wall y=3,4)
  { x: 0, y: 1, width: 8, height: 1, deptId: 'CEO' }, // top
  { x: 7, y: 1, width: 1, height: 2, deptId: 'CEO' }, // right upper
  { x: 7, y: 5, width: 1, height: 1, deptId: 'CEO' }, // right lower (gap at y=3,4)
  { x: 0, y: 6, width: 8, height: 1, deptId: 'CEO' }, // bottom

  // Marketing walls (door gap at right wall y=9,10)
  { x: 0, y: 7, width: 8, height: 1, deptId: 'MARKETING' },
  { x: 7, y: 7, width: 1, height: 2, deptId: 'MARKETING' }, // right upper
  { x: 7, y: 11, width: 1, height: 1, deptId: 'MARKETING' }, // right lower (gap at y=9,10)
  { x: 0, y: 12, width: 8, height: 1, deptId: 'MARKETING' },

  // Engineering walls (door gap at right wall y=19,20)
  { x: 0, y: 17, width: 8, height: 1, deptId: 'ENGINEERING' },
  { x: 7, y: 17, width: 1, height: 2, deptId: 'ENGINEERING' }, // right upper
  { x: 7, y: 21, width: 1, height: 1, deptId: 'ENGINEERING' }, // right lower (gap at y=19,20)
  { x: 0, y: 22, width: 8, height: 1, deptId: 'ENGINEERING' },

  // Finance walls (door gap at left wall y=9,10)
  { x: 32, y: 7, width: 8, height: 1, deptId: 'FINANCE' },
  { x: 32, y: 7, width: 1, height: 2, deptId: 'FINANCE' }, // left upper
  { x: 32, y: 11, width: 1, height: 1, deptId: 'FINANCE' }, // left lower (gap at y=9,10)
  { x: 32, y: 12, width: 8, height: 1, deptId: 'FINANCE' },

  // HR walls (door gap at left wall y=19,20) — mirrors Finance below it
  { x: 32, y: 17, width: 8, height: 1, deptId: 'HR' }, // top
  { x: 32, y: 17, width: 1, height: 2, deptId: 'HR' }, // left upper
  { x: 32, y: 21, width: 1, height: 1, deptId: 'HR' }, // left lower (gap at y=19,20)
  { x: 32, y: 22, width: 8, height: 1, deptId: 'HR' }, // bottom

];

/** Short department abbreviations for HUD badges */
export const DEPARTMENT_ABBREV = {
  CEO: 'CEO',
  MARKETING: 'Mkt',
  ENGINEERING: 'Eng',
  FINANCE: 'Fin',
  HR: 'HR',
};
