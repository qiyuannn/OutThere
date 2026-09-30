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
