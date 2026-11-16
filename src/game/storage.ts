import { LEVELS } from './levels';

export interface BestScore {
  moves: number;
  stars: number;
}

export interface SaveData {
  currentLevel: number;
  completed: number[];
  best: Record<number, BestScore>;
  muted: boolean;
}

const STORAGE_KEY = 'light-up-the-city-v2';
const LEVEL_COUNT = LEVELS.length;
const DEFAULT_SAVE: SaveData = { currentLevel: 0, completed: [], best: {}, muted: true };

export function loadSave(): SaveData {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (!value || typeof value !== 'object') return { ...DEFAULT_SAVE, best: {} };
    const data = value as Partial<SaveData>;
    const completed = Array.isArray(data.completed)
      ? [...new Set(data.completed.filter((item): item is number => Number.isInteger(item) && item >= 0 && item < LEVEL_COUNT))].sort((a, b) => a - b)
      : [];
    const currentLevel = Number.isInteger(data.currentLevel)
      ? Math.max(0, Math.min(LEVEL_COUNT - 1, data.currentLevel!))
      : Math.min(completed.length, LEVEL_COUNT - 1);
    const best: Record<number, BestScore> = {};
    if (data.best && typeof data.best === 'object') {
      for (const [key, score] of Object.entries(data.best)) {
        const id = Number(key);
        if (!Number.isInteger(id) || id < 0 || id >= LEVEL_COUNT || !score || typeof score !== 'object') continue;
        const candidate = score as Partial<BestScore>;
        if (Number.isInteger(candidate.moves) && candidate.moves! >= 0 && Number.isInteger(candidate.stars)) {
          best[id] = { moves: candidate.moves!, stars: Math.max(1, Math.min(3, candidate.stars!)) };
        }
      }
    }
    return { currentLevel, completed, best, muted: typeof data.muted === 'boolean' ? data.muted : true };
  } catch {
    return { ...DEFAULT_SAVE, best: {} };
  }
}

export function writeSave(data: SaveData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // The game remains fully playable when browser storage is unavailable.
  }
}

export function clearProgress(muted: boolean): SaveData {
  const data: SaveData = { ...DEFAULT_SAVE, best: {}, muted };
  writeSave(data);
  return data;
}