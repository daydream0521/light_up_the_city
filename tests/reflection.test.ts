import { describe, expect, it } from 'vitest';
import { LEVELS, type Direction, type LevelConfig, type PieceKind } from '../src/game/levels';
import { initialReflectionState, traceReflection, type Placement, type ReflectionGameState } from '../src/game/reflection';

interface SolutionFixture {
  levelId: number;
  placements: { kind: PieceKind; x: number; z: number; state: number }[];
  pieceStates: number[];
  sourceDirection: Direction;
  minMovesUpperBound: number;
}

// 第 3、7、8、9 关的官方解来自 Reflection 仓库 src/main/resources/misc/solutions.data（MIT License）。
// 第 1、2、4、5、6 关为教学关，解由布局设计推导并经引擎验证。
const SOLUTIONS: SolutionFixture[] = [
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

function applySolution(levelId: number, fixture: SolutionFixture): { state: ReflectionGameState; level: LevelConfig } {
  const level = LEVELS[levelId];
  const state = initialReflectionState(level);
  state.pieceStates = [...fixture.pieceStates];
  state.sourceDirection = fixture.sourceDirection;
  state.placements = fixture.placements.map((item): Placement => ({ at: [item.x, item.z], kind: item.kind, state: item.state }));
  return { state, level };
}

describe('reflection engine', () => {
  it.each(SOLUTIONS.map((fixture) => [fixture.levelId, fixture] as const))(
    '参考解在第 %i 关获胜',
    (levelId, fixture) => {
      const { state, level } = applySolution(levelId, fixture);
      const trace = traceReflection(level, state);
      expect(trace.won).toBe(true);
      expect(trace.unhitPieces).toEqual([]);
      expect(trace.litLights).toBeGreaterThanOrEqual(level.reflection.lightTargets);
      expect(trace.checkpointsPassed).toBe(trace.checkpointsTotal);
      expect(trace.inventoryLeft).toBe(0);
    },
  );

  it('初始状态不获胜（每一关）', () => {
    for (const level of LEVELS) {
      const trace = traceReflection(level, initialReflectionState(level));
      expect(trace.won).toBe(false);
    }
  });

  it('库存未用完不能获胜', () => {
    const { state, level } = applySolution(2, SOLUTIONS[2]);
    state.placements = state.placements.slice(0, 2);
    expect(traceReflection(level, state).won).toBe(false);
  });

  it('存在未被照到的器件时不能获胜', () => {
    const { state, level } = applySolution(2, SOLUTIONS[2]);
    state.placements = [...state.placements, { at: [4, 4], kind: 'mirror', state: 0 }];
    const trace = traceReflection(level, state);
    expect(trace.unhitPieces.length).toBeGreaterThan(0);
    expect(trace.won).toBe(false);
  });

  it('单面镜只有背灯方向被吸收点亮，其余方向反射或吸收不亮', () => {
    const level = LEVELS[2];
    const state = initialReflectionState(level);
    // 光塔 (3,3) 朝北。单面镜 (3,1) 背灯朝南（state 2）：北行光被反折，不亮。
    state.placements = [{ at: [3, 1], kind: 'single', state: 2 }];
    expect(traceReflection(level, state).litLights).toBe(0);
    // 背灯朝北（state 0）：北行光击中背灯，被吸收并点亮。
    state.placements = [{ at: [3, 1], kind: 'single', state: 0 }];
    const trace = traceReflection(level, state);
    expect(trace.litLights).toBe(1);
    expect(trace.targets.some((target) => target.powered)).toBe(true);
  });

  it('背灯达标但闸门未通过时仍不获胜（第 5 关教学场景）', () => {
    const level = LEVELS[4];
    const state = initialReflectionState(level);
    state.pieceStates = [1, 1, 2]; // S1 已点亮，闸门仍为东西向
    const trace = traceReflection(level, state);
    expect(trace.litLights).toBeGreaterThanOrEqual(trace.lightTargets);
    expect(trace.checkpointsPassed).toBe(0);
    expect(trace.won).toBe(false);
  });

  it('闸门穿过次数超额时不获胜', () => {
    // 光网绕回同一闸门：E→分光→南穿闸门→西折→北再穿闸门，共 2 次 > 1。
    const level: LevelConfig = {
      id: 90, name: '超额测试', subtitle: '', chapter: '测试',
      size: 5, source: [0, 2], sourceDirection: 0,
      reflection: {
        lightTargets: 0, sourceRotatable: false,
        pieces: [
          { id: 'P1', kind: 'splitter', at: [2, 2], state: 1, locked: false },
          { id: 'M1', kind: 'mirror', at: [4, 2], state: 1, locked: false },
          { id: 'M2', kind: 'mirror', at: [4, 4], state: 0, locked: false },
          { id: 'M3', kind: 'mirror', at: [2, 4], state: 1, locked: false },
          { id: 'C1', kind: 'checkpoint', at: [2, 3], state: 0, locked: false },
        ],
        inventory: [],
      },
      district: 0, districtCenter: [-5, -5], parMoves: 1,
    };
    const trace = traceReflection(level, initialReflectionState(level));
    expect(trace.checkpointsPassed).toBe(2);
    expect(trace.checkpointsTotal).toBe(1);
    expect(trace.unhitPieces).toEqual([]);
    expect(trace.won).toBe(false);
  });

  it('parMoves 不小于参考解所需的操作数', () => {
    for (const fixture of SOLUTIONS) {
      expect(LEVELS[fixture.levelId].parMoves).toBeLessThanOrEqual(fixture.minMovesUpperBound);
    }
  });
});
