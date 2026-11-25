import type { LevelConfig } from './levels';

export interface LevelRating {
  stars: number;
  moves: number;
}

export function rateLevel(level: LevelConfig, moves: number): LevelRating {
  const stars = moves <= level.parMoves ? 3 : moves <= level.parMoves + 2 ? 2 : 1;
  return { stars, moves };
}
