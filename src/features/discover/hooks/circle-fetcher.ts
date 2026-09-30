import {
  loadUserSavedAndPassedPlaceIds,
  requestRecommendations,
} from '../service';
import {
  drawNextRecommendation,
  enqueueItems,
  getQueueTotal,
  isFeedExhausted,
  pickNextCircle,
} from '../queues';
import type { DiscoverLocation, DiscoverMode } from '../types';
import { createInitialModeState, type ModeState } from './discover-types';

export interface CircleIterationResult {
  nextModeState: ModeState;
  hasFoundCard: boolean;
  isExhausted: boolean;
}

export async function fetchCircleIteration(
  targetMode: DiscoverMode,
  nextLocation: DiscoverLocation,
  targetRadius: number,
  userId: string,
  currentMode: ModeState,
  isReset: boolean
): Promise<CircleIterationResult> {
  const unvisited = isReset ? [0, 1, 2, 3, 4, 5, 6] : currentMode.unvisitedCircles;
  if (unvisited.length === 0) {
    const exhausted = isFeedExhausted(currentMode.visitedCirclesCount, currentMode.queues, currentMode.current);
    return {
      nextModeState: { ...currentMode, exhausted, loaded: true },
      hasFoundCard: true,
      isExhausted: true,
    };
  }

  const choice = pickNextCircle(unvisited);
  if (!choice) {
    return { nextModeState: currentMode, hasFoundCard: true, isExhausted: true };
  }

  let curSaved = isReset ? new Set<string>() : currentMode.savedPlaceIds;
  let curPassed = isReset ? new Set<string>() : currentMode.passedPlaceIds;
  if (isReset || (curSaved.size === 0 && curPassed.size === 0)) {
    const { savedIds, passedIds } = await loadUserSavedAndPassedPlaceIds(userId, targetMode);
    curSaved = savedIds;
    curPassed = passedIds;
  }

  const seenIds = isReset ? [] : Array.from(currentMode.seenPlaceIds);
  const result = await requestRecommendations(targetMode, nextLocation, targetRadius, choice.nextCircle, seenIds);

  const newSeen = new Set(isReset ? [] : currentMode.seenPlaceIds);
  const incoming = result.queues ?? {
    high: result.recommendations.filter((r) => r.queueTier === 'high'),
    med: result.recommendations.filter((r) => r.queueTier === 'med'),
    low: result.recommendations.filter((r) => r.queueTier === 'low' || !r.queueTier),
  };
  for (const item of [...incoming.high, ...incoming.med, ...incoming.low]) newSeen.add(item.id);

  const latest = isReset ? createInitialModeState() : currentMode;
  const combinedQueues = enqueueItems(latest.queues, incoming);
  let nextCurrent = latest.current;
  if (!nextCurrent) {
    const draw = drawNextRecommendation(combinedQueues, (item) => curSaved.has(item.id) || curPassed.has(item.id));
    nextCurrent = draw.item;
  }

  const visitedCount = isReset ? 1 : latest.visitedCirclesCount + 1;
  const exhausted = isFeedExhausted(visitedCount, combinedQueues, nextCurrent);
  const nextModeState: ModeState = {
    ...latest,
    queues: combinedQueues,
    unvisitedCircles: choice.remaining,
    visitedCirclesCount: visitedCount,
    current: nextCurrent,
    loaded: true,
    exhausted,
    passedCount: result.passedCount ?? latest.passedCount,
    savedPlaceIds: curSaved,
    passedPlaceIds: curPassed,
    seenPlaceIds: newSeen,
  };

  const hasFoundCard = Boolean(nextCurrent) || getQueueTotal(combinedQueues) > 0 || choice.remaining.length === 0;
  return { nextModeState, hasFoundCard, isExhausted: choice.remaining.length === 0 };
}
