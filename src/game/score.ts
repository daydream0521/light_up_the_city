import type { LevelConfig } from './levels';
import type { TraceResult } from './optics';

export interface LevelRating {
  stars: number;
  moves: number;
  efficiency: number;
  showEfficiency: boolean;
}

export function rateLevel(level: LevelConfig, moves: number, trace: TraceResult): LevelRating {
  const stars = moves <= level.parMoves ? 3 : moves <= level.parMoves + 2 ? 2 : 1;
  const delivered = trace.targets.reduce((sum, target) => sum + Math.min(target.received, target.required), 0);
  const efficiency = level.sourceEnergy > 0 ? delivered / level.sourceEnergy : 0;
  return { stars, moves, efficiency, showEfficiency: !level.reflection && level.chapter !== '基础反射' };
}