import { useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/providers/auth-provider';
import { useSubscription } from '@/providers/subscription-provider';
import { formatResetTime, formatTimeRemaining } from './allowance';
import { DEFAULT_RADIUS_METERS } from './constants';
import { getQueueTotal } from './queues';
import type { DiscoverMode } from './types';
import { useCircleFeed } from './hooks/use-circle-feed';
import { useDiscoverAllowance } from './hooks/use-discover-allowance';
import { useSwipeAction } from './hooks/use-swipe-action';

export function useDiscover() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const { isPro } = useSubscription();

  const [mode, setMode] = useState<DiscoverMode>('activities');
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { allowance, setAllowance, refreshAllowance } = useDiscoverAllowance({ userId, isPro });

  const {
    modesState,
    modesStateRef,
    setModesState,
    location,
    radiusMeters,
    loading,
    isFetchingRef,
    fetchNextCircle,
    reviewPassed,
    searchAgain,
    updateRadius,
  } = useCircleFeed({ userId, mode, acting, setActing, setError });

  const activeModeState = modesState[mode];
  const current = activeModeState.current;

  const { choose } = useSwipeAction({
    userId,
    isPro,
    allowance,
    setAllowance,
    current,
    mode,
    modesStateRef,
    setModesState,
    fetchNextCircle,
    radiusMeters,
    location,
    acting,
    setActing,
    setError,
  });

  useEffect(() => {
    if (!userId) return;
    void fetchNextCircle('activities', DEFAULT_RADIUS_METERS, null, true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    if (userId && !activeModeState.loaded && !loading && !isFetchingRef.current[mode]) {
      void fetchNextCircle(mode, radiusMeters, location);
    }
  }, [activeModeState.loaded, fetchNextCircle, isFetchingRef, loading, location, mode, radiusMeters, userId]);

  return useMemo(() => ({
    mode,
    setMode,
    radiusMeters,
    current,
    queueCounts: {
      high: activeModeState.queues.high.length,
      med: activeModeState.queues.med.length,
      low: activeModeState.queues.low.length,
      total: getQueueTotal(activeModeState.queues),
    },
    circleIndex: activeModeState.visitedCirclesCount,
    loading,
    acting,
    error,
    exhausted: activeModeState.exhausted,
    passedCount: activeModeState.passedCount,
    choose,
    reviewPassed,
    searchAgain,
    updateRadius,
    retry: () => fetchNextCircle(mode, radiusMeters, location),
    isPro,
    swipesRemaining: isPro ? null : allowance.remaining,
    swipesLimit: allowance.limit,
    swipesResetsAt: allowance.resetsAt,
    isSwipeLimitReached: !isPro && allowance.isLimitReached,
    isUnlimitedSwipes: isPro || allowance.unlimited,
    formattedTimeRemaining: formatTimeRemaining(allowance.resetsAt),
    formattedResetTime: formatResetTime(allowance.resetsAt),
    refreshAllowance,
  }), [
    acting,
    activeModeState.exhausted,
    activeModeState.passedCount,
    activeModeState.queues,
    activeModeState.visitedCirclesCount,
    allowance.isLimitReached,
    allowance.limit,
    allowance.remaining,
    allowance.resetsAt,
    allowance.unlimited,
    choose,
    current,
    error,
    fetchNextCircle,
    isPro,
    loading,
    location,
    mode,
    radiusMeters,
    refreshAllowance,
    reviewPassed,
    searchAgain,
    updateRadius,
  ]);
}
