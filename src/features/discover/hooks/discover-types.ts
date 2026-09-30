import { createEmptyQueueSet, type QueueSet } from '../queues';
import type { DiscoverMode, Recommendation } from '../types';

export interface ModeState {
  queues: QueueSet<Recommendation>;
  unvisitedCircles: number[];
  visitedCirclesCount: number;
  current: Recommendation | null;
  loaded: boolean;
  exhausted: boolean;
  passedCount: number;
  savedPlaceIds: Set<string>;
  passedPlaceIds: Set<string>;
  seenPlaceIds: Set<string>;
}

export function createInitialModeState(): ModeState {
  return {
    queues: createEmptyQueueSet<Recommendation>(),
    unvisitedCircles: [0, 1, 2, 3, 4, 5, 6],
    visitedCirclesCount: 0,
    current: null,
    loaded: false,
    exhausted: false,
    passedCount: 0,
    savedPlaceIds: new Set<string>(),
    passedPlaceIds: new Set<string>(),
    seenPlaceIds: new Set<string>(),
  };
}

export const initialModesState = (): Record<DiscoverMode, ModeState> => ({
  activities: createInitialModeState(),
  food: createInitialModeState(),
});
