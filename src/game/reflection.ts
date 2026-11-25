import type { Direction, GridPoint, LevelConfig, PieceKind, ReflectionConfig } from './levels';
import type { BeamPath, TargetState, TraceResult } from './optics';

/*
 * Reflection 规则引擎（移植自 OrangoMango/Reflection, MIT License）。
 * 与原作 Laser.java/World.java/PlayScreen.java 的胜利条件一一对应：
 *  1. 所有器件（镜面/分光镜/单面镜/闸门，含玩家放置的）都被光命中 (allLaser)
 *  2. 点亮的背灯数 >= lightTargets (onLights >= targets)
 *  3. 库存清空 (inventory.isEmpty)
 *  4. 闸门通过次数恰好等于闸门总数（含库存中的闸门，重复通过会超额而失败）
 * 方向约定沿用 optics.ts：0=E(+x) 1=S(+z) 2=W(-x) 3=N(-z)。
 * 原作方向 r(0=N,1=E,2=S,3=W) 对应本引擎 (r+3)%4。
 */

export interface Placement {
  at: GridPoint;
  kind: PieceKind;
  state: number;
}

export interface ReflectionGameState {
  pieceStates: number[];
  placements: Placement[];
  sourceDirection: Direction;
}

export interface CheckpointVisualState {
  id: string;
  at: GridPoint;
  activated: boolean;
}

export interface ReflectionTrace extends TraceResult {
  litLights: number;
  lightTargets: number;
  checkpointsPassed: number;
  checkpointsTotal: number;
  checkpoints: CheckpointVisualState[];
  inventoryLeft: number;
  unhitPieces: string[];
  won: boolean;
}

const MIRROR_TABLE: Record<number, readonly Direction[]> = {
  0: [3, 2, 1, 0], // '/'
  1: [1, 0, 3, 2], // '\'
};

// single 第 s 态：背灯朝向 (s+3)%4；只反射两个方向，其余被吸收。
const SINGLE_TABLE: Record<number, Partial<Record<Direction, Direction>>> = {
  0: { 1: 0, 2: 3 },
  1: { 3: 0, 2: 1 },
  2: { 3: 2, 0: 1 },
  3: { 1: 2, 0: 3 },
};

const singleBack = (state: number): Direction => (((state + 3) % 4) as Direction);

interface BoardEntry {
  kind: PieceKind | 'block' | 'laser';
  state: number;
  id: string;
  device: boolean;
}

const key = ([x, z]: GridPoint): string => `${x},${z}`;

export function initialReflectionState(level: LevelConfig): ReflectionGameState {
  const reflection = level.reflection!;
  return {
    pieceStates: reflection.pieces.map((piece) => piece.state),
    placements: [],
    sourceDirection: level.sourceDirection,
  };
}

export function inventoryLeft(level: LevelConfig, state: ReflectionGameState): Record<PieceKind, number> {
  const reflection = level.reflection!;
  const left: Record<PieceKind, number> = { mirror: 0, splitter: 0, single: 0, checkpoint: 0 };
  for (const item of reflection.inventory) left[item.kind] += item.count;
  for (const placement of state.placements) left[placement.kind] -= 1;
  return left;
}

export function buildBoard(level: LevelConfig, state: ReflectionGameState): Map<string, BoardEntry> {
  const reflection = level.reflection;
  const board = new Map<string, BoardEntry>();
  board.set(key(level.source), { kind: 'laser', state: 0, id: 'laser', device: false });
  reflection.pieces.forEach((piece, index) => {
    board.set(key(piece.at), { kind: piece.kind, state: state.pieceStates[index], id: piece.id, device: true });
  });
  state.placements.forEach((placement, index) => {
    board.set(key(placement.at), { kind: placement.kind, state: placement.state, id: `放置${index + 1}`, device: true });
  });
  return board;
}

export function canPlaceAt(level: LevelConfig, state: ReflectionGameState, at: GridPoint): boolean {
  const reflection = level.reflection!;
  const [x, z] = at;
  if (x < 0 || z < 0 || x >= level.size || z >= level.size) return false;
  if (buildBoard(level, state).has(key(at))) return false;
  if (reflection.placementZones && !reflection.placementZones.some((zone) => zone[0] === x && zone[1] === z)) return false;
  return true;
}

export function placementZones(level: LevelConfig, state: ReflectionGameState): GridPoint[] {
  const zones: GridPoint[] = [];
  for (let z = 0; z < level.size; z += 1) {
    for (let x = 0; x < level.size; x += 1) {
      if (canPlaceAt(level, state, [x, z])) zones.push([x, z]);
    }
  }
  return zones;
}

export function traceReflection(level: LevelConfig, state: ReflectionGameState): ReflectionTrace {
  const reflection: ReflectionConfig = level.reflection!;
  const board = buildBoard(level, state);
  const hit = new Set<string>();
  const lit = new Set<string>();
  const checkpointPassedById = new Map<string, boolean>();
  let checkpointsPassed = 0;

  const beams: BeamPath[] = [];
  const visited = new Set<string>();
  let branchCounter = 0;
  let guard = 0;

  const queue: { x: number; z: number; dir: Direction; branch: number; points: GridPoint[] }[] = [
    { x: level.source[0], z: level.source[1], dir: state.sourceDirection, branch: 0, points: [level.source] },
  ];
  visited.add(`${level.source[0]},${level.source[1]},${state.sourceDirection}`);

  while (queue.length && guard < 4096) {
    const seed = queue.shift()!;
    let { x, z, dir } = seed;
    const points = seed.points;
    const branch = seed.branch;

    for (let steps = 0; steps < 256; steps += 1) {
      guard += 1;
      const dx = dir === 0 ? 1 : dir === 2 ? -1 : 0;
      const dz = dir === 1 ? 1 : dir === 3 ? -1 : 0;
      x += dx;
      z += dz;

      if (x < 0 || z < 0 || x >= level.size || z >= level.size) {
        points.push([x, z]);
        beams.push({ points, end: 'boundary', energy: 1, branch });
        break;
      }

      const visitKey = `${x},${z},${dir}`;
      if (visited.has(visitKey)) {
        points.push([x, z]);
        beams.push({ points, end: 'loop', energy: 1, branch });
        break;
      }
      visited.add(visitKey);

      const cellKey = `${x},${z}`;
      const entry = board.get(cellKey);
      points.push([x, z]);
      if (!entry) continue;
      if (entry.kind === 'block') {
        beams.push({ points, end: 'obstacle', energy: 1, branch });
        break;
      }
      if (entry.kind === 'laser') {
        beams.push({ points, end: 'absorbed', energy: 1, branch });
        break;
      }
      hit.add(cellKey);

      if (entry.kind === 'single') {
        if (dir === singleBack(entry.state)) {
          lit.add(cellKey);
          beams.push({ points, end: 'absorbed', energy: 1, branch, targetId: entry.id });
          break;
        }
        const outgoing = SINGLE_TABLE[entry.state][dir];
        if (outgoing === undefined) {
          beams.push({ points, end: 'absorbed', energy: 1, branch });
          break;
        }
        dir = outgoing;
        continue;
      }
      if (entry.kind === 'checkpoint') {
        const axisOk = entry.state === 0 ? (dir === 1 || dir === 3) : (dir === 0 || dir === 2);
        if (axisOk) {
          checkpointsPassed += 1;
          checkpointPassedById.set(entry.id, true);
        }
        continue;
      }
      if (entry.kind === 'splitter') {
        branchCounter += 1;
        queue.push({ x, z, dir, branch: branchCounter, points: [[x, z]] });
        dir = MIRROR_TABLE[entry.state][dir];
        continue;
      }
      dir = MIRROR_TABLE[entry.state][dir];
    }
  }

  const deviceCells = [...board.entries()].filter(([, entry]) => entry.device);
  const unhitPieces = deviceCells.filter(([cellKey]) => !hit.has(cellKey)).map(([, entry]) => entry.id);
  const left = inventoryLeft(level, state);
  const inventoryLeftTotal = Math.max(0, left.mirror) + Math.max(0, left.splitter) + Math.max(0, left.single) + Math.max(0, left.checkpoint);
  const checkpointPieces = reflection.pieces.filter((piece) => piece.kind === 'checkpoint');
  const inventoryCheckpoints = reflection.inventory.find((item) => item.kind === 'checkpoint')?.count ?? 0;
  const checkpointsTotal = checkpointPieces.length + inventoryCheckpoints;

  const singleEntries = [...board.entries()].filter(([, entry]) => entry.kind === 'single');
  const targets: TargetState[] = singleEntries.map(([cellKey, entry]) => {
    const [cx, cz] = cellKey.split(',').map(Number);
    const isLit = lit.has(cellKey);
    return { id: entry.id, at: [cx, cz] as GridPoint, required: 1, received: isLit ? 1 : 0, powered: isLit };
  });

  const won = unhitPieces.length === 0
    && lit.size >= reflection.lightTargets
    && inventoryLeftTotal === 0
    && checkpointsPassed === checkpointsTotal;

  return {
    beams,
    targets,
    allPowered: won,
    reflections: hit.size,
    litLights: lit.size,
    lightTargets: reflection.lightTargets,
    checkpointsPassed,
    checkpointsTotal,
    checkpoints: checkpointPieces.map((piece) => ({
      id: piece.id, at: piece.at, activated: checkpointPassedById.get(piece.id) === true,
    })),
    inventoryLeft: inventoryLeftTotal,
    unhitPieces,
    won,
  };
}

/** 一次操作的最小点击数（放置=1，取回=1，状态循环到目标态的点击数）。 */
export function stateCycleCost(kind: PieceKind | 'laser', from: number, to: number): number {
  const modulus = kind === 'single' || kind === 'laser' ? 4 : 2;
  return (((to - from) % modulus) + modulus) % modulus;
}
