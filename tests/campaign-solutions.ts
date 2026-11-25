import type { Direction, PieceKind } from '../src/game/levels';

export interface SolutionFixture {
  levelId: number;
  placements: { kind: PieceKind; x: number; z: number; state: number }[];
  pieceStates: number[];
  sourceDirection: Direction;
  minMovesUpperBound: number;
}

// 第 3、7、8、9 关的官方解来自 Reflection 仓库 src/main/resources/misc/solutions.data（MIT License）。
// 第 1、2、4、5、6 关为教学关，解由布局设计推导并经引擎验证。
export const SOLUTIONS: SolutionFixture[] = [
  { // 第 1 关「第一面镜」：M1 翻转 1 次，S1 旋转 2 次
    levelId: 0,
    placements: [], pieceStates: [1, 2], sourceDirection: 0, minMovesUpperBound: 3,
  },
  { // 第 2 关「行囊初试」：放置镜面(4,0)转 1 次 + 放置背灯镜(4,3)转 2 次
    levelId: 1,
    placements: [
      { kind: 'mirror', x: 4, z: 0, state: 1 },
      { kind: 'single', x: 4, z: 3, state: 2 },
    ],
    pieceStates: [], sourceDirection: 0, minMovesUpperBound: 5,
  },
  { // Reflection 第一关 → 第 3 关「布光行囊」（SOLUTION 0）
    levelId: 2,
    placements: [
      { kind: 'mirror', x: 0, z: 1, state: 0 },
      { kind: 'mirror', x: 3, z: 1, state: 1 },
      { kind: 'single', x: 0, z: 3, state: 2 },
    ],
    pieceStates: [], sourceDirection: 3, minMovesUpperBound: 6,
  },
  { // 第 4 关「一分为二」：分光镜翻转 1 次，S1 旋转 2 次
    levelId: 3,
    placements: [], pieceStates: [0, 1, 0], sourceDirection: 0, minMovesUpperBound: 3,
  },
  { // 第 5 关「闸门之规」：闸门切换 1 次，S1 旋转 2 次（锁定镜面不动）
    levelId: 4,
    placements: [], pieceStates: [1, 0, 2], sourceDirection: 0, minMovesUpperBound: 3,
  },
  { // 第 6 关「转塔之光」：光塔转 1 次 + M1 翻 1 次 + S1 转 2 次 + S2 转 1 次
    levelId: 5,
    placements: [], pieceStates: [0, 1, 1, 3], sourceDirection: 0, minMovesUpperBound: 5,
  },
  { // Reflection LEVEL 2 → 第 7 关「闸口分光」（SOLUTION 3）
    levelId: 6,
    placements: [
      { kind: 'single', x: 4, z: 0, state: 2 },
      { kind: 'single', x: 0, z: 1, state: 1 },
      { kind: 'splitter', x: 4, z: 1, state: 1 },
      { kind: 'splitter', x: 0, z: 3, state: 1 },
      { kind: 'single', x: 4, z: 3, state: 1 },
    ],
    pieceStates: [3, 1, 0, 0], sourceDirection: 0, minMovesUpperBound: 15,
  },
  { // Reflection LEVEL 20 → 第 8 关「镜街二十」（SOLUTION 14）
    levelId: 7,
    placements: [
      { kind: 'single', x: 0, z: 0, state: 3 },
      { kind: 'mirror', x: 4, z: 1, state: 0 },
      { kind: 'splitter', x: 2, z: 2, state: 0 },
    ],
    pieceStates: [0, 2, 1, 1, 3, 2], sourceDirection: 3, minMovesUpperBound: 17,
  },
  { // Reflection LEVEL 99 → 第 9 关「万家灯火」（SOLUTION 30）
    levelId: 8,
    placements: [
      { kind: 'single', x: 1, z: 0, state: 0 },
      { kind: 'splitter', x: 3, z: 1, state: 0 },
      { kind: 'splitter', x: 3, z: 2, state: 0 },
      { kind: 'single', x: 0, z: 3, state: 0 },
      { kind: 'single', x: 3, z: 3, state: 3 },
      { kind: 'single', x: 0, z: 1, state: 0 },
    ],
    pieceStates: [1, 0], sourceDirection: 1, minMovesUpperBound: 12,
  },
];
