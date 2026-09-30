import {
  QUEUE_WEIGHTS,
  type DrawResult,
  type QueueInput,
  type QueueSet,
  type TierQueueKey,
} from './queue-types.ts';
import { getQueueTotal, toQueueCounts } from './queue-operations.ts';

/**
 * Draws from available non-empty queues using a calibrated 3:2:1 ratio:
 * - High: ~50.0% (3/6)
 * - Med: ~33.3% (2/6)
 * - Low: ~16.7% (1/6)
 */
export function sampleCalibratedQueue<T = unknown>(
  queues: QueueInput<T> | null | undefined,
  randomValue?: number | (() => number)
): TierQueueKey | null {
  const counts = toQueueCounts(queues);
  const wHigh = counts.high > 0 ? QUEUE_WEIGHTS.high : 0;
  const wMed = counts.med > 0 ? QUEUE_WEIGHTS.med : 0;
  const wLow = counts.low > 0 ? QUEUE_WEIGHTS.low : 0;
  const totalWeight = wHigh + wMed + wLow;

  if (totalWeight === 0) {
    return null;
  }

  const rawRand =
    typeof randomValue === 'function'
      ? randomValue()
      : typeof randomValue === 'number'
        ? randomValue
        : Math.random();

  const normalized = Math.max(0, Math.min(1 - Number.EPSILON, rawRand));
  let point = normalized * totalWeight;

  if (wHigh > 0) {
    if (point < wHigh) return 'high';
    point -= wHigh;
  }

  if (wMed > 0) {
    if (point < wMed) return 'med';
    point -= wMed;
  }

  if (wLow > 0) {
    return 'low';
  }

  return null;
}

/**
 * Draws the next eligible recommendation from queues using calibrated 3:2:1 sampling.
 */
export function drawNextRecommendation<T>(
  queues: QueueSet<T>,
  isExcluded: (item: T) => boolean,
  randomizer: () => number = Math.random
): DrawResult<T> {
  let skippedCount = 0;

  while (getQueueTotal(queues) > 0) {
    const tier = sampleCalibratedQueue(queues, randomizer);
    if (!tier) break;

    const candidate = queues[tier].shift();
    if (candidate === undefined) continue;

    if (isExcluded(candidate)) {
      skippedCount++;
      continue;
    }

    return {
      item: candidate,
      sampledTier: tier,
      skippedCount,
    };
  }

  return {
    item: null,
    sampledTier: null,
    skippedCount,
  };
}
