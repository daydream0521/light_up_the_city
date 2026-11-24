import type { Direction, GridPoint, LevelConfig, MirrorOrientation } from './levels';

export type TraceEnd = 'target' | 'obstacle' | 'boundary' | 'exhausted' | 'split' | 'absorbed' | 'loop';

export interface BeamPath {
  points: GridPoint[];
  end: TraceEnd;
  energy: number;
  branch: number;
  targetId?: string;
}

export interface TargetState {
  id: string;
  at: GridPoint;
  required: number;
  received: number;
  powered: boolean;
}

export interface TraceResult {
  beams: BeamPath[];
  targets: TargetState[];
  allPowered: boolean;
  reflections: number;
}

export const REFLECT_COST = 1;

const DIRECTIONS: readonly GridPoint[] = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const REFLECTIONS: Record<MirrorOrientation, readonly Direction[]> = {
  '/': [3, 2, 1, 0],
  '\\': [1, 0, 3, 2],
};

const key = ([x, z]: GridPoint) => `${x},${z}`;

export function reflect(direction: Direction, mirror: MirrorOrientation): Direction {
  return REFLECTIONS[mirror][direction];
}

export function splitDirections(direction: Direction): readonly Direction[] {
  return [((direction + 1) % 4) as Direction, ((direction + 3) % 4) as Direction];
}

interface BeamSeed {
  x: number;
  z: number;
  direction: Direction;
  energy: number;
  branch: number;
  points: GridPoint[];
}

export function traceLight(level: LevelConfig, orientations: readonly MirrorOrientation[]): TraceResult {
  const mirrors = new Map(level.mirrors.map((mirror, index) => [key(mirror.at), index]));
  const splitters = new Set(level.splitters.map((splitter) => key(splitter.at)));
  const obstacles = new Set(level.obstacles.map(key));
  const targetByKey = new Map(level.targets.map((target) => [key(target.at), target]));
  const targets: TargetState[] = level.targets.map((target) => ({
    id: target.id, at: target.at, required: target.required, received: 0, powered: false,
  }));
  const targetStateById = new Map(targets.map((target) => [target.id, target]));

  const beams: BeamPath[] = [];
  const queue: BeamSeed[] = [{
    x: level.source[0], z: level.source[1], direction: level.sourceDirection,
    energy: level.sourceEnergy, branch: 0, points: [level.source],
  }];
  let branchCounter = 0;
  let reflections = 0;
  let guard = 0;

  while (queue.length && guard < 4096) {
    const seed = queue.shift()!;
    let { x, z, direction, energy } = seed;
    const points = seed.points;
    const branch = seed.branch;

    for (let steps = 0; steps < 512; steps += 1) {
      guard += 1;
      const [dx, dz] = DIRECTIONS[direction];
      x += dx;
      z += dz;

      if (x < 0 || z < 0 || x >= level.size || z >= level.size) {
        points.push([x, z]);
        beams.push({ points, end: 'boundary', energy, branch });
        break;
      }

      const current: GridPoint = [x, z];
      const currentKey = key(current);

      const target = targetByKey.get(currentKey);
      if (target) {
        points.push(current);
        const state = targetStateById.get(target.id)!;
        state.received = Math.max(state.received, energy);
        beams.push({ points, end: 'target', energy, branch, targetId: target.id });
        break;
      }
      if (obstacles.has(currentKey)) {
        points.push(current);
        beams.push({ points, end: 'obstacle', energy, branch });
        break;
      }
      if (splitters.has(currentKey)) {
        points.push(current);
        beams.push({ points, end: 'split', energy, branch });
        const half = Math.floor(energy / 2);
        if (half > 0) {
          for (const outgoing of splitDirections(direction)) {
            branchCounter += 1;
            queue.push({ x, z, direction: outgoing, energy: half, branch: branchCounter, points: [current] });
          }
        }
        break;
      }

      const mirrorIndex = mirrors.get(currentKey);
      if (mirrorIndex !== undefined) {
        points.push(current);
        reflections += 1;
        const remaining = energy - REFLECT_COST;
        if (remaining <= 0) {
          beams.push({ points, end: 'exhausted', energy: 0, branch });
          break;
        }
        direction = reflect(direction, orientations[mirrorIndex]);
        energy = remaining;
        continue;
      }
    }
  }

  for (const target of targets) target.powered = target.received >= target.required;
  const allPowered = targets.length > 0 && targets.every((target) => target.powered);
  return { beams, targets, allPowered, reflections };
}