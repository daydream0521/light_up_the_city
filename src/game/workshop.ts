import { CITIES, type CityIndex } from './journey';
import { DISTRICT_CENTERS, type Direction, type GridPoint, type LevelConfig, type PieceKind } from './levels';

import { initialReflectionState, traceReflection } from './reflection';
import type { TrialSolution } from './reflectionPlay';

export const BOARD_SIZE = 5;
export const PIECE_KINDS = ['mirror', 'splitter', 'single', 'checkpoint'] as const;
export const NAME_LIMIT = 32;

export interface Preset {
  kind: PieceKind;
  at: GridPoint;
  state: number;
  locked: boolean;
}

export interface Puzzle {
  name: string;
  city?: CityIndex;
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
  solution?: TrialSolution;
  puzzle: Puzzle;
}

export function newPuzzle(city: CityIndex = 0): Puzzle {
  return {
    name: '未命名关卡', city, district: 0, source: [0, 2], sourceDirection: 0, sourceRotatable: false,
    pieces: [], inventory: { mirror: 0, splitter: 0, single: 0, checkpoint: 0 }, lightTargets: 1,
  };
}

export function puzzleLevel(puzzle: Puzzle): LevelConfig {
  const city = puzzle.city ?? 0;
  return {
    id: -1, name: puzzle.name, chapter: '造光工坊', subtitle: CITIES[city].districts[puzzle.district], city: city || undefined,
    size: BOARD_SIZE, district: puzzle.district, districtCenter: city === 0 ? DISTRICT_CENTERS[puzzle.district] : [0, 0],
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
    if (raw === null) continue;
    const work = JSON.parse(raw) as Work;
    if (work.verified && !work.solution) {
      const level = puzzleLevel(work.puzzle);
      if (traceReflection(level, initialReflectionState(level)).won) work.verified = false;
    }
    works.push(work);
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
export const isBoardCell = (value: unknown): value is GridPoint =>
  Array.isArray(value) && value.length === 2 && value.every((axis) => integer(axis, 0, BOARD_SIZE - 1));

export function readSharedPuzzle(encoded: string): Puzzle | null {
  if (encoded.length > 8192 || !/^[\w-]+$/.test(encoded)) return null;
  try {
    const decoded = atob(encoded.replaceAll('-', '+').replaceAll('_', '/'));
    const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(decoded, (c) => c.charCodeAt(0))));
    return parsePuzzle(value);
  } catch {
    return null;
  }
}

export function parsePuzzle(value: unknown): Puzzle | null {
  const capacity = BOARD_SIZE ** 2 - 1;
  if (!object(value)) return null;
  const { name, city, district, source, sourceDirection, sourceRotatable, pieces, inventory, lightTargets } = value;
  if (typeof name !== 'string' || !name.trim() || name.length > NAME_LIMIT
    || (city !== undefined && city !== 0 && city !== 1 && city !== 2)
    || !integer(district, 0, CITIES[0].districts.length - 1) || !isBoardCell(source)
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
    if (!kind || !isBoardCell(piece.at) || !integer(piece.state, 0, kind === 'single' ? 3 : 1)
      || typeof piece.locked !== 'boolean' || occupied.has(piece.at.join(','))) return null;
    occupied.add(piece.at.join(','));
    presets.push({ kind, at: piece.at, state: piece.state, locked: piece.locked });
  }
  return { name, city, district, source, sourceDirection: sourceDirection as Direction, sourceRotatable, pieces: presets, inventory: counts, lightTargets };
}
