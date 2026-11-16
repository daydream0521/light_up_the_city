export interface SaveData {
  currentLevel: number;
  completed: number[];
  muted: boolean;
}

const STORAGE_KEY = 'light-up-the-city-v1';
const DEFAULT_SAVE: SaveData = { currentLevel: 0, completed: [], muted: true };

export function loadSave(): SaveData {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (!value || typeof value !== 'object') return { ...DEFAULT_SAVE };
    const data = value as Partial<SaveData>;
    const completed = Array.isArray(data.completed)
      ? [...new Set(data.completed.filter((item): item is number => Number.isInteger(item) && item >= 0 && item < 4))]
      : [];
    const currentLevel = Number.isInteger(data.currentLevel)
      ? Math.max(0, Math.min(3, data.currentLevel!))
      : Math.min(completed.length, 3);
    return { currentLevel, completed, muted: typeof data.muted === 'boolean' ? data.muted : true };
  } catch {
    return { ...DEFAULT_SAVE };
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
  const data = { ...DEFAULT_SAVE, muted };
  writeSave(data);
  return data;
}
