export type Direction = 0 | 1 | 2 | 3;
export type MirrorOrientation = '/' | '\\';
export type GridPoint = readonly [number, number];

export interface MirrorConfig {
  id: string;
  at: GridPoint;
  initial: MirrorOrientation;
}

export interface SplitterConfig {
  id: string;
  at: GridPoint;
}

export interface TargetConfig {
  id: string;
  at: GridPoint;
  required: number;
}

export interface LevelConfig {
  id: number;
  name: string;
  subtitle: string;
  chapter: string;
  size: number;
  source: GridPoint;
  sourceDirection: Direction;
  sourceEnergy: number;
  targets: readonly TargetConfig[];
  mirrors: readonly MirrorConfig[];
  splitters: readonly SplitterConfig[];
  obstacles: readonly GridPoint[];
  solution: readonly MirrorOrientation[];
  district: number;
  districtCenter: GridPoint;
  parMoves: number;
}

export const DISTRICT_CENTERS: readonly GridPoint[] = [[-5, -5], [5, -5], [-5, 5], [5, 5]];

export const LEVELS: readonly LevelConfig[] = [
  {
    id: 0, name: '初光', subtitle: '第一束光，等待一个转弯。', chapter: '基础反射',
    size: 7, source: [0, 3], sourceDirection: 0, sourceEnergy: 9,
    targets: [{ id: 'T1', at: [3, 0], required: 1 }],
    mirrors: [{ id: 'A', at: [3, 3], initial: '\\' }],
    splitters: [], obstacles: [[5, 2]],
    solution: ['/'], district: 0, districtCenter: [-5, -5], parMoves: 1,
  },
  {
    id: 1, name: '街角', subtitle: '光走过街角，也学会了回望。', chapter: '基础反射',
    size: 7, source: [0, 5], sourceDirection: 0, sourceEnergy: 9,
    targets: [{ id: 'T1', at: [5, 2], required: 1 }],
    mirrors: [
      { id: 'A', at: [2, 5], initial: '\\' },
      { id: 'B', at: [2, 2], initial: '\\' },
    ],
    splitters: [], obstacles: [[5, 5], [4, 0]],
    solution: ['/', '/'], district: 0, districtCenter: [-5, -5], parMoves: 2,
  },
  {
    id: 2, name: '一分为二', subtitle: '一束光，也能同时照亮两处等待。', chapter: '分光',
    size: 7, source: [0, 3], sourceDirection: 0, sourceEnergy: 8,
    targets: [
      { id: 'T1', at: [5, 1], required: 3 },
      { id: 'T2', at: [5, 5], required: 3 },
    ],
    mirrors: [
      { id: 'A', at: [2, 1], initial: '\\' },
      { id: 'B', at: [2, 5], initial: '/' },
    ],
    splitters: [{ id: 'S1', at: [2, 3] }], obstacles: [[5, 3]],
    solution: ['/', '\\'], district: 1, districtCenter: [5, -5], parMoves: 2,
  },
  {
    id: 3, name: '双街灯火', subtitle: '两条光路，要各自找到归宿。', chapter: '分光',
    size: 7, source: [0, 4], sourceDirection: 0, sourceEnergy: 10,
    targets: [
      { id: 'T1', at: [6, 0], required: 3 },
      { id: 'T2', at: [6, 6], required: 3 },
    ],
    mirrors: [
      { id: 'A', at: [3, 2], initial: '\\' },
      { id: 'B', at: [6, 2], initial: '\\' },
      { id: 'C', at: [3, 6], initial: '/' },
    ],
    splitters: [{ id: 'S1', at: [3, 4] }], obstacles: [[5, 0], [1, 6], [4, 0]],
    solution: ['/', '/', '\\'], district: 1, districtCenter: [5, -5], parMoves: 3,
  },
  {
    id: 4, name: '精打细算', subtitle: '能量有限，绕远路的光到不了窗边。', chapter: '能量',
    size: 7, source: [0, 3], sourceDirection: 0, sourceEnergy: 6,
    targets: [{ id: 'T1', at: [6, 3], required: 3 }],
    mirrors: [
      { id: 'A', at: [2, 3], initial: '\\' },
      { id: 'B', at: [2, 0], initial: '\\' },
      { id: 'C', at: [6, 0], initial: '/' },
      { id: 'D', at: [6, 6], initial: '\\' },
      { id: 'E', at: [2, 6], initial: '/' },
    ],
    splitters: [], obstacles: [[3, 3], [4, 4], [1, 1]],
    solution: ['\\', '\\', '/', '/', '\\'], district: 2, districtCenter: [-5, 5], parMoves: 2,
  },
  {
    id: 5, name: '光的预算', subtitle: '分出去的光，够不够点亮另一扇窗？', chapter: '能量',
    size: 7, source: [0, 3], sourceDirection: 0, sourceEnergy: 9,
    targets: [
      { id: 'T1', at: [6, 0], required: 2 },
      { id: 'T2', at: [6, 6], required: 2 },
    ],
    mirrors: [
      { id: 'A', at: [3, 1], initial: '\\' },
      { id: 'B', at: [6, 1], initial: '\\' },
      { id: 'C', at: [3, 5], initial: '/' },
      { id: 'D', at: [6, 5], initial: '/' },
    ],
    splitters: [{ id: 'S1', at: [3, 3] }], obstacles: [[3, 0], [3, 6], [6, 3]],
    solution: ['/', '/', '\\', '\\'], district: 2, districtCenter: [-5, 5], parMoves: 4,
  },
  {
    id: 6, name: '雨夜枢纽', subtitle: '分光、损耗与阻挡，要一起算清楚。', chapter: '综合',
    size: 7, source: [0, 3], sourceDirection: 0, sourceEnergy: 10,
    targets: [
      { id: 'T1', at: [5, 0], required: 3 },
      { id: 'T2', at: [5, 6], required: 3 },
    ],
    mirrors: [
      { id: 'A', at: [2, 1], initial: '\\' },
      { id: 'B', at: [5, 1], initial: '\\' },
      { id: 'C', at: [2, 5], initial: '/' },
      { id: 'D', at: [5, 5], initial: '/' },
    ],
    splitters: [{ id: 'S1', at: [2, 3] }], obstacles: [[4, 0], [4, 6], [6, 3], [0, 0]],
    solution: ['/', '/', '\\', '\\'], district: 3, districtCenter: [5, 5], parMoves: 4,
  },
  {
    id: 7, name: '万家灯火', subtitle: '最后的光路，通向整座城市的黎明。', chapter: '综合',
    size: 7, source: [0, 3], sourceDirection: 0, sourceEnergy: 12,
    targets: [
      { id: 'T1', at: [5, 0], required: 3 },
      { id: 'T2', at: [5, 6], required: 2 },
      { id: 'T3', at: [6, 1], required: 1 },
    ],
    mirrors: [
      { id: 'A', at: [2, 1], initial: '\\' },
      { id: 'B', at: [5, 1], initial: '\\' },
      { id: 'C', at: [2, 5], initial: '/' },
    ],
    splitters: [{ id: 'S1', at: [2, 3] }, { id: 'S2', at: [5, 5] }],
    obstacles: [[6, 3], [0, 0], [4, 6]],
    solution: ['/', '/', '\\'], district: 3, districtCenter: [5, 5], parMoves: 3,
  },
] as const;

export const OPTICS_HEIGHT = 2.25;
export const GRID_SIZE = 1.12;