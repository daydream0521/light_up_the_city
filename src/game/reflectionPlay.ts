import type { Direction, GridPoint, LevelConfig, PieceKind } from './levels';
import { canPlaceAt, inventoryLeft, type ReflectionGameState } from './reflection';

export type ToolSelection = PieceKind | 'erase' | null;
export interface CellMove { at: GridPoint; tool: ToolSelection }
export interface TrialSolution {
  final: ReflectionGameState;
  moves: CellMove[];
}

export function playCell(level: LevelConfig, state: ReflectionGameState, { at, tool }: CellMove):
  'erase' | 'place' | 'piece' | 'source' | 'noPlacement' | 'noStock' | 'occupied' | 'locked' | 'fixed' | null {
  const sameCell = (point: GridPoint) => point[0] === at[0] && point[1] === at[1];
  const placementIndex = state.placements.findIndex((placement) => sameCell(placement.at));
  if (tool === 'erase') {
    if (placementIndex < 0) return 'noPlacement';
    state.placements.splice(placementIndex, 1);
    return 'erase';
  }
  if (tool) {
    if (inventoryLeft(level, state)[tool] <= 0) return 'noStock';
    if (!canPlaceAt(level, state, at)) return 'occupied';
    state.placements.push({ at, kind: tool, state: 0 });
    return 'place';
  }
  if (placementIndex >= 0) {
    const piece = state.placements[placementIndex];
    piece.state = (piece.state + 1) % (piece.kind === 'single' ? 4 : 2);
    return 'piece';
  }
  const index = level.reflection.pieces.findIndex((piece) => sameCell(piece.at));
  if (index >= 0) {
    const piece = level.reflection.pieces[index];
    if (piece.locked) return 'locked';
    state.pieceStates[index] = (state.pieceStates[index] + 1) % (piece.kind === 'single' ? 4 : 2);
    return 'piece';
  }
  if (!sameCell(level.source)) return null;
  if (!level.reflection.sourceRotatable) return 'fixed';
  state.sourceDirection = ((state.sourceDirection + 1) % 4) as Direction;
  return 'source';
}
