import { useCallback, useEffect, useState } from 'react';
import type { ProfileMode } from './types';
import {
  getUserCategoryWeights,
  getUserProfileStats,
  resetCategoryWeight,
  updateCategoryWeight,
} from './service';

export function useProfileCategories(userId: string | undefined, mode: ProfileMode) {
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [stats, setStats] = useState<{ savedCount: number; passedCount: number }>({
    savedCount: 0,
    passedCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [wts, userStats] = await Promise.all([
        getUserCategoryWeights(userId, mode),
        getUserProfileStats(userId, mode),
      ]);
      setWeights(wts);
      setStats(userStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load category weights.');
    } finally {
      setLoading(false);
    }
  }, [userId, mode]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const setCategoryWeight = useCallback(async (key: string, nextWeight: number) => {
    if (!userId) return;
    const clamped = Math.max(0.00, Math.min(1.00, Math.round(nextWeight * 100) / 100));
    setWeights((prev) => ({ ...prev, [key]: clamped }));
    try {
      await updateCategoryWeight(userId, mode, key, clamped);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update weight.');
    }
  }, [userId, mode]);

  const resetWeight = useCallback(async (key: string) => {
    if (!userId) return;
    setWeights((prev) => ({ ...prev, [key]: 0.00 }));
    try {
      await resetCategoryWeight(userId, mode, key);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset weight.');
    }
  }, [userId, mode]);

  return {
    weights,
    stats,
    loading,
    error,
    setCategoryWeight,
    resetWeight,
    refresh: loadData,
  };
}
