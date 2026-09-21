/**
 * src/features/discover/queues.ts
 *
 * Core Queue Engine for OutThere Discover Recommendation System Redesign.
 *
 * Implements:
 * - 3-tier dynamic priority queue allocation ('high', 'med', 'low')
 * - Randomized tie-breaking with uniform distribution for equal category weights
 * - Calibrated 3:2:1 sampling (50% High, 33.3% Med, 16.7% Low)
 * - Dynamic proportional fallback when tiers empty
 * - Straggler replenishment trigger (high === 0 || total <= 2)
 * - 7-circle outer progression without replacement
 * - 3-predicate feed exhaustion evaluation
 * - Client-side instant skip and resample loop
 *
 * Pure TypeScript module: Zero React Native / DOM / Node runtime dependencies.
 */

// ============================================================================
// Types & Constants
// ============================================================================

export type TierQueueKey = 'high' | 'med' | 'low';
export type QueueTier = TierQueueKey;

export interface QueueSet<T = unknown> {
  high: T[];
  med: T[];
  low: T[];
}

export interface QueueCounts {
  high: number;
  med: number;
  low: number;
}

export type QueueInput<T = unknown> =
  | QueueCounts
  | QueueSet<T>
  | {
      high?: number | readonly T[];
      med?: number | readonly T[];
      low?: number | readonly T[];
    };

export interface DrawResult<T> {
  item: T | null;
  sampledTier: TierQueueKey | null;
  skippedCount: number;
}

export interface TierAllocationConfig {
  high: number;
  med: number;
  low: number;
}

export const QUEUE_WEIGHTS: Record<TierQueueKey, number> = {
  high: 3,
  med: 2,
  low: 1,
} as const;

export const CALIBRATED_QUEUE_WEIGHTS = QUEUE_WEIGHTS;

export const TIER_KEYS: readonly TierQueueKey[] = ['high', 'med', 'low'] as const;
export const QUEUE_TIERS = TIER_KEYS;

export const ACTIVITIES_TIER_COUNTS: TierAllocationConfig = {
  high: 1,
  med: 2,
  low: 3,
} as const;

export const FOOD_TIER_COUNTS: TierAllocationConfig = {
  high: 2,
  med: 3,
  low: 5,
} as const;

export const TIER_ALLOCATION_CONFIGS: Record<'activities' | 'food', TierAllocationConfig> = {
  activities: ACTIVITIES_TIER_COUNTS,
  food: FOOD_TIER_COUNTS,
};

export const TOTAL_SEARCH_CIRCLES = 7;
export const TOTAL_CIRCLES_COUNT = 7;

// ============================================================================
// Normalization & Helpers
// ============================================================================

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

// ============================================================================
// R2: Dynamic 3-Tier Allocation & Randomized Tie-Breaking
// ============================================================================

/**
 * Partitions category groups into High, Med, and Low tiers based on user weights.
 *
 * - Activities (6 groups): 1 High, 2 Med, 3 Low
 * - Food (10 groups): 2 High, 3 Med, 5 Low
 * - Default weight for unset groups: 0.00
 * - Equal weights: Randomized tie-breaking guarantees uniform probability across tied groups.
 *
 * @param mode 'activities' | 'food'
 * @param groups Array of category groups (each having a `key: string`)
 * @param weights User weights map (category key -> number)
 * @param randomizer Optional random generator returning [0, 1), default Math.random
 */
export function allocateTierGroups<T extends { key: string }>(
  mode: 'activities' | 'food',
  groups: readonly T[] | T[],
  weights: Record<string, number | undefined | null> = {},
  randomizer: () => number = Math.random
): QueueSet<T> {
  // 1. Shallow copy groups
  const items = [...groups];

  // 2. Fisher-Yates shuffle with injected randomizer to break ties uniformly
  for (let i = items.length - 1; i > 0; i--) {
    const rand = randomizer();
    const clamped = Math.max(0, Math.min(1 - Number.EPSILON, rand));
    const j = Math.floor(clamped * (i + 1));
    const temp = items[i];
    items[i] = items[j];
    items[j] = temp;
  }

  // 3. Stable sort descending by weight (tied items preserve randomized relative order)
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

// ============================================================================
// R4: Calibrated 3:2:1 Sampling with Proportional Fallback
// ============================================================================

/**
 * Draws from available non-empty queues using a calibrated 3:2:1 ratio:
 * - High: ~50.0% (3/6)
 * - Med: ~33.3% (2/6)
 * - Low: ~16.7% (1/6)
 *
 * Dynamically redistributes probabilities proportionally when tiers empty:
 * - High + Med: 60% / 40%
 * - High + Low: 75% / 25%
 * - Med + Low: 66.7% / 33.3%
 * - Single tier: 100%
 * - All empty: null
 *
 * @param queues Queue counts or QueueSet
 * @param randomValue Optional value in [0, 1) or generator function (default: Math.random())
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

  // Clamp to [0, 1 - EPSILON] to avoid out-of-bounds boundary errors when randomValue = 1.0
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

// ============================================================================
// R4: Straggler Replenishment Trigger
// ============================================================================

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

// ============================================================================
// R5: Outer Circle Progression Without Replacement
// ============================================================================

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

// ============================================================================
// R5: Feed Exhaustion Evaluation
// ============================================================================

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

// ============================================================================
// R4: Client-Side Instant Skip & Resample
// ============================================================================

/**
 * Draws the next eligible recommendation from queues using calibrated 3:2:1 sampling.
 * If candidate is excluded (saved or passed), immediately discards it and redraws
 * without user intervention until an unseen place is found or all queues empty.
 *
 * Mutates queues by shifting drawn candidates in place.
 *
 * @param queues QueueSet containing candidate items
 * @param isExcluded Predicate returning true if venue is already saved or passed
 * @param randomizer Optional randomizer function for deterministic testing
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
