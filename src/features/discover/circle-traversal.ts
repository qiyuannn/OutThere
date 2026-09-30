import { TOTAL_SEARCH_CIRCLES, type QueueInput } from './queue-types.ts';
import { toQueueCounts } from './queue-operations.ts';

/**
 * Returns true if queues require replenishment from the next outer circle.
 * Triggers when:
 * - highQueue.length === 0 (top preference starvation prevention) OR
 * - total items across queues <= 2 (straggler swipe stall prevention)
 */
export function shouldReplenish<T = unknown>(
  queues: QueueInput<T> | null | undefined
): boolean {
  const counts = toQueueCounts(queues);
  const total = counts.high + counts.med + counts.low;
  return counts.high === 0 || total <= 2;
}

/**
 * Picks the next outer circle randomly without replacement from unvisited circles.
 * Always prioritizes Circle 0 if it has not yet been searched.
 *
 * @param unvisitedCircles Array of unvisited circle indices (e.g. [0, 1, 2, 3, 4, 5, 6] or [1, 2, 3, 4, 5, 6])
 * @param randomizer Optional random generator returning [0, 1)
 * @returns { nextCircle, remaining } or null if no unvisited circles remain
 */
export function pickNextCircle(
  unvisitedCircles: readonly number[] | number[],
  randomizer: () => number = Math.random
): { nextCircle: number; remaining: number[] } | null {
  if (!unvisitedCircles || unvisitedCircles.length === 0) {
    return null;
  }

  // Circle 0 always visited first if present
  if (unvisitedCircles.includes(0)) {
    return {
      nextCircle: 0,
      remaining: unvisitedCircles.filter((c) => c !== 0),
    };
  }

  const rand = randomizer();
  const clamped = Math.max(0, Math.min(1 - Number.EPSILON, rand));
  const selectedIndex = Math.floor(clamped * unvisitedCircles.length);
  const nextCircle = unvisitedCircles[selectedIndex];
  const remaining = unvisitedCircles.filter((_, idx) => idx !== selectedIndex);

  return { nextCircle, remaining };
}

/**
 * Determines whether the discovery feed is completely exhausted.
 * True iff:
 * 1. All 7 circles have been searched (visitedCirclesCount >= 7) AND
 * 2. All queues are completely empty (high === 0 && med === 0 && low === 0) AND
 * 3. The user is not currently viewing an active card (activeCard == null)
 */
export function isFeedExhausted<T = unknown>(
  visitedCirclesCount: number,
  queues: QueueInput<T> | null | undefined,
  activeCard?: unknown | null
): boolean {
  if (visitedCirclesCount < TOTAL_SEARCH_CIRCLES) {
    return false;
  }
  if (activeCard != null) {
    return false;
  }
  const counts = toQueueCounts(queues);
  return counts.high === 0 && counts.med === 0 && counts.low === 0;
}
