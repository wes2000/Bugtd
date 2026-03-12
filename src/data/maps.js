// Maps define paths and buildable grid for each player's half
// Coordinates are in grid units. Each player has their own half.
// Grid: (0,0) is top-left of player's territory
// Paths go from left edge (attacker spawn) to right edge (defender base)

export const MAPS = {
  meadow: {
    name: 'The Meadow',
    gridWidth: 8,
    gridHeight: 6,
    pathCount: 2,
    description: 'Open, beginner-friendly. Two wide winding paths.',
    groundColor: 0x4a7c3f,
    pathColor: 0xc4a265,
    // Paths defined as waypoints (in grid coords)
    // These get mirrored for the opponent's side
    paths: [
      [
        { x: -1, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 3 },
        { x: 3, y: 3 }, { x: 3, y: 1 }, { x: 5, y: 1 },
        { x: 5, y: 3 }, { x: 7, y: 3 }, { x: 9, y: 3 }
      ],
      [
        { x: -1, y: 5 }, { x: 2, y: 5 }, { x: 2, y: 3.5 },
        { x: 4, y: 3.5 }, { x: 4, y: 5 }, { x: 6, y: 5 },
        { x: 6, y: 4 }, { x: 9, y: 4 }
      ]
    ],
    // Grid squares that are buildable (not on paths)
    // null = auto-calculate from paths
    buildableOverride: null
  },
  burrow: {
    name: 'The Burrow',
    gridWidth: 6,
    gridHeight: 8,
    pathCount: 3,
    description: 'Tight corridors, chokepoints. Three narrow paths.',
    groundColor: 0x5c4a32,
    pathColor: 0x8b7355,
    paths: [
      [
        { x: -1, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 2 },
        { x: 3, y: 2 }, { x: 3, y: 1 }, { x: 5, y: 1 }, { x: 7, y: 1 }
      ],
      [
        { x: -1, y: 4 }, { x: 2, y: 4 }, { x: 2, y: 3 },
        { x: 4, y: 3 }, { x: 4, y: 4 }, { x: 7, y: 4 }
      ],
      [
        { x: -1, y: 7 }, { x: 1, y: 7 }, { x: 1, y: 6 },
        { x: 3, y: 6 }, { x: 3, y: 7 }, { x: 5, y: 7 }, { x: 7, y: 7 }
      ]
    ],
    buildableOverride: null
  },
  crossing: {
    name: 'The Crossing',
    gridWidth: 7,
    gridHeight: 7,
    pathCount: 2,
    description: 'Two paths that cross in the middle. Overlapping coverage.',
    groundColor: 0x3d6b35,
    pathColor: 0xb8a070,
    paths: [
      [
        { x: -1, y: 1 }, { x: 2, y: 1 }, { x: 3.5, y: 3.5 },
        { x: 5, y: 1 }, { x: 8, y: 1 }
      ],
      [
        { x: -1, y: 6 }, { x: 2, y: 6 }, { x: 3.5, y: 3.5 },
        { x: 5, y: 6 }, { x: 8, y: 6 }
      ]
    ],
    buildableOverride: null
  },
  maze: {
    name: 'The Maze',
    gridWidth: 10,
    gridHeight: 5,
    pathCount: 1,
    description: 'Single long snaking path. Maximum tower density.',
    groundColor: 0x4a6b3a,
    pathColor: 0xd4b896,
    paths: [
      [
        { x: -1, y: 0.5 }, { x: 1, y: 0.5 }, { x: 1, y: 2 },
        { x: 3, y: 2 }, { x: 3, y: 0.5 }, { x: 5, y: 0.5 },
        { x: 5, y: 3.5 }, { x: 7, y: 3.5 }, { x: 7, y: 1.5 },
        { x: 9, y: 1.5 }, { x: 9, y: 4 }, { x: 11, y: 4 }
      ]
    ],
    buildableOverride: null
  }
};

export function getRandomMap() {
  const keys = Object.keys(MAPS);
  return keys[Math.floor(Math.random() * keys.length)];
}

// Calculate buildable grid squares (not occupied by paths)
export function calculateBuildableSquares(map) {
  const buildable = [];
  const pathCells = new Set();

  // Mark cells that paths pass through
  for (const path of map.paths) {
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i];
      const b = path[i + 1];
      const steps = Math.ceil(Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y)) * 2);
      for (let s = 0; s <= steps; s++) {
        const t = s / Math.max(steps, 1);
        const px = a.x + (b.x - a.x) * t;
        const py = a.y + (b.y - a.y) * t;
        // Mark the grid cell and neighbors
        const gx = Math.floor(px);
        const gy = Math.floor(py);
        for (let dx = -0; dx <= 0; dx++) {
          for (let dy = -0; dy <= 0; dy++) {
            pathCells.add(`${gx + dx},${gy + dy}`);
          }
        }
      }
    }
  }

  for (let x = 0; x < map.gridWidth; x++) {
    for (let y = 0; y < map.gridHeight; y++) {
      if (!pathCells.has(`${x},${y}`)) {
        buildable.push({ x, y });
      }
    }
  }

  return buildable;
}
