import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { router } from 'expo-router';

import { useAuth } from '@/providers/auth-provider';
import { DEFAULT_RADIUS_METERS } from './constants';
import {
  clearPassedPlaces,
  getRoundedDeviceLocation,
  loadUserSavedAndPassedPlaceIds,
  passPlace,
  requestRecommendations,
  savePlace,
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
  const preferredRadius = DEFAULT_RADIUS_METERS;

  const [mode, setMode] = useState<DiscoverMode>('activities');
  const [location, setLocation] = useState<DiscoverLocation | null>(null);
  const [radiusMeters, setRadiusMeters] = useState(preferredRadius);
  const [modesState, setModesState] = useState<Record<DiscoverMode, ModeState>>(initialModesState);
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

      // Determine current unvisited circles and exclusions
      let currentUnvisited = forceReset ? [0, 1, 2, 3, 4, 5, 6] : modesState[targetMode].unvisitedCircles;
      if (currentUnvisited.length === 0) {
        // No circles remaining
        setModesState((prev) => {
          const m = prev[targetMode];
          const exhausted = isFeedExhausted(m.visitedCirclesCount, m.queues, m.current);
          return {
            ...prev,
            [targetMode]: { ...m, exhausted, loaded: true },
          };
        });
        return;
      }

      const circleChoice = pickNextCircle(currentUnvisited);
      if (!circleChoice) return;

      const circleToFetch = circleChoice.nextCircle;
      const remainingCircles = circleChoice.remaining;

      // Load saved and passed place IDs if not yet loaded or if force resetting
      let currentSavedIds = forceReset ? new Set<string>() : modesState[targetMode].savedPlaceIds;
      let currentPassedIds = forceReset ? new Set<string>() : modesState[targetMode].passedPlaceIds;
      if (forceReset || (currentSavedIds.size === 0 && currentPassedIds.size === 0)) {
        const { savedIds, passedIds } = await loadUserSavedAndPassedPlaceIds(userId, targetMode);
        currentSavedIds = savedIds;
        currentPassedIds = passedIds;
      }

      const seenIds = forceReset ? [] : Array.from(modesState[targetMode].seenPlaceIds);
      const result = await requestRecommendations(
        targetMode,
        nextLocation,
        targetRadius,
        circleToFetch,
        seenIds
      );

      if (requestId !== requestNumber.current) return;

      setModesState((prev) => {
        const prevMode = forceReset ? createInitialModeState() : prev[targetMode];
        const newSeen = new Set(prevMode.seenPlaceIds);
        const incomingQueues = result.queues ?? {
          high: result.recommendations.filter((r) => r.queueTier === 'high'),
          med: result.recommendations.filter((r) => r.queueTier === 'med'),
          low: result.recommendations.filter((r) => r.queueTier === 'low' || !r.queueTier),
        };

        // Add to seen set
        for (const item of [...incomingQueues.high, ...incomingQueues.med, ...incomingQueues.low]) {
          newSeen.add(item.id);
        }

        const combinedQueues = enqueueItems(prevMode.queues, incomingQueues);
        let nextCurrent = prevMode.current;

        // If no active card, draw one
        if (!nextCurrent) {
          const draw = drawNextRecommendation(
            combinedQueues,
            (item) => currentSavedIds.has(item.id) || currentPassedIds.has(item.id)
          );
          nextCurrent = draw.item;
        }

        const visitedCount = prevMode.visitedCirclesCount + 1;
        const exhausted = isFeedExhausted(visitedCount, combinedQueues, nextCurrent);

        return {
          ...prev,
          [targetMode]: {
            ...prevMode,
            queues: combinedQueues,
            unvisitedCircles: remainingCircles,
            visitedCirclesCount: visitedCount,
            current: nextCurrent,
            loaded: true,
            exhausted,
            passedCount: result.passedCount ?? prevMode.passedCount,
            savedPlaceIds: currentSavedIds,
            passedPlaceIds: currentPassedIds,
            seenPlaceIds: newSeen,
          },
        };
      });
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
  }, [location, modesState, radiusMeters, userId]);

  // Initial load
  useEffect(() => {
    if (!userId) return;
    setRadiusMeters(preferredRadius);
    setModesState(initialModesState());
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
    setActing(true);
    setError(null);

    const placeToResolve = current;

    try {
      if (choice === 'pass') {
        await passPlace(userId, placeToResolve.id, mode);
        setModesState((prev) => {
          const m = prev[mode];
          const newPassed = new Set(m.passedPlaceIds);
          newPassed.add(placeToResolve.id);
          return {
            ...prev,
            [mode]: { ...m, passedPlaceIds: newPassed, passedCount: m.passedCount + 1 },
          };
        });
      } else if (choice === 'save' || choice === 'details') {
        await savePlace(userId, placeToResolve.id, mode);
        setModesState((prev) => {
          const m = prev[mode];
          const newSaved = new Set(m.savedPlaceIds);
          newSaved.add(placeToResolve.id);
          return {
            ...prev,
            [mode]: { ...m, savedPlaceIds: newSaved },
          };
        });
      }

      if (choice === 'details') {
        router.push({
          pathname: '/(tabs)/bucket-list/[id]',
          params: { id: placeToResolve.id, mode },
        });
      }

      // Draw next card from current queues
      let drawnCard: Recommendation | null = null;
      let shouldFetch = false;

      setModesState((prev) => {
        const m = prev[mode];
        const queuesCopy = {
          high: [...m.queues.high],
          med: [...m.queues.med],
          low: [...m.queues.low],
        };

        const draw = drawNextRecommendation(
          queuesCopy,
          (item) => m.savedPlaceIds.has(item.id) || m.passedPlaceIds.has(item.id)
        );

        drawnCard = draw.item;
        shouldFetch = (shouldReplenish(queuesCopy) || !drawnCard) && m.unvisitedCircles.length > 0;
        const exhausted = isFeedExhausted(m.visitedCirclesCount, queuesCopy, drawnCard);

        return {
          ...prev,
          [mode]: {
            ...m,
            queues: queuesCopy,
            current: drawnCard,
            exhausted,
          },
        };
      });

      // Replenish from next circle if queues low or empty
      if (shouldFetch) {
        void fetchNextCircle(mode, radiusMeters, location);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save that choice.');
    } finally {
      setActing(false);
    }
  }, [acting, current, fetchNextCircle, location, mode, radiusMeters, userId]);

  // Review passed places: deletes from Supabase DB, clears local passed IDs, and restarts 7 circles
  const reviewPassed = useCallback(async () => {
    if (!userId || acting) return;
    setActing(true);
    setError(null);
    try {
      await clearPassedPlaces(userId, mode);
      setModesState((prev) => ({
        ...prev,
        [mode]: createInitialModeState(),
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
    setModesState((prev) => ({
      ...prev,
      [mode]: {
        ...prev[mode],
        queues: createEmptyQueueSet(),
        unvisitedCircles: [0, 1, 2, 3, 4, 5, 6],
        visitedCirclesCount: 0,
        current: null,
        exhausted: false,
      },
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
      setModesState(initialModesState());
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
  }), [
    acting,
    activeModeState.exhausted,
    activeModeState.passedCount,
    activeModeState.queues,
    activeModeState.visitedCirclesCount,
    choose,
    current,
    error,
    fetchNextCircle,
    loading,
    location,
    mode,
    radiusMeters,
    reviewPassed,
    searchAgain,
    updateRadius,
  ]);
}
