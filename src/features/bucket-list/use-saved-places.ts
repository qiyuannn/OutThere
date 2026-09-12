import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { useAuth } from '@/providers/auth-provider';
import { getSavedPlaces } from './service';
import type { SavedPlace } from './types';

export function useSavedPlaces() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [places, setPlaces] = useState<SavedPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestNumber = useRef(0);

  const load = useCallback(async (showRefreshIndicator = false) => {
    if (!userId) return;

    const requestId = ++requestNumber.current;
    setLoading(true);
    if (showRefreshIndicator) setRefreshing(true);
    setError(null);

    try {
      const nextPlaces = await getSavedPlaces(userId);
      if (requestId === requestNumber.current) setPlaces(nextPlaces);
    } catch (reason) {
      if (requestId === requestNumber.current) {
        setError(reason instanceof Error ? reason.message : 'Could not load your saved places.');
      }
    } finally {
      if (requestId === requestNumber.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [userId]);

  useFocusEffect(useCallback(() => {
    void load();
    return () => { requestNumber.current += 1; };
  }, [load]));

  return {
    places,
    loading,
    refreshing,
    error,
    refresh: () => { void load(true); },
  };
}
