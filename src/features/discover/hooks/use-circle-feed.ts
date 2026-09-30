import { useCallback, useRef, useState } from 'react';

import { DEFAULT_RADIUS_METERS } from '../constants';
import { clearPassedPlaces, getRoundedDeviceLocation } from '../service';
import { createEmptyQueueSet } from '../queues';
import type { DiscoverLocation, DiscoverMode, Recommendation } from '../types';
import { fetchCircleIteration } from './circle-fetcher';
import { createInitialModeState, initialModesState, type ModeState } from './discover-types';

interface UseCircleFeedProps {
  userId?: string;
  mode: DiscoverMode;
  acting: boolean;
  setActing: (val: boolean) => void;
  setError: (val: string | null) => void;
}

export function useCircleFeed({
  userId,
  mode,
  acting,
  setActing,
  setError,
}: UseCircleFeedProps) {
  const [location, setLocation] = useState<DiscoverLocation | null>(null);
  const [radiusMeters, setRadiusMeters] = useState(DEFAULT_RADIUS_METERS);
  const [modesState, setModesState] = useState<Record<DiscoverMode, ModeState>>(initialModesState);
  const modesStateRef = useRef<Record<DiscoverMode, ModeState>>(modesState);
  modesStateRef.current = modesState;

  const [loading, setLoading] = useState(true);
  const requestNumber = useRef(0);
  const isFetchingRef = useRef<Record<DiscoverMode, boolean>>({ activities: false, food: false });

  const fetchNextCircle = useCallback(async (
    targetMode: DiscoverMode,
    targetRadius: number = radiusMeters,
    knownLocation: DiscoverLocation | null = location,
    forceReset: boolean = false
  ) => {
    if (!userId || isFetchingRef.current[targetMode]) return;
    const reqId = ++requestNumber.current;
    isFetchingRef.current[targetMode] = true;
    setLoading(true);
    setError(null);

    try {
      const nextLocation = knownLocation ?? await getRoundedDeviceLocation();
      if (reqId !== requestNumber.current) return;
      setLocation(nextLocation);

      let isFirst = true;
      let hasFoundCard = false;

      while (!hasFoundCard) {
        if (reqId !== requestNumber.current) return;
        const isReset = forceReset && isFirst;
        const curMode = isReset ? createInitialModeState() : modesStateRef.current[targetMode];

        const iteration = await fetchCircleIteration(
          targetMode,
          nextLocation,
          targetRadius,
          userId,
          curMode,
          isReset
        );
        if (reqId !== requestNumber.current) return;

        modesStateRef.current[targetMode] = iteration.nextModeState;
        setModesState((prev) => ({ ...prev, [targetMode]: iteration.nextModeState }));
        isFirst = false;
        hasFoundCard = iteration.hasFoundCard;
      }
    } catch (reason) {
      if (reqId === requestNumber.current) {
        setError(reason instanceof Error ? reason.message : 'Could not load nearby places.');
        setModesState((prev) => ({ ...prev, [targetMode]: { ...prev[targetMode], loaded: true } }));
      }
    } finally {
      isFetchingRef.current[targetMode] = false;
      if (reqId === requestNumber.current) setLoading(false);
    }
  }, [location, radiusMeters, setError, userId]);

  const reviewPassed = useCallback(async () => {
    if (!userId || acting) return;
    setActing(true);
    setError(null);
    try {
      await clearPassedPlaces(userId, mode);
      const fresh = createInitialModeState();
      modesStateRef.current[mode] = fresh;
      setModesState((prev) => ({ ...prev, [mode]: fresh }));
      await fetchNextCircle(mode, radiusMeters, location, true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not restore passed places.');
    } finally {
      setActing(false);
    }
  }, [acting, fetchNextCircle, location, mode, radiusMeters, setActing, setError, userId]);

  const searchAgain = useCallback(async () => {
    if (!userId || acting) return;
    const reset = {
      ...modesStateRef.current[mode],
      queues: createEmptyQueueSet<Recommendation>(),
      unvisitedCircles: [0, 1, 2, 3, 4, 5, 6],
      visitedCirclesCount: 0,
      current: null,
      exhausted: false,
    };
    modesStateRef.current[mode] = reset;
    setModesState((prev) => ({ ...prev, [mode]: reset }));
    await fetchNextCircle(mode, radiusMeters, location, true);
  }, [acting, fetchNextCircle, location, mode, radiusMeters, userId]);

  const updateRadius = useCallback(async (nextRadius: number) => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      setRadiusMeters(nextRadius);
      const fresh = initialModesState();
      modesStateRef.current = fresh;
      setModesState(fresh);
      await fetchNextCircle(mode, nextRadius, location, true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not update the search range.');
      setLoading(false);
      throw reason;
    }
  }, [fetchNextCircle, location, mode, setError, userId]);

  return {
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
  };
}
