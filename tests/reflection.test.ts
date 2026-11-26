import { describe, expect, it } from 'vitest';
import { LEVELS, type LevelConfig } from '../src/game/levels';
import { initialReflectionState, traceReflection, type Placement, type ReflectionGameState } from '../src/game/reflection';

import { playCell, type CellMove } from '../src/game/reflectionPlay';
import { SOLUTIONS, type SolutionFixture } from './campaign-solutions';


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

  it.each(SOLUTIONS.slice(9))('第 $levelId 号城市关卡可通过正常点格操作获胜', (fixture) => {
    const level = LEVELS[fixture.levelId];
    const state = initialReflectionState(level);
    const moves: CellMove[] = [];
    const rotate = (at: CellMove['at'], from: number, to: number, cycle: number) => {
      for (let i = 0; i < (to - from + cycle) % cycle; i += 1) moves.push({ at, tool: null });
    };
    rotate(level.source, level.sourceDirection, fixture.sourceDirection, 4);
    level.reflection.pieces.forEach((piece, index) => rotate(piece.at, piece.state, fixture.pieceStates[index],
      piece.kind === 'single' ? 4 : 2));
    for (const item of fixture.placements) {
      const at = [item.x, item.z] as const;
      moves.push({ at, tool: item.kind });
      rotate(at, 0, item.state, item.kind === 'single' ? 4 : 2);
    }
    expect(moves).toHaveLength(level.parMoves);
    for (const move of moves) {
      expect(['source', 'piece', 'place']).toContain(playCell(level, state, move));
      if (traceReflection(level, state).won) break;
    }
    expect(traceReflection(level, state).won).toBe(true);
  });

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
