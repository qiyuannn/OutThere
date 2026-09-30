import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  type SwipeAllowance,
  type SwipeChoice,
  type SwipeMode,
} from '../../../supabase/functions/_shared/discovery-contract.ts';
import {
  fetchRemoteSwipeStatus,
  isDiscoveryBackendAvailable,
  passPlace,
  recordSwipeAction,
  savePlace,
} from './service';
import {
  DAILY_SWIPE_LIMIT,
  SWIPE_WINDOW_DURATION_MS,
  computeAllowanceState,
  formatResetTime,
  formatTimeRemaining,
  type StoredAllowance,
  type SwipeAllowanceState,
} from './allowance-model';

export {
  DAILY_SWIPE_LIMIT,
  SWIPE_WINDOW_DURATION_MS,
  computeAllowanceState,
  formatResetTime,
  formatTimeRemaining,
  type StoredAllowance,
  type SwipeAllowanceState,
};

function storageKey(userId: string) {
  return `outthere:discovery-allowance:${userId}`;
}

export async function loadCachedAllowance(userId: string, isPro = false): Promise<SwipeAllowanceState | null> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(userId));
    if (!raw) return null;
    const parsed: StoredAllowance = JSON.parse(raw);
    return computeAllowanceState({
      unlimited: parsed.unlimited,
      isPro,
      windowStartedAt: parsed.windowStartedAt,
      used: parsed.used,
    });
  } catch {
    return null;
  }
}

export async function saveCachedAllowance(
  userId: string,
  allowance: SwipeAllowance | SwipeAllowanceState,
  usedCount?: number
): Promise<void> {
  try {
    let windowStartedAt: string | null = null;
    let used = 0;

    if ('resetsAt' in allowance && allowance.resetsAt) {
      const resetTime = typeof allowance.resetsAt === 'string'
        ? new Date(allowance.resetsAt).getTime()
        : allowance.resetsAt.getTime();
      windowStartedAt = new Date(resetTime - SWIPE_WINDOW_DURATION_MS).toISOString();
    }

    if (usedCount !== undefined) {
      used = usedCount;
    } else if (allowance.remaining !== null && allowance.remaining !== undefined) {
      used = Math.max(0, DAILY_SWIPE_LIMIT - allowance.remaining);
    }

    const payload: StoredAllowance = {
      windowStartedAt,
      used,
      unlimited: allowance.unlimited,
      cachedAt: Date.now(),
    };
    await AsyncStorage.setItem(storageKey(userId), JSON.stringify(payload));
  } catch {
    // Ignore storage failure
  }
}

export async function fetchSwipeAllowance(userId: string, isPro = false): Promise<SwipeAllowanceState> {
  if (isPro) {
    return {
      unlimited: true,
      limit: DAILY_SWIPE_LIMIT,
      remaining: null,
      resetsAt: null,
      isLimitReached: false,
    };
  }

  if (!isDiscoveryBackendAvailable()) {
    const cached = await loadCachedAllowance(userId, isPro);
    return cached ?? computeAllowanceState({ isPro: false });
  }

  try {
    const response = await fetchRemoteSwipeStatus();
    const state: SwipeAllowanceState = {
      unlimited: response.unlimited || isPro,
      limit: response.limit,
      remaining: isPro ? null : response.remaining,
      resetsAt: response.resetsAt ? new Date(response.resetsAt) : null,
      isLimitReached: !isPro && response.remaining !== null && response.remaining <= 0,
      serverTime: new Date(response.serverTime),
    };

    await saveCachedAllowance(userId, response);
    return state;
  } catch (err) {
    console.warn('[Discovery:Allowance] Remote check failed, using cached allowance', err);
    const cached = await loadCachedAllowance(userId, isPro);
    return cached ?? computeAllowanceState({ isPro });
  }
}

export async function executeSwipe(
  userId: string,
  placeId: string,
  mode: SwipeMode,
  choice: SwipeChoice,
  isPro = false
): Promise<{ accepted: boolean; allowance: SwipeAllowanceState }> {
  // If already known to be limited on client and not Pro
  if (!isPro) {
    const cached = await loadCachedAllowance(userId, false);
    if (cached?.isLimitReached) {
      return { accepted: false, allowance: cached };
    }
  }

  const requestId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });

  if (isDiscoveryBackendAvailable()) {
    try {
      const response = await recordSwipeAction(requestId, placeId, mode, choice);
      const allowance: SwipeAllowanceState = {
        unlimited: response.unlimited || isPro,
        limit: response.limit,
        remaining: isPro ? null : response.remaining,
        resetsAt: response.resetsAt ? new Date(response.resetsAt) : null,
        isLimitReached: !isPro && response.remaining !== null && response.remaining <= 0,
        serverTime: new Date(response.serverTime),
      };

      await saveCachedAllowance(userId, response);
      return { accepted: response.accepted, allowance };
    } catch (err) {
      console.warn('[Discovery:Allowance] Remote swipe failed, falling back to local tracking', err);
    }
  }

  // Fallback for offline or local handling
  const cached = await loadCachedAllowance(userId, isPro) ?? computeAllowanceState({ isPro });
  if (!isPro && cached.remaining !== null && cached.remaining <= 0) {
    return { accepted: false, allowance: cached };
  }

  const now = Date.now();
  const nextUsed = cached.remaining !== null ? DAILY_SWIPE_LIMIT - cached.remaining + 1 : 1;
  const windowStartedAt = cached.resetsAt
    ? new Date(cached.resetsAt.getTime() - SWIPE_WINDOW_DURATION_MS).toISOString()
    : new Date(now).toISOString();

  const nextState = computeAllowanceState({
    unlimited: isPro,
    isPro,
    windowStartedAt,
    used: nextUsed,
    now,
  });

  await saveCachedAllowance(userId, nextState, nextUsed);

  // Still execute direct save/pass if backend is connected
  try {
    if (choice === 'pass') {
      await passPlace(userId, placeId, mode);
    } else {
      await savePlace(userId, placeId, mode);
    }
  } catch {
    // Ignore background upsert error on offline
  }

  return { accepted: true, allowance: nextState };
}
