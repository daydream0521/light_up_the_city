import { describe, expect, it } from 'vitest';
import { LEVELS, type MirrorOrientation } from '../src/game/levels';
import { reflect, traceLight } from '../src/game/optics';

describe('mirror reflection', () => {
  it('reflects all cardinal directions consistently', () => {
    expect([0, 1, 2, 3].map((direction) => reflect(direction as 0 | 1 | 2 | 3, '/'))).toEqual([3, 2, 1, 0]);
    expect([0, 1, 2, 3].map((direction) => reflect(direction as 0 | 1 | 2 | 3, '\\'))).toEqual([1, 0, 3, 2]);
  });
});

describe('handcrafted levels', () => {
  for (const level of LEVELS) {
    it(`level ${level.id + 1} starts unsolved and reaches its target with the authored solution`, () => {
      const initial = level.mirrors.map((mirror) => mirror.initial);
      expect(traceLight(level, initial).hitTarget).toBe(false);
      const result = traceLight(level, level.solution);
      expect(result.hitTarget).toBe(true);
      expect(result.end).toBe('target');
      expect(result.points.at(-1)).toEqual(level.target);
      expect(result.points).toHaveLength(level.mirrors.length + 2);
    });

    it(`level ${level.id + 1} has one solution orientation per mirror`, () => {
      expect(level.solution).toHaveLength(level.mirrors.length);
      expect(new Set(level.mirrors.map((mirror) => mirror.id)).size).toBe(level.mirrors.length);
    });
  }

  it('stops exactly at an authored obstacle', () => {
    const level = LEVELS[2];
    const initial = level.mirrors.map((mirror) => mirror.initial);
    const result = traceLight(level, initial);
    expect(result.end).toBe('obstacle');
    expect(result.points.at(-1)).toEqual([2, 0]);
  });

  it('resets to the authored initial layout', () => {
    for (const level of LEVELS) {
      const reset = level.mirrors.map((mirror) => mirror.initial);
      const changed: MirrorOrientation[] = reset.map((orientation) => orientation === '/' ? '\\' : '/');
      expect(changed).not.toEqual(reset);
      expect(reset).toEqual(level.mirrors.map((mirror) => mirror.initial));
    }
  });
});
