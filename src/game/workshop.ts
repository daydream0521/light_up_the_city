import { DISTRICT_CENTERS, type Direction, type GridPoint, type LevelConfig, type PieceKind } from './levels';

export const BOARD_SIZE = 5;
export const PIECE_KINDS = ['mirror', 'splitter', 'single', 'checkpoint'] as const;
export const DISTRICTS = ['住宅街区', '商业街区', '工业街区', '市政街区'];
export const NAME_LIMIT = 32;

export interface Preset {
  kind: PieceKind;
  at: GridPoint;
  state: number;
  locked: boolean;
}

export interface Puzzle {
  name: string;
  district: number;
  source: GridPoint;
  sourceDirection: Direction;
  sourceRotatable: boolean;
  pieces: Preset[];
  inventory: Record<PieceKind, number>;
  lightTargets: number;
}

export interface Work {
  id: string;
  updated: number;
  verified: boolean;
  puzzle: Puzzle;
}

export function newPuzzle(): Puzzle {
  return {
    name: '未命名关卡', district: 0, source: [0, 2], sourceDirection: 0, sourceRotatable: false,
    pieces: [], inventory: { mirror: 0, splitter: 0, single: 0, checkpoint: 0 }, lightTargets: 1,
  };
}

export function puzzleLevel(puzzle: Puzzle): LevelConfig {
  return {
    id: -1, name: puzzle.name, chapter: '造光工坊', subtitle: DISTRICTS[puzzle.district],
    size: BOARD_SIZE, district: puzzle.district, districtCenter: DISTRICT_CENTERS[puzzle.district],
    source: puzzle.source, sourceDirection: puzzle.sourceDirection, parMoves: 0,
    reflection: {
      sourceRotatable: puzzle.sourceRotatable, lightTargets: puzzle.lightTargets,
      pieces: puzzle.pieces.map((piece, index) => ({ ...piece, id: `预置${index + 1}` })),
      inventory: PIECE_KINDS.filter((kind) => puzzle.inventory[kind] > 0)
        .map((kind) => ({ kind, count: puzzle.inventory[kind] })),
    },
  };
}

const WORK_PREFIX = 'light-up-the-city-work:';

export function readWorks(): Work[] {
  const works: Work[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key?.startsWith(WORK_PREFIX)) continue;
    const raw = localStorage.getItem(key);
    if (raw !== null) works.push(JSON.parse(raw) as Work);
  }
  return works.sort((a, b) => b.updated - a.updated);
}

export function saveWork(work: Work): void {
  localStorage.setItem(WORK_PREFIX + work.id, JSON.stringify(work));
}

export function deleteWork(id: string): void {
  localStorage.removeItem(WORK_PREFIX + id);
}

export function shareLink(puzzle: Puzzle): string {
  const bytes = new TextEncoder().encode(JSON.stringify(puzzle));
  const encoded = btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
  const url = new URL(location.href);
  url.hash = `level=${encoded}`;
  return url.href;
}

const integer = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const cell = (value: unknown): value is GridPoint =>
  Array.isArray(value) && value.length === 2 && value.every((axis) => integer(axis, 0, BOARD_SIZE - 1));

export function readSharedPuzzle(encoded: string): Puzzle | null {
  if (encoded.length > 8192 || !/^[\w-]+$/.test(encoded)) return null;
  try {
    const decoded = atob(encoded.replaceAll('-', '+').replaceAll('_', '/'));
    const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(decoded, (c) => c.charCodeAt(0))));
    const capacity = BOARD_SIZE ** 2 - 1;
    if (!object(value)) return null;
    const { name, district, source, sourceDirection, sourceRotatable, pieces, inventory, lightTargets } = value;
    if (typeof name !== 'string' || !name.trim() || name.length > NAME_LIMIT
      || !integer(district, 0, DISTRICTS.length - 1) || !cell(source)
      || !integer(sourceDirection, 0, 3) || typeof sourceRotatable !== 'boolean'
      || !Array.isArray(pieces) || pieces.length > capacity || !object(inventory)
      || !integer(lightTargets, 1, capacity)) return null;
    const counts = newPuzzle().inventory;
    for (const kind of PIECE_KINDS) {
      const count = inventory[kind];
      if (!integer(count, 0, capacity)) return null;
      counts[kind] = count;
    }
    const occupied = new Set([source.join(',')]);
    const presets: Preset[] = [];
    for (const piece of pieces) {
      if (!object(piece)) return null;
      const kind = PIECE_KINDS.find((candidate) => candidate === piece.kind);
      if (!kind || !cell(piece.at) || !integer(piece.state, 0, kind === 'single' ? 3 : 1)
        || typeof piece.locked !== 'boolean' || occupied.has(piece.at.join(','))) return null;
      occupied.add(piece.at.join(','));
      presets.push({ kind, at: piece.at, state: piece.state, locked: piece.locked });
    }
    return { name, district, source, sourceDirection: sourceDirection as Direction, sourceRotatable, pieces: presets, inventory: counts, lightTargets };
  } catch {
    return null;
  }
}
