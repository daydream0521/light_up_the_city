import type { GridPoint } from './levels';
import { initialReflectionState, traceReflection, type ReflectionGameState } from './reflection';
import { playCell } from './reflectionPlay';
import { isBoardCell, parsePuzzle, PIECE_KINDS, puzzleLevel, type Puzzle } from './workshop';

export interface Publication {
  puzzle: Puzzle;
  author: string;
  creatorMoves: number;
  parentId: string | null;
}

export interface PublishedPuzzle extends Publication {
  id: string;
  createdAt: string;
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function sameCell(a: GridPoint, b: GridPoint): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

function matchesFinal(actual: ReflectionGameState, raw: unknown): boolean {
  const final = record(raw);
  if (!final || final.sourceDirection !== actual.sourceDirection
    || !Array.isArray(final.pieceStates) || final.pieceStates.length !== actual.pieceStates.length
    || !Array.isArray(final.placements) || final.placements.length !== actual.placements.length) return false;
  return actual.pieceStates.every((state, index) => state === (final.pieceStates as unknown[])[index])
    && actual.placements.every((piece, index) => {
      const placed = record((final.placements as unknown[])[index]);
      return placed !== null && isBoardCell(placed.at) && sameCell(piece.at, placed.at)
        && piece.kind === placed.kind && piece.state === placed.state;
    });
}

export function validatePublication(input: unknown): Publication | null {
  const data = record(input);
  if (!data) return null;
  const puzzle = parsePuzzle(data.puzzle);
  const author = typeof data.author === 'string' ? data.author.trim() : '';
  const parentId = data.parentId ?? null;
  const solution = record(data.solution);
  if (!puzzle || !author || author.length > 32
    || (parentId !== null && (typeof parentId !== 'string' || !/^[\w-]{1,64}$/.test(parentId)))
    || !solution || !Array.isArray(solution.moves) || solution.moves.length < 1 || solution.moves.length > 2048) return null;

  const level = puzzleLevel(puzzle);
  const state = initialReflectionState(level);
  if (traceReflection(level, state).won) return null;
  for (const [index, move] of solution.moves.entries()) {
    const action = record(move);
    if (!action || !isBoardCell(action.at)) return null;
    const tool = action.tool === null || action.tool === 'erase'
      ? action.tool : PIECE_KINDS.find((kind) => kind === action.tool);
    if (tool === undefined) return null;
    const result = playCell(level, state, { at: action.at, tool });
    if (result !== 'place' && result !== 'erase' && result !== 'source' && result !== 'piece') return null;
    if (traceReflection(level, state).won !== (index === solution.moves.length - 1)) return null;
  }
  if (!matchesFinal(state, solution.final)) return null;
  return { puzzle, author, creatorMoves: solution.moves.length, parentId };
}
