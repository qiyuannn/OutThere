import { useEffect, useState } from 'react';
import {
  computeAllowanceState,
  fetchSwipeAllowance,
  loadCachedAllowance,
  type SwipeAllowanceState,
} from '../allowance';

interface UseDiscoverAllowanceProps {
  userId?: string;
  isPro: boolean;
}

export function useDiscoverAllowance({ userId, isPro }: UseDiscoverAllowanceProps) {
  const [allowance, setAllowance] = useState<SwipeAllowanceState>(() =>
    computeAllowanceState({ isPro })
  );

  useEffect(() => {
    if (!userId) return;
    let mounted = true;

    void loadCachedAllowance(userId, isPro).then((cached) => {
      if (mounted && cached) setAllowance(cached);
    });

    void fetchSwipeAllowance(userId, isPro).then((fresh) => {
      if (mounted) setAllowance(fresh);
    });

    return () => {
      mounted = false;
    };
  }, [userId, isPro]);

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

  const refreshAllowance = () => {
    if (!userId) return Promise.resolve();
    return fetchSwipeAllowance(userId, isPro).then(setAllowance);
  };

  return {
    allowance,
    setAllowance,
    refreshAllowance,
  };
}
