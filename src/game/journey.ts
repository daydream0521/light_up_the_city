import { LEVELS } from './levels';

export const CITIES = [
  { name: '雨夜之城', region: '现代雨夜 · 屋顶与运河', key: 'rain', first: 0, end: 9 },
  { name: '爱琴余晖', region: '古希腊 · 海港与卫城', key: 'aegean', first: 9, end: 17 },
  { name: '两岸灯火', region: '上海 · 黄浦江两岸', key: 'shanghai', first: 17, end: 25 },
] as const;

export function cityOf(level: number): number {
  return LEVELS[level]?.city ?? 0;
}

export function phaseProgress(city: number, completed: readonly number[]): number[] {
  return [0, 1, 2, 3].map((district) => {
    const ids = LEVELS.filter((level) => (level.city ?? 0) === city && level.district === district).map((level) => level.id);
    return ids.filter((id) => completed.includes(id)).length / ids.length;
  });
}
