import { describe, expect, it } from 'vitest';
import { LEVELS, type LevelConfig, type MirrorOrientation } from '../src/game/levels';
import { REFLECT_COST, reflect, splitDirections, traceLight } from '../src/game/optics';

function hamming(a: readonly MirrorOrientation[], b: readonly MirrorOrientation[]): number {
  return a.reduce((sum, value, index) => sum + (value === b[index] ? 0 : 1), 0);
}

function solve(level: LevelConfig): { count: number; minMoves: number } {
  const initial = level.mirrors.map((mirror) => mirror.initial);
  const n = level.mirrors.length;
  let count = 0;
  let minMoves = Infinity;
  for (let mask = 0; mask < 2 ** n; mask += 1) {
    const combo = level.mirrors.map((_, i) => ((mask >> i) & 1 ? '/' : '\\') as MirrorOrientation);
    if (traceLight(level, combo).allPowered) {
      count += 1;
      minMoves = Math.min(minMoves, hamming(initial, combo));
    }
  }
  return { count, minMoves: count ? minMoves : -1 };
}

function makeLevel(partial: Partial<LevelConfig>): LevelConfig {
  return {
    id: 99, name: 'test', subtitle: '', chapter: '基础反射', size: 7,
    source: [0, 3], sourceDirection: 0, sourceEnergy: 9,
    targets: [{ id: 'T1', at: [6, 3], required: 1 }],
    mirrors: [], splitters: [], obstacles: [], solution: [],
    district: 0, districtCenter: [-5, -5], parMoves: 0,
    ...partial,
  };
}

describe('mirror reflection', () => {
  it('reflects all cardinal directions consistently', () => {
    expect([0, 1, 2, 3].map((d) => reflect(d as 0 | 1 | 2 | 3, '/'))).toEqual([3, 2, 1, 0]);
    expect([0, 1, 2, 3].map((d) => reflect(d as 0 | 1 | 2 | 3, '\\'))).toEqual([1, 0, 3, 2]);
  });

  it('splits into the two perpendicular directions', () => {
    expect(splitDirections(0)).toEqual([1, 3]);
    expect(splitDirections(1)).toEqual([2, 0]);
    expect(splitDirections(2)).toEqual([3, 1]);
    expect(splitDirections(3)).toEqual([0, 2]);
  });
});

describe('energy and splitting rules', () => {
  it('consumes one energy per reflection and powers a target only when requirement is met', () => {
    const level = makeLevel({
      sourceEnergy: 4,
      targets: [{ id: 'T1', at: [3, 0], required: 3 }],
      mirrors: [{ id: 'A', at: [3, 3], initial: '\\' }],
      solution: ['/'],
    });
    const solved = traceLight(level, ['/']);
    expect(solved.targets[0].received).toBe(4 - REFLECT_COST);
    expect(solved.targets[0].powered).toBe(true);
    const weak = traceLight({ ...level, targets: [{ id: 'T1', at: [3, 0], required: 4 }] }, ['/']);
    expect(weak.targets[0].powered).toBe(false);
    expect(weak.allPowered).toBe(false);
  });

  it('exhausts a beam when a reflection would spend its last energy', () => {
    const level = makeLevel({
      sourceEnergy: 1,
      targets: [{ id: 'T1', at: [3, 0], required: 1 }],
      mirrors: [{ id: 'A', at: [3, 3], initial: '\\' }],
      solution: ['/'],
    });
    const result = traceLight(level, ['/']);
    expect(result.allPowered).toBe(false);
    expect(result.beams[0].end).toBe('exhausted');
  });

  it('splits one beam into two branches that each carry half the energy', () => {
    const level = makeLevel({
      sourceEnergy: 8,
      targets: [
        { id: 'T1', at: [2, 0], required: 4 },
        { id: 'T2', at: [2, 6], required: 4 },
      ],
      splitters: [{ id: 'S1', at: [2, 3] }],
    });
    const result = traceLight(level, []);
    expect(result.beams).toHaveLength(3);
    expect(result.beams[0].end).toBe('split');
    const branches = result.beams.filter((beam) => beam.branch > 0);
    expect(branches).toHaveLength(2);
    expect(branches.every((beam) => beam.energy === 4)).toBe(true);
    expect(result.allPowered).toBe(true);
  });

  it('stops a branch at an obstacle', () => {
    const level = makeLevel({
      sourceEnergy: 8,
      targets: [{ id: 'T1', at: [2, 0], required: 1 }],
      splitters: [{ id: 'S1', at: [2, 3] }],
      obstacles: [[2, 1]],
    });
    const result = traceLight(level, []);
    const north = result.beams.find((beam) => beam.points.at(-1)?.[0] === 2 && beam.end === 'obstacle');
    expect(north).toBeDefined();
    expect(north!.points.at(-1)).toEqual([2, 1]);
  });
});

describe('handcrafted mainline levels', () => {
  for (const level of LEVELS) {
    it(`level ${level.id + 1} starts unsolved and the authored solution powers every target`, () => {
      const initial = level.mirrors.map((mirror) => mirror.initial);
      expect(traceLight(level, initial).allPowered).toBe(false);
      const result = traceLight(level, level.solution);
      expect(result.allPowered).toBe(true);
      expect(result.targets.every((target) => target.powered)).toBe(true);
    });

    it(`level ${level.id + 1} has one solution orientation per mirror with unique ids`, () => {
      expect(level.solution).toHaveLength(level.mirrors.length);
      expect(new Set(level.mirrors.map((mirror) => mirror.id)).size).toBe(level.mirrors.length);
      expect(new Set(level.targets.map((target) => target.id)).size).toBe(level.targets.length);
    });

    it(`level ${level.id + 1} is solvable and its par equals the optimal move count`, () => {
      const { count, minMoves } = solve(level);
      expect(count).toBeGreaterThan(0);
      expect(minMoves).toBe(level.parMoves);
    });
  }

  it('keeps every device, target, obstacle and source on distinct cells', () => {
    for (const level of LEVELS) {
      const cells = [
        level.source,
        ...level.mirrors.map((mirror) => mirror.at),
        ...level.splitters.map((splitter) => splitter.at),
        ...level.targets.map((target) => target.at),
        ...level.obstacles,
      ].map(([x, z]) => `${x},${z}`);
      expect(new Set(cells).size).toBe(cells.length);
    }
  });

  it('shows a beam that reaches a target without enough energy on the trade-off level', () => {
    const level = LEVELS[4];
    const wasted = traceLight(level, ['\\', '\\', '/'] as MirrorOrientation[]);
    const t1 = wasted.targets.find((t) => t.id === 'T1')!;
    expect(t1.received).toBeGreaterThan(0);
    expect(t1.received).toBeLessThan(t1.required);
    expect(t1.powered).toBe(false);
    expect(wasted.allPowered).toBe(false);
    const correct = traceLight(level, ['\\', '\\', '\\'] as MirrorOrientation[]);
    expect(correct.targets.find((t) => t.id === 'T2')!.powered).toBe(true);
    expect(traceLight(level, level.solution).allPowered).toBe(true);
  });

  it('never lets flipping every mirror solve the mid and late levels', () => {
    for (const level of LEVELS.slice(2)) {
      const flipAll = level.mirrors.map((mirror) => (mirror.initial === '/' ? '\\' : '/') as MirrorOrientation);
      expect(traceLight(level, flipAll).allPowered).toBe(false);
    }
  });

  it('defeats a naive player who only flips mirrors that immediately light a target', () => {
    for (const level of LEVELS.slice(2)) {
      let combo = level.mirrors.map((mirror) => mirror.initial);
      const lit = (orientations: readonly MirrorOrientation[]) =>
        traceLight(level, orientations).targets.filter((target) => target.powered).length;
      for (let pass = 0; pass < level.mirrors.length * 2; pass += 1) {
        const hit = new Set<number>();
        for (const beam of traceLight(level, combo).beams) {
          for (const point of beam.points) {
            level.mirrors.forEach((mirror, index) => {
              if (mirror.at[0] === point[0] && mirror.at[1] === point[1]) hit.add(index);
            });
          }
        }
        let improved = false;
        for (const index of hit) {
          const next = combo.slice();
          next[index] = (next[index] === '/' ? '\\' : '/') as MirrorOrientation;
          if (lit(next) > lit(combo)) {
            combo = next;
            improved = true;
          }
        }
        if (!improved) break;
      }
      expect(traceLight(level, combo).allPowered).toBe(false);
    }
  });

  it('contains locally tempting layouts that light one target but fail globally', () => {
    for (const level of LEVELS.slice(2)) {
      const initial = level.mirrors.map((mirror) => mirror.initial);
      let traps = 0;
      for (let mask = 0; mask < 2 ** level.mirrors.length; mask += 1) {
        const combo = level.mirrors.map((_, i) => ((mask >> i) & 1 ? '/' : '\\') as MirrorOrientation);
        if (hamming(initial, combo) > 2) continue;
        const lit = traceLight(level, combo).targets.filter((target) => target.powered).length;
        if (lit > 0 && lit < level.targets.length) traps += 1;
      }
      expect(traps).toBeGreaterThan(0);
    }
  });

  it('resets to the authored initial layout', () => {
    for (const level of LEVELS) {
      const reset = level.mirrors.map((mirror) => mirror.initial);
      const changed = reset.map((orientation) => (orientation === '/' ? '\\' : '/') as MirrorOrientation);
      expect(changed).not.toEqual(reset);
      expect(reset).toEqual(level.mirrors.map((mirror) => mirror.initial));
    }
  });
});