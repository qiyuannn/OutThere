import {
  ACTIVITIES_TIER_COUNTS,
  FOOD_TIER_COUNTS,
  type QueueCounts,
  type QueueInput,
  type QueueSet,
} from './queue-types.ts';

/**
 * Normalizes any queue input (counts, array sets, or partial objects) into a QueueCounts tuple.
 */
export function toQueueCounts<T = unknown>(queues: QueueInput<T> | null | undefined): QueueCounts {
  const parseCount = (val: number | readonly T[] | undefined): number => {
    if (typeof val === 'number') {
      return Number.isFinite(val) ? Math.max(0, Math.floor(val)) : 0;
    }
    if (Array.isArray(val)) {
      return val.length;
    }
    return 0;
  };

  return {
    high: parseCount(queues?.high),
    med: parseCount(queues?.med),
    low: parseCount(queues?.low),
  };
}

/**
 * Creates an empty QueueSet with empty arrays for all 3 tiers.
 */
export function createEmptyQueueSet<T = unknown>(): QueueSet<T> {
  return {
    high: [],
    med: [],
    low: [],
  };
}

/**
 * Computes total item count across all three tiers.
 */
export function getQueueTotal<T = unknown>(queues: QueueInput<T> | null | undefined): number {
  const counts = toQueueCounts(queues);
  return counts.high + counts.med + counts.low;
}

/**
 * Appends incoming items to existing queues without dropping unswiped items.
 */
export function enqueueItems<T>(
  existing: QueueSet<T>,
  incoming?: Partial<QueueSet<T>> | null
): QueueSet<T> {
  return {
    high: [...existing.high, ...(incoming?.high ?? [])],
    med: [...existing.med, ...(incoming?.med ?? [])],
    low: [...existing.low, ...(incoming?.low ?? [])],
  };
}

/**
 * Partitions category groups into High, Med, and Low tiers based on user weights.
 */
export function allocateTierGroups<T extends { key: string }>(
  mode: 'activities' | 'food',
  groups: readonly T[] | T[],
  weights: Record<string, number | undefined | null> = {},
  randomizer: () => number = Math.random
): QueueSet<T> {
  const items = [...groups];

  for (let i = items.length - 1; i > 0; i--) {
    const rand = randomizer();
    const clamped = Math.max(0, Math.min(1 - Number.EPSILON, rand));
    const j = Math.floor(clamped * (i + 1));
    const temp = items[i];
    items[i] = items[j];
    items[j] = temp;
  }

  items.sort((a, b) => {
    const rawA = weights[a.key];
    const rawB = weights[b.key];
    const weightA = typeof rawA === 'number' && Number.isFinite(rawA) ? rawA : 0.00;
    const weightB = typeof rawB === 'number' && Number.isFinite(rawB) ? rawB : 0.00;
    return weightB - weightA;
  });

  const config = mode === 'food' ? FOOD_TIER_COUNTS : ACTIVITIES_TIER_COUNTS;
  const high = items.slice(0, config.high);
  const med = items.slice(config.high, config.high + config.med);
  const low = items.slice(config.high + config.med);

  return { high, med, low };
}
