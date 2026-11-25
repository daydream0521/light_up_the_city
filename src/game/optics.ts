import type { GridPoint } from './levels';

export type TraceEnd = 'obstacle' | 'boundary' | 'absorbed' | 'loop';

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
