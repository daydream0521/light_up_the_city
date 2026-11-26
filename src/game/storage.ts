import { isLevelUnlocked } from './journey';
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

const STORAGE_KEY = 'light-up-the-city-v3';
const LEGACY_KEY = 'light-up-the-city-v2';
const LEVEL_COUNT = LEVELS.length;
const newSave = (muted = true): SaveData => ({ currentLevel: 0, completed: [], best: {}, muted });

/** 关卡重排后旧进度按 ID 对应不上新关卡，直接重置进度，仅保留静音偏好。 */
function legacyMuted(): boolean | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(LEGACY_KEY) ?? 'null');
    if (value && typeof value === 'object' && typeof (value as Partial<SaveData>).muted === 'boolean') {
      return (value as SaveData).muted;
    }
  } catch {
    // Ignore unreadable legacy saves.
  }
  return null;
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      const migrated = legacyMuted();
      return newSave(migrated ?? true);
    }
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return newSave();
    const data = value as Partial<SaveData>;
    const completed = Array.isArray(data.completed)
      ? [...new Set(data.completed.filter((item): item is number => Number.isInteger(item) && item >= 0 && item < LEVEL_COUNT))].sort((a, b) => a - b)
      : [];
    const currentLevel = typeof data.currentLevel === 'number' && isLevelUnlocked(data.currentLevel, completed)
      ? data.currentLevel
      : LEVELS.find(level => !completed.includes(level.id) && isLevelUnlocked(level.id, completed))?.id ?? LEVEL_COUNT - 1;
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
    return newSave();
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
  const data = newSave(muted);
  writeSave(data);
  return data;
}