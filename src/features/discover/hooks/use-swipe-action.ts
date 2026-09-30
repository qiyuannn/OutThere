import { useCallback } from 'react';
import { router } from 'expo-router';

import { routes } from '@/lib/routes';
import { executeSwipe, type SwipeAllowanceState } from '../allowance';
import { drawNextRecommendation, isFeedExhausted, shouldReplenish } from '../queues';
import type { DiscoverChoice, DiscoverLocation, DiscoverMode, Recommendation } from '../types';
import type { ModeState } from './discover-types';

interface UseSwipeActionProps {
  userId?: string;
  isPro: boolean;
  allowance: SwipeAllowanceState;
  setAllowance: React.Dispatch<React.SetStateAction<SwipeAllowanceState>>;
  current: Recommendation | null;
  mode: DiscoverMode;
  modesStateRef: React.MutableRefObject<Record<DiscoverMode, ModeState>>;
  setModesState: React.Dispatch<React.SetStateAction<Record<DiscoverMode, ModeState>>>;
  fetchNextCircle: (targetMode: DiscoverMode, targetRadius?: number, knownLocation?: DiscoverLocation | null) => Promise<void>;
  radiusMeters: number;
  location: DiscoverLocation | null;
  acting: boolean;
  setActing: (acting: boolean) => void;
  setError: (err: string | null) => void;
}

export function useSwipeAction({
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
}: UseSwipeActionProps) {
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
        router.push(routes.bucketListPlace(placeToResolve.id, mode));
      }

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
      setModesState((prev) => ({ ...prev, [mode]: nextModeState }));

      if (shouldFetch) {
        void fetchNextCircle(mode, radiusMeters, location);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save that choice.');
    } finally {
      setActing(false);
    }
  }, [acting, allowance.isLimitReached, current, fetchNextCircle, isPro, location, mode, modesStateRef, radiusMeters, setActing, setAllowance, setError, setModesState, userId]);

  return { choose };
}
