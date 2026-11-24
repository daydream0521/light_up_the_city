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

/** 可放置/可旋转器件类型（Reflection 规则）。 */
export type PieceKind = 'mirror' | 'splitter' | 'single' | 'checkpoint';

export interface ReflectionPieceConfig {
  id: string;
  kind: PieceKind;
  at: GridPoint;
  /** mirror/splitter/checkpoint: 0 或 1；single: 0..3（背灯朝向，0=N 1=E 2=S 3=W，按原作 rotation 语义）。 */
  state: number;
  /** 锁定后玩家不能旋转/翻转（对应原作 noRot/noFlip）。 */
  locked: boolean;
}

export interface ReflectionConfig {
  /** 需要点亮的背灯数量（原作 Inventory.targets）。 */
  lightTargets: number;
  /** 光塔是否可旋转（原作 `- x y rot d`）。 */
  sourceRotatable: boolean;
  pieces: readonly ReflectionPieceConfig[];
  /** 库存器件，必须全部放置才算胜利（原作 Inventory.items）。 */
  inventory: readonly { kind: PieceKind; count: number }[];
  /** 允许放置的格子；缺省表示所有空格。 */
  placementZones?: readonly GridPoint[];
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
  solution?: readonly MirrorOrientation[];
  /** 存在时使用 Reflection 移植规则（放置/背灯/闸门），能量机制关闭。 */
  reflection?: ReflectionConfig;
  district: number;
  districtCenter: GridPoint;
  parMoves: number;
}

export const DISTRICT_CENTERS: readonly GridPoint[] = [[-5, -5], [5, -5], [-5, 5], [5, 5]];

/*
 * 第 3–8 关移植自开源游戏 Reflection（OrangoMango, MIT License）：
 * https://github.com/OrangoMango/Reflection — src/main/resources/misc/levels.data
 * 移植对应关系与规则差异见 docs/PORTING.md。
 */
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
    // Reflection levels.data 第一关（#1 2;2 0;1）
    id: 2, name: '布光行囊', subtitle: '把库存里的器件搬上屋顶，光才会找到背灯。', chapter: '器件放置',
    size: 5, source: [3, 3], sourceDirection: 3, sourceEnergy: 0,
    targets: [], mirrors: [], splitters: [], obstacles: [],
    reflection: {
      lightTargets: 1, sourceRotatable: false, pieces: [],
      inventory: [{ kind: 'mirror', count: 2 }, { kind: 'single', count: 1 }],
    },
    district: 1, districtCenter: [5, -5], parMoves: 6,
  },
  {
    // Reflection LEVEL 2（#2 0;3 1;2）
    id: 3, name: '闸口分光', subtitle: '分光镜既反射也放行，闸门只认一个方向。', chapter: '器件放置',
    size: 5, source: [1, 2], sourceDirection: 3, sourceEnergy: 0,
    targets: [], mirrors: [], splitters: [], obstacles: [],
    reflection: {
      lightTargets: 2, sourceRotatable: true,
      pieces: [
        { id: 'S1', kind: 'single', at: [2, 0], state: 0, locked: false },
        { id: 'C1', kind: 'checkpoint', at: [2, 1], state: 1, locked: true },
        { id: 'M1', kind: 'mirror', at: [4, 2], state: 0, locked: false },
        { id: 'S2', kind: 'single', at: [0, 4], state: 0, locked: false },
      ],
      inventory: [{ kind: 'single', count: 3 }, { kind: 'splitter', count: 2 }],
    },
    district: 1, districtCenter: [5, -5], parMoves: 15,
  },
  {
    // Reflection LEVEL 20（#3 0;1 2;1 1;1）
    // 注：原 levels.data 在 (1,0) 有一块障碍，但官方 solutions.data 的解法基于没有该障碍的
    // 棋盘（两文件版本不一致）。移植时移除该障碍，使官方解成立，见 docs/PORTING.md。
    id: 4, name: '镜街二十', subtitle: '五盏背灯点亮三盏，但每件器件都要被光碰到。', chapter: '移植挑战',
    size: 5, source: [0, 2], sourceDirection: 1, sourceEnergy: 0,
    targets: [], mirrors: [], splitters: [], obstacles: [],
    reflection: {
      lightTargets: 3, sourceRotatable: true,
      pieces: [
        { id: 'P1', kind: 'splitter', at: [2, 0], state: 0, locked: false },
        { id: 'S1', kind: 'single', at: [4, 0], state: 0, locked: false },
        { id: 'S2', kind: 'single', at: [0, 1], state: 0, locked: false },
        { id: 'C1', kind: 'checkpoint', at: [1, 1], state: 0, locked: false },
        { id: 'S3', kind: 'single', at: [1, 2], state: 0, locked: false },
        { id: 'S4', kind: 'single', at: [2, 3], state: 0, locked: false },
      ],
      inventory: [{ kind: 'single', count: 1 }, { kind: 'mirror', count: 1 }, { kind: 'splitter', count: 1 }],
    },
    district: 2, districtCenter: [-5, 5], parMoves: 17,
  },
  {
    // Reflection LEVEL 99（#2 0;4 1;2）
    id: 5, name: '万家灯火', subtitle: '最后的光网：闸门、分光与四面背灯同时上岗。', chapter: '移植挑战',
    size: 5, source: [3, 0], sourceDirection: 2, sourceEnergy: 0,
    targets: [], mirrors: [], splitters: [], obstacles: [[0, 0]],
    reflection: {
      lightTargets: 2, sourceRotatable: true,
      pieces: [
        { id: 'M1', kind: 'mirror', at: [1, 1], state: 1, locked: true },
        { id: 'C1', kind: 'checkpoint', at: [0, 2], state: 0, locked: true },
      ],
      inventory: [{ kind: 'single', count: 4 }, { kind: 'splitter', count: 2 }],
    },
    district: 3, districtCenter: [5, 5], parMoves: 12,
  },
] as const;

export const OPTICS_HEIGHT = 2.25;
export const GRID_SIZE = 1.12;
