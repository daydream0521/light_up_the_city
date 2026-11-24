import { describe, expect, it } from 'vitest';
import { LEVELS, type Direction, type PieceKind } from '../src/game/levels';
import { initialReflectionState, traceReflection, type Placement, type ReflectionGameState } from '../src/game/reflection';

interface SolutionFixture {
  levelId: number;
  placements: { kind: PieceKind; x: number; z: number; state: number }[];
  pieceStates: number[];
  sourceDirection: Direction;
  minMovesUpperBound: number;
}

// 官方解来自 Reflection 仓库 src/main/resources/misc/solutions.data（MIT License）。
const OFFICIAL_SOLUTIONS: SolutionFixture[] = [
  { // Reflection 第一关 → 本作第 3 关「布光行囊」（SOLUTION 0）
    levelId: 2,
    placements: [
      { kind: 'mirror', x: 0, z: 1, state: 0 },
      { kind: 'mirror', x: 3, z: 1, state: 1 },
      { kind: 'single', x: 0, z: 3, state: 2 },
    ],
    pieceStates: [], sourceDirection: 3, minMovesUpperBound: 6,
  },
  { // Reflection LEVEL 2 → 本作第 4 关「闸口分光」（SOLUTION 3）
    levelId: 3,
    placements: [
      { kind: 'single', x: 4, z: 0, state: 2 },
      { kind: 'single', x: 0, z: 1, state: 1 },
      { kind: 'splitter', x: 4, z: 1, state: 1 },
      { kind: 'splitter', x: 0, z: 3, state: 1 },
      { kind: 'single', x: 4, z: 3, state: 1 },
    ],
    pieceStates: [3, 1, 0, 0], sourceDirection: 0, minMovesUpperBound: 15,
  },
  { // Reflection LEVEL 20 → 本作第 5 关「镜街二十」（SOLUTION 14）
    levelId: 4,
    placements: [
      { kind: 'single', x: 0, z: 0, state: 3 },
      { kind: 'mirror', x: 4, z: 1, state: 0 },
      { kind: 'splitter', x: 2, z: 2, state: 0 },
    ],
    pieceStates: [0, 2, 1, 1, 3, 2], sourceDirection: 3, minMovesUpperBound: 17,
  },
  { // Reflection LEVEL 99 → 本作第 6 关「万家灯火」（SOLUTION 30）
    levelId: 5,
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

function applySolution(levelId: number, fixture: SolutionFixture): { state: ReflectionGameState; level: (typeof LEVELS)[number] } {
  const level = LEVELS[levelId];
  const state = initialReflectionState(level);
  state.pieceStates = [...fixture.pieceStates];
  state.sourceDirection = fixture.sourceDirection;
  state.placements = fixture.placements.map((item): Placement => ({ at: [item.x, item.z], kind: item.kind, state: item.state }));
  return { state, level };
}

describe('reflection engine', () => {
  it.each(OFFICIAL_SOLUTIONS.map((fixture) => [fixture.levelId, fixture] as const))(
    '官方解在第 %i 关获胜',
    (levelId, fixture) => {
      const { state, level } = applySolution(levelId, fixture);
      const trace = traceReflection(level, state);
      expect({
        won: trace.won,
        unhit: trace.unhitPieces,
        lit: trace.litLights,
        targets: trace.lightTargets,
        cp: [trace.checkpointsPassed, trace.checkpointsTotal],
        left: trace.inventoryLeft,
      }).toEqual({
        won: true,
        unhit: [],
        lit: expect.any(Number),
        targets: level.reflection!.lightTargets,
        cp: expect.any(Array),
        left: 0,
      });
      expect(trace.litLights).toBeGreaterThanOrEqual(level.reflection!.lightTargets);
      expect(trace.checkpointsPassed).toBe(trace.checkpointsTotal);
    },
  );

  it('初始状态不获胜（每一关）', () => {
    for (const level of LEVELS) {
      if (!level.reflection) continue;
      const trace = traceReflection(level, initialReflectionState(level));
      expect(trace.won).toBe(false);
      expect(trace.inventoryLeft).toBeGreaterThan(0);
    }
  });

  it('库存未用完不能获胜', () => {
    const { state, level } = applySolution(2, OFFICIAL_SOLUTIONS[0]);
    state.placements = state.placements.slice(0, 2);
    expect(traceReflection(level, state).won).toBe(false);
  });

  it('存在未被照到的器件时不能获胜', () => {
    const { state, level } = applySolution(2, OFFICIAL_SOLUTIONS[0]);
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

  it('parMoves 不小于官方解所需的操作数', () => {
    for (const fixture of OFFICIAL_SOLUTIONS) {
      expect(LEVELS[fixture.levelId].parMoves).toBeLessThanOrEqual(fixture.minMovesUpperBound);
    }
  });
});
