import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/providers/auth-provider';
import { deleteUserPlaceRating, getUserRankings, saveUserPlaceRating } from './service';
import type { RankedPlace, RankingMode, SaveRatingInput } from './types';

export function useRankings(initialMode: RankingMode = 'food') {
  const { session } = useAuth();
  const userId = session?.user.id;

  const [mode, setMode] = useState<RankingMode>(initialMode);
  const [rankings, setRankings] = useState<RankedPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const requestVersion = useRef(0);

  const loadData = useCallback(async (isRefresh = false) => {
    const version = ++requestVersion.current;
    if (!userId) {
      setLoading(false);
      return;
    }
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const data = await getUserRankings(userId, mode);
      if (version === requestVersion.current) setRankings(data);
    } catch (err) {
      if (version === requestVersion.current) setError(err instanceof Error ? err.message : 'Could not load your rankings.');
    } finally {
      if (version === requestVersion.current) { setLoading(false); setRefreshing(false); }
    }
  }, [userId, mode]);

  useFocusEffect(useCallback(() => {
    void loadData();
    return () => { requestVersion.current++; };
  }, [loadData]));

  // Reset category filter when switching between food and activities
  useEffect(() => {
    setCategoryFilter(null);
    setSearchQuery('');
  }, [mode]);

  const saveRating = useCallback(async (input: SaveRatingInput) => {
    if (!userId) return;
    try {
      await saveUserPlaceRating(userId, input);
      await loadData(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save rating.');
      throw err;
    }
  }, [userId, loadData]);

  const removeRating = useCallback(async (placeId: string) => {
    if (!userId) return;
    try {
      await deleteUserPlaceRating(userId, placeId, mode);
      await loadData(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete rating.');
      throw err;
    }
  }, [userId, mode, loadData]);

  const filteredRankings = useMemo(() => {
    return rankings.filter((item) => {
      if (categoryFilter && item.category_key !== categoryFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = item.display_name.toLowerCase().includes(q);
        const matchesAddress = item.formatted_address?.toLowerCase().includes(q);
        const matchesNotes = item.notes?.toLowerCase().includes(q);
        if (!matchesName && !matchesAddress && !matchesNotes) return false;
      }
      return true;
    });
  }, [rankings, categoryFilter, searchQuery]);

  const stats = useMemo(() => {
    const count = rankings.length;
    if (count === 0) {
      return {
        totalCount: 0,
        averageScore: '—',
        topPlace: null,
      };
    }
    const sum = rankings.reduce((acc, r) => acc + r.rating, 0);
    const avg = Math.round((sum / count) * 10) / 10;
    return {
      totalCount: count,
      averageScore: avg.toFixed(1),
      topPlace: rankings[0] ?? null,
    };
  }, [rankings]);

  return {
    mode,
    setMode,
    rankings,
    filteredRankings,
    loading,
    refreshing,
    error,
    categoryFilter,
    setCategoryFilter,
    searchQuery,
    setSearchQuery,
    stats,
    saveRating,
    removeRating,
    refresh: () => loadData(true),
  };
}
