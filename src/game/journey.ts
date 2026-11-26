import { LEVELS } from './levels';

export const CITIES = [
  { name: '雨夜之城', region: '现代雨夜 · 屋顶与运河', key: 'rain', first: 0, end: 9, districts: ['住宅街区', '商业街区', '工业街区', '市政街区'],
    title: ['点亮', '夜城'], english: 'Light Up the City',
    description: '翻转屋顶的镜面，安放器件、转动光塔，\n让光束穿过街角，抵达每一盏等待亮起的背灯。' },
  { name: '爱琴余晖', region: '古希腊 · 海港与卫城', key: 'aegean', first: 9, end: 17, districts: ['港口', '市集', '剧场', '卫城'],
    title: ['爱琴', '余晖'], english: 'Aegean Twilight', description: '循着光的轨迹，唤醒爱琴海畔的城邦。' },
  { name: '两岸灯火', region: '上海 · 黄浦江两岸', key: 'shanghai', first: 17, end: 25, districts: ['外滩', '滨江', '东方明珠', '陆家嘴'],
    title: ['两岸', '灯火'], english: 'Shanghai in Lights', description: '让灯火沿着黄浦江亮起，连接沉睡的两岸。' },
] as const;

export type CityIndex = 0 | 1 | 2;

export function cityOf(level: number): CityIndex {
  return LEVELS[level]?.city ?? 0;
}

export function chapterStatus(city: number, completed: readonly number[]) {
  const { first, end } = CITIES[city];
  const done = completed.filter(id => id >= first && id < end).length;
  return {
    done,
    complete: done === end - first,
    next: LEVELS.slice(first, end).find(level => !completed.includes(level.id))?.id ?? first,
  };
}

export function isLevelUnlocked(level: number, completed: readonly number[]): boolean {
  if (!LEVELS[level]) return false;
  return completed.includes(level) || LEVELS.slice(CITIES[cityOf(level)].first, level)
    .every(entry => completed.includes(entry.id));
}

export function phaseProgress(city: number, completed: readonly number[]): number[] {
  return [0, 1, 2, 3].map((district) => {
    const ids = LEVELS.filter((level) => (level.city ?? 0) === city && level.district === district).map((level) => level.id);
    return ids.filter((id) => completed.includes(id)).length / ids.length;
  });
}
