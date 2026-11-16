export type Direction = 0 | 1 | 2 | 3;
export type MirrorOrientation = '/' | '\\';
export type GridPoint = readonly [number, number];

export interface MirrorConfig {
  id: string;
  at: GridPoint;
  initial: MirrorOrientation;
}

export interface LevelConfig {
  id: number;
  name: string;
  subtitle: string;
  size: number;
  source: GridPoint;
  sourceDirection: Direction;
  target: GridPoint;
  mirrors: readonly MirrorConfig[];
  obstacles: readonly GridPoint[];
  solution: readonly MirrorOrientation[];
  districtCenter: GridPoint;
}

export const LEVELS: readonly LevelConfig[] = [
  {
    id: 0,
    name: '初光',
    subtitle: '第一束光，等待一个转弯。',
    size: 7,
    source: [0, 3],
    sourceDirection: 0,
    target: [3, 0],
    mirrors: [{ id: 'A', at: [3, 3], initial: '\\' }],
    obstacles: [[5, 2]],
    solution: ['/'],
    districtCenter: [-5, -5],
  },
  {
    id: 1,
    name: '街角',
    subtitle: '光走过街角，也学会了回望。',
    size: 7,
    source: [0, 5],
    sourceDirection: 0,
    target: [5, 2],
    mirrors: [
      { id: 'A', at: [2, 5], initial: '\\' },
      { id: 'B', at: [2, 2], initial: '\\' },
    ],
    obstacles: [[5, 5], [4, 0]],
    solution: ['/', '/'],
    districtCenter: [5, -5],
  },
  {
    id: 2,
    name: '雨巷',
    subtitle: '此路不通时，就让光绕一场雨。',
    size: 7,
    source: [0, 2],
    sourceDirection: 0,
    target: [5, 1],
    mirrors: [
      { id: 'A', at: [2, 2], initial: '/' },
      { id: 'B', at: [2, 5], initial: '\\' },
      { id: 'C', at: [5, 5], initial: '\\' },
    ],
    obstacles: [[4, 2], [2, 0], [0, 5]],
    solution: ['\\', '\\', '/'],
    districtCenter: [-5, 5],
  },
  {
    id: 3,
    name: '万家灯火',
    subtitle: '最后一段光路，通向整座城市的黎明。',
    size: 7,
    source: [0, 5],
    sourceDirection: 0,
    target: [6, 5],
    mirrors: [
      { id: 'A', at: [2, 5], initial: '\\' },
      { id: 'B', at: [2, 2], initial: '\\' },
      { id: 'C', at: [5, 2], initial: '/' },
      { id: 'D', at: [5, 5], initial: '/' },
    ],
    obstacles: [[3, 6], [6, 4], [2, 1], [0, 3]],
    solution: ['/', '/', '\\', '\\'],
    districtCenter: [5, 5],
  },
] as const;

export const OPTICS_HEIGHT = 2.25;
export const GRID_SIZE = 1.12;
