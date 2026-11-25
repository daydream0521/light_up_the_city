import { describe, expect, it } from 'vitest';
import { initialReflectionState, traceReflection } from '../src/game/reflection';
import { newPuzzle, puzzleLevel, readSharedPuzzle } from '../src/game/workshop';

const encode = (value: unknown) => Buffer.from(JSON.stringify(value), 'utf-8').toString('base64url');

describe('shared puzzles', () => {
  it('decodes Unicode and restores starting conditions for the existing tracer', () => {
    const puzzle = newPuzzle();
    puzzle.name = '运河旁的光 🌙';
    puzzle.pieces.push({ kind: 'single', at: [3, 2], state: 1, locked: true });
    const restored = readSharedPuzzle(encode(puzzle));
    expect(restored).toEqual(puzzle);
    const level = puzzleLevel(restored!);
    expect(traceReflection(level, initialReflectionState(level)).won).toBe(true);
  });

  it.each([
    { kind: 'laser', at: [3, 2], state: 0, locked: true },
    { kind: 'mirror', at: [5, 2], state: 0, locked: false },
    { kind: 'single', at: [0, 2], state: 1, locked: true },
    { kind: 'checkpoint', at: [3, 2], state: 2, locked: true },
    { kind: 'splitter', at: [3, 2], state: 0, locked: 'false' },
  ])('rejects an invalid preset %j', (piece) => {
    expect(readSharedPuzzle(encode({ ...newPuzzle(), pieces: [piece] }))).toBeNull();
  });

  it('rejects two presets occupying one cell and malformed data', () => {
    const piece = { kind: 'mirror', at: [3, 2], state: 0, locked: false };
    expect(readSharedPuzzle(encode({ ...newPuzzle(), pieces: [piece, piece] }))).toBeNull();
    expect(readSharedPuzzle('broken!!')).toBeNull();
    expect(readSharedPuzzle(encode({ ...newPuzzle(), district: 4 }))).toBeNull();
  });
});
