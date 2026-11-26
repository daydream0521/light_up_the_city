import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { isLevelUnlocked } from '../src/game/journey';
import { clearProgress, loadSave, writeSave } from '../src/game/storage';

beforeEach(() => {
  const records = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => records.get(key) ?? null,
    setItem: (key: string, value: string) => records.set(key, value),
  });
});

afterEach(() => vi.unstubAllGlobals());

it('restores Shanghai progress and independently unlocks the first level of every city', () => {
  const save = loadSave();
  save.currentLevel = 18;
  save.completed.push(17);
  save.best[17] = { moves: 7, stars: 3 };
  writeSave(save);
  const restored = loadSave();
  expect(restored).toEqual(save);
  for (const level of [0, 9, 17, 18]) expect(isLevelUnlocked(level, restored.completed)).toBe(true);
  for (const level of [1, 10, 19]) expect(isLevelUnlocked(level, restored.completed)).toBe(false);
});

it('starts a new journey after playing from an empty save in the same session', () => {
  const save = loadSave();
  save.completed.push(0);
  save.best[0] = { moves: 3, stars: 3 };
  writeSave(save);
  expect(clearProgress(false)).toEqual({ currentLevel: 0, completed: [], best: {}, muted: false });
  expect(loadSave().completed).toEqual([]);
});
