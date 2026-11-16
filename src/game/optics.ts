import type { Direction, GridPoint, LevelConfig, MirrorOrientation } from './levels';

export type TraceEnd = 'target' | 'obstacle' | 'boundary' | 'loop';

export interface TraceResult {
  points: GridPoint[];
  hitTarget: boolean;
  end: TraceEnd;
}

const DIRECTIONS: readonly GridPoint[] = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const REFLECTIONS: Record<MirrorOrientation, readonly Direction[]> = {
  '/': [3, 2, 1, 0],
  '\\': [1, 0, 3, 2],
};

const key = ([x, z]: GridPoint) => `${x},${z}`;

export function reflect(direction: Direction, mirror: MirrorOrientation): Direction {
  return REFLECTIONS[mirror][direction];
}

export function traceLight(level: LevelConfig, orientations: readonly MirrorOrientation[]): TraceResult {
  const mirrors = new Map(level.mirrors.map((mirror) => [key(mirror.at), mirror]));
  const obstacles = new Set(level.obstacles.map(key));
  const target = key(level.target);
  const visited = new Set<string>();
  const points: GridPoint[] = [level.source];
  let [x, z] = level.source;
  let direction = level.sourceDirection;

  for (let steps = 0; steps < 512; steps += 1) {
    const [dx, dz] = DIRECTIONS[direction];
    x += dx;
    z += dz;

    if (x < 0 || z < 0 || x >= level.size || z >= level.size) {
      points.push([x, z]);
      return { points, hitTarget: false, end: 'boundary' };
    }

    const current: GridPoint = [x, z];
    const currentKey = key(current);
    if (currentKey === target) {
      points.push(current);
      return { points, hitTarget: true, end: 'target' };
    }
    if (obstacles.has(currentKey)) {
      points.push(current);
      return { points, hitTarget: false, end: 'obstacle' };
    }

    const mirror = mirrors.get(currentKey);
    if (mirror) {
      points.push(current);
      const orientation = orientations[level.mirrors.indexOf(mirror)];
      direction = reflect(direction, orientation);
      const state = `${currentKey},${direction}`;
      if (visited.has(state)) {
        return { points, hitTarget: false, end: 'loop' };
      }
      visited.add(state);
    }
  }

  return { points, hitTarget: false, end: 'loop' };
}
