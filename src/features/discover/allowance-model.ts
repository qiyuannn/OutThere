import { PaginationLimits } from '../../constants/limits.ts';
import { CacheTtl } from '../../constants/timing.ts';
import { formatResetTime, formatTimeRemaining } from '../../lib/format.ts';

export { formatResetTime, formatTimeRemaining };

export const DAILY_SWIPE_LIMIT = PaginationLimits.dailySwipeLimit;
export const SWIPE_WINDOW_DURATION_MS = CacheTtl.swipeWindowDurationMs;

export interface SwipeAllowanceState {
  unlimited: boolean;
  limit: number;
  remaining: number | null; // null if unlimited; 0..10 if limited
  resetsAt: Date | null;    // null if unlimited or no swipes yet
  isLimitReached: boolean;
  serverTime?: Date;
}

export interface StoredAllowance {
  windowStartedAt: string | null;
  used: number;
  unlimited: boolean;
  cachedAt: number;
}

export function computeAllowanceState(params: {
  unlimited?: boolean;
  isPro?: boolean;
  windowStartedAt?: string | null;
  used?: number;
  now?: number;
}): SwipeAllowanceState {
  const { unlimited = false, isPro = false, windowStartedAt = null, used = 0, now = Date.now() } = params;

  if (unlimited || isPro) {
    return {
      unlimited: true,
      limit: DAILY_SWIPE_LIMIT,
      remaining: null,
      resetsAt: null,
      isLimitReached: false,
    };
  }

  if (!windowStartedAt || used <= 0) {
    return {
      unlimited: false,
      limit: DAILY_SWIPE_LIMIT,
      remaining: DAILY_SWIPE_LIMIT,
      resetsAt: null,
      isLimitReached: false,
    };
  }

  const startTime = new Date(windowStartedAt).getTime();
  if (isNaN(startTime) || now - startTime >= SWIPE_WINDOW_DURATION_MS) {
    // 24 hours have elapsed since the first swipe -> window reset!
    return {
      unlimited: false,
      limit: DAILY_SWIPE_LIMIT,
      remaining: DAILY_SWIPE_LIMIT,
      resetsAt: null,
      isLimitReached: false,
    };
  }

  const resetsAt = new Date(startTime + SWIPE_WINDOW_DURATION_MS);
  const remaining = Math.max(0, DAILY_SWIPE_LIMIT - used);
  const isLimitReached = remaining <= 0;

  return {
    unlimited: false,
    limit: DAILY_SWIPE_LIMIT,
    remaining,
    resetsAt,
    isLimitReached,
  };
}

