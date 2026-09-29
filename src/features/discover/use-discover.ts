import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { router } from 'expo-router';

import { useAuth } from '@/providers/auth-provider';
import { useSubscription } from '@/providers/subscription-provider';
import { DEFAULT_RADIUS_METERS } from './constants';
import {
  computeAllowanceState,
  executeSwipe,
  fetchSwipeAllowance,
  formatResetTime,
  formatTimeRemaining,
  loadCachedAllowance,
  type SwipeAllowanceState,
} from './allowance';
import {
  clearPassedPlaces,
  getRoundedDeviceLocation,
  loadUserSavedAndPassedPlaceIds,
  requestRecommendations,
} from './service';
import {
  createEmptyQueueSet,
  drawNextRecommendation,
  enqueueItems,
  getQueueTotal,
  isFeedExhausted,
  pickNextCircle,
  shouldReplenish,
  type QueueSet,
} from './queues';
import type { DiscoverChoice, DiscoverLocation, DiscoverMode, Recommendation } from './types';

interface ModeState {
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

function createInitialModeState(): ModeState {
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

const initialModesState = (): Record<DiscoverMode, ModeState> => ({
  activities: createInitialModeState(),
  food: createInitialModeState(),
});

export function useDiscover() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const { isPro } = useSubscription();
  const preferredRadius = DEFAULT_RADIUS_METERS;

  const [allowance, setAllowance] = useState<SwipeAllowanceState>(() =>
    computeAllowanceState({ isPro })
  );

  // Sync allowance when user or Pro status changes
  useEffect(() => {
    if (!userId) return;
    let mounted = true;

    // Immediately load cached allowance to prevent UI flicker
    void loadCachedAllowance(userId, isPro).then((cached) => {
      if (mounted && cached) setAllowance(cached);
    });

    // Check remote allowance
    void fetchSwipeAllowance(userId, isPro).then((fresh) => {
      if (mounted) setAllowance(fresh);
    });

    return () => {
      mounted = false;
    };
  }, [userId, isPro]);

  // Automatically reset allowance when 24h reset period arrives
  useEffect(() => {
    if (isPro || !allowance.resetsAt) return;
    const diffMs = allowance.resetsAt.getTime() - Date.now();
    if (diffMs <= 0) {
      setAllowance(computeAllowanceState({ isPro: false }));
      return;
    }
    const timer = setTimeout(() => {
      setAllowance(computeAllowanceState({ isPro: false }));
    }, diffMs);
    return () => clearTimeout(timer);
  }, [allowance.resetsAt, isPro]);

  const [mode, setMode] = useState<DiscoverMode>('activities');
  const [location, setLocation] = useState<DiscoverLocation | null>(null);
  const [radiusMeters, setRadiusMeters] = useState(preferredRadius);
  const [modesState, setModesState] = useState<Record<DiscoverMode, ModeState>>(initialModesState);
  const modesStateRef = useRef<Record<DiscoverMode, ModeState>>(modesState);
  modesStateRef.current = modesState;

  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestNumber = useRef(0);
  const isFetchingRef = useRef<Record<DiscoverMode, boolean>>({ activities: false, food: false });

  const activeModeState = modesState[mode];
  const current = activeModeState.current;

  // Fetch logic for a specific mode and circle
  const fetchNextCircle = useCallback(async (
    targetMode: DiscoverMode,
    targetRadius: number = radiusMeters,
    knownLocation: DiscoverLocation | null = location,
    forceReset: boolean = false
  ) => {
    if (!userId || isFetchingRef.current[targetMode]) return;
    const requestId = ++requestNumber.current;
    isFetchingRef.current[targetMode] = true;
    setLoading(true);
    setError(null);

    try {
      const nextLocation = knownLocation ?? await getRoundedDeviceLocation();
      if (requestId !== requestNumber.current) return;
      setLocation(nextLocation);

      let isFirstIteration = true;
      let hasFoundCard = false;

      while (!hasFoundCard) {
        if (requestId !== requestNumber.current) return;

        const isReset = forceReset && isFirstIteration;
        const currentMode = isReset ? createInitialModeState() : modesStateRef.current[targetMode];
        const currentUnvisited = isReset ? [0, 1, 2, 3, 4, 5, 6] : currentMode.unvisitedCircles;

        if (currentUnvisited.length === 0) {
          const exhausted = isFeedExhausted(currentMode.visitedCirclesCount, currentMode.queues, currentMode.current);
          const nextState = { ...currentMode, exhausted, loaded: true };
          modesStateRef.current[targetMode] = nextState;
          setModesState((prev) => ({ ...prev, [targetMode]: nextState }));
          break;
        }

        const circleChoice = pickNextCircle(currentUnvisited);
        if (!circleChoice) break;

        const circleToFetch = circleChoice.nextCircle;
        const remainingCircles = circleChoice.remaining;

        let currentSavedIds = isReset ? new Set<string>() : currentMode.savedPlaceIds;
        let currentPassedIds = isReset ? new Set<string>() : currentMode.passedPlaceIds;
        if (isReset || (currentSavedIds.size === 0 && currentPassedIds.size === 0)) {
          const { savedIds, passedIds } = await loadUserSavedAndPassedPlaceIds(userId, targetMode);
          currentSavedIds = savedIds;
          currentPassedIds = passedIds;
        }

        const seenIds = isReset ? [] : Array.from(currentMode.seenPlaceIds);
        const result = await requestRecommendations(
          targetMode,
          nextLocation,
          targetRadius,
          circleToFetch,
          seenIds
        );

        if (requestId !== requestNumber.current) return;

        const newSeen = new Set(isReset ? [] : currentMode.seenPlaceIds);
        const incomingQueues = result.queues ?? {
          high: result.recommendations.filter((r) => r.queueTier === 'high'),
          med: result.recommendations.filter((r) => r.queueTier === 'med'),
          low: result.recommendations.filter((r) => r.queueTier === 'low' || !r.queueTier),
        };

        for (const item of [...incomingQueues.high, ...incomingQueues.med, ...incomingQueues.low]) {
          newSeen.add(item.id);
        }

        const latestMode = isReset ? createInitialModeState() : modesStateRef.current[targetMode];
        const combinedQueues = enqueueItems(latestMode.queues, incomingQueues);
        let nextCurrent = latestMode.current;

        // If no active card, draw one
        if (!nextCurrent) {
          const draw = drawNextRecommendation(
            combinedQueues,
            (item) => currentSavedIds.has(item.id) || currentPassedIds.has(item.id)
          );
          nextCurrent = draw.item;
        }

        const visitedCount = isReset ? 1 : latestMode.visitedCirclesCount + 1;
        const exhausted = isFeedExhausted(visitedCount, combinedQueues, nextCurrent);

        const nextModeState: ModeState = {
          ...latestMode,
          queues: combinedQueues,
          unvisitedCircles: remainingCircles,
          visitedCirclesCount: visitedCount,
          current: nextCurrent,
          loaded: true,
          exhausted,
          passedCount: result.passedCount ?? latestMode.passedCount,
          savedPlaceIds: currentSavedIds,
          passedPlaceIds: currentPassedIds,
          seenPlaceIds: newSeen,
        };

        console.log(`[Discover:${targetMode}] Circle ${circleToFetch} loaded:`, {
          googleApiRaw: result.debug?.rawCounts ?? 'N/A',
          afterDedupAndBounds: result.debug?.dedupedCounts ?? 'N/A',
          incoming: {
            high: incomingQueues.high.length,
            med: incomingQueues.med.length,
            low: incomingQueues.low.length,
            total: incomingQueues.high.length + incomingQueues.med.length + incomingQueues.low.length,
          },
          queues: {
            high: combinedQueues.high.length,
            med: combinedQueues.med.length,
            low: combinedQueues.low.length,
            total: getQueueTotal(combinedQueues),
          },
          currentCard: nextCurrent ? `${nextCurrent.name} [${nextCurrent.queueTier ?? 'tier'}]` : null,
          unvisitedCircles: remainingCircles,
          visitedCirclesCount: visitedCount,
          exhausted,
        });

        modesStateRef.current[targetMode] = nextModeState;
        setModesState((prev) => ({
          ...prev,
          [targetMode]: nextModeState,
        }));

        isFirstIteration = false;

        // Stop if a card is active, or queues contain places, or all circles are visited
        if (nextCurrent || getQueueTotal(combinedQueues) > 0 || remainingCircles.length === 0) {
          hasFoundCard = true;
        }
      }
    } catch (reason) {
      if (requestId === requestNumber.current) {
        setError(reason instanceof Error ? reason.message : 'Could not load nearby places.');
        setModesState((prev) => ({
          ...prev,
          [targetMode]: { ...prev[targetMode], loaded: true },
        }));
      }
    } finally {
      isFetchingRef.current[targetMode] = false;
      if (requestId === requestNumber.current) {
        setLoading(false);
      }
    }
  }, [location, radiusMeters, userId]);

  // Initial load
  useEffect(() => {
    if (!userId) return;
    setRadiusMeters(preferredRadius);
    const freshModes = initialModesState();
    modesStateRef.current = freshModes;
    setModesState(freshModes);
    void fetchNextCircle('activities', preferredRadius, null, true);
    return () => {
      requestNumber.current += 1;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, preferredRadius]);

  // Fetch target mode on toggle if not yet loaded
  useEffect(() => {
    if (userId && !activeModeState.loaded && !loading && !isFetchingRef.current[mode]) {
      void fetchNextCircle(mode, radiusMeters, location);
    }
  }, [activeModeState.loaded, fetchNextCircle, loading, location, mode, radiusMeters, userId]);

  // User swiping choice handler
  const choose = useCallback(async (choice: DiscoverChoice) => {
    if (!userId || !current || acting) return;
    if (!isPro && allowance.isLimitReached) return;
    setActing(true);
    setError(null);

    const placeToResolve = current;

    try {
      const result = await executeSwipe(userId, placeToResolve.id, mode, choice, isPro);
      setAllowance(result.allowance);

      if (!result.accepted) {
        setError(`You have reached your ${result.allowance.limit} daily swipes. Upgrade to Pro for unlimited discovery.`);
        return;
      }

      if (choice === 'details') {
        router.push({
          pathname: '/(tabs)/bucket-list/[id]',
          params: { id: placeToResolve.id, mode },
        });
      }

      // Synchronously draw next card and compute replenishment condition
      const prevMode = modesStateRef.current[mode];
      const newPassed = new Set(prevMode.passedPlaceIds);
      const newSaved = new Set(prevMode.savedPlaceIds);
      let newPassedCount = prevMode.passedCount;

      if (choice === 'pass') {
        newPassed.add(placeToResolve.id);
        newPassedCount += 1;
      } else if (choice === 'save' || choice === 'details') {
        newSaved.add(placeToResolve.id);
      }

      const queuesCopy = {
        high: [...prevMode.queues.high],
        med: [...prevMode.queues.med],
        low: [...prevMode.queues.low],
      };

      const draw = drawNextRecommendation(
        queuesCopy,
        (item) => newSaved.has(item.id) || newPassed.has(item.id)
      );

      const drawnCard = draw.item;
      const shouldFetch = (shouldReplenish(queuesCopy) || !drawnCard) && prevMode.unvisitedCircles.length > 0;
      const exhausted = isFeedExhausted(prevMode.visitedCirclesCount, queuesCopy, drawnCard);

      const nextModeState: ModeState = {
        ...prevMode,
        queues: queuesCopy,
        current: drawnCard,
        passedPlaceIds: newPassed,
        savedPlaceIds: newSaved,
        passedCount: newPassedCount,
        exhausted,
      };

      modesStateRef.current[mode] = nextModeState;
      setModesState((prev) => ({
        ...prev,
        [mode]: nextModeState,
      }));

      console.log(`[Discover:${mode}] Action "${choice}" on "${placeToResolve.name}" -> next draw:`, {
        drawnCard: drawnCard ? `${drawnCard.name} [${drawnCard.queueTier ?? 'tier'}]` : 'NONE',
        queuesRemaining: {
          high: queuesCopy.high.length,
          med: queuesCopy.med.length,
          low: queuesCopy.low.length,
          total: getQueueTotal(queuesCopy),
        },
        shouldReplenish: shouldFetch,
        unvisitedCirclesRemaining: prevMode.unvisitedCircles.length,
      });

      // Proactively replenish from next circle if queues low or empty
      if (shouldFetch) {
        console.log(`[Discover:${mode}] Replenishing! Remaining unvisited circles:`, prevMode.unvisitedCircles);
        void fetchNextCircle(mode, radiusMeters, location);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save that choice.');
    } finally {
      setActing(false);
    }
  }, [acting, allowance.isLimitReached, current, fetchNextCircle, isPro, location, mode, radiusMeters, userId]);

  // Review passed places: deletes from Supabase DB, clears local passed IDs, and restarts 7 circles
  const reviewPassed = useCallback(async () => {
    if (!userId || acting) return;
    setActing(true);
    setError(null);
    try {
      await clearPassedPlaces(userId, mode);
      const freshMode = createInitialModeState();
      modesStateRef.current[mode] = freshMode;
      setModesState((prev) => ({
        ...prev,
        [mode]: freshMode,
      }));
      await fetchNextCircle(mode, radiusMeters, location, true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not restore passed places.');
    } finally {
      setActing(false);
    }
  }, [acting, fetchNextCircle, location, mode, radiusMeters, userId]);

  // Search again: resets visited circles and restarts from Circle 0
  const searchAgain = useCallback(async () => {
    if (!userId || acting) return;
    const resetState = {
      ...modesStateRef.current[mode],
      queues: createEmptyQueueSet<Recommendation>(),
      unvisitedCircles: [0, 1, 2, 3, 4, 5, 6],
      visitedCirclesCount: 0,
      current: null,
      exhausted: false,
    };
    modesStateRef.current[mode] = resetState;
    setModesState((prev) => ({
      ...prev,
      [mode]: resetState,
    }));
    await fetchNextCircle(mode, radiusMeters, location, true);
  }, [acting, fetchNextCircle, location, mode, radiusMeters, userId]);

  // Updating search range: resets circle geometry for both modes and fetches Circle 0 with new radius
  const updateRadius = useCallback(async (nextRadius: number) => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      setRadiusMeters(nextRadius);
      const freshModes = initialModesState();
      modesStateRef.current = freshModes;
      setModesState(freshModes);
      await fetchNextCircle(mode, nextRadius, location, true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not update the search range.');
      setLoading(false);
      throw reason;
    }
  }, [fetchNextCircle, location, mode, userId]);

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
    refreshAllowance: () => userId ? fetchSwipeAllowance(userId, isPro).then(setAllowance) : Promise.resolve(),
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
    reviewPassed,
    searchAgain,
    updateRadius,
    userId,
  ]);
}
