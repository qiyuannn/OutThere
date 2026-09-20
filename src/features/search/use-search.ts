import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { removeSavedPlace } from '@/features/bucket-list/service';
import { savePlace } from '@/features/discover/service';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';
import { mergeResults, type SearchPlace, type SearchRequest, type SearchResponse } from './model';
import { getRecentPlaceIds, removeRecentPlaceId } from './recent-places';
import { getLivePlaceDetails, searchPlaces } from './service';

export function usePlaceSearch() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [results, setResults] = useState<SearchPlace[]>([]);
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [request, setRequest] = useState<SearchRequest | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentPlaces, setRecentPlaces] = useState<SearchPlace[]>([]);
  const [recentPlacesLoading, setRecentPlacesLoading] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const saving = useRef(new Set<string>());
  const generation = useRef(0);
  const morePending = useRef(false);

  useEffect(() => {
    setResults([]);
    setResponse(null);
    setRequest(null);
    setSavedIds(new Set());
    setRecentPlaces([]);
    setError(null);
    setLoading(false);
    setLoadingMore(false);
    morePending.current = false;
    return () => { generation.current++; };
  }, [userId]);

  useFocusEffect(useCallback(() => {
    let active = true;

    if (userId && supabase) {
      void supabase
        .from('saved_places')
        .select('google_place_id')
        .eq('user_id', userId)
        .then(({ data, error: savedError }) => {
          if (active && !savedError) setSavedIds(new Set((data ?? []).map((row) => row.google_place_id)));
        });
    }

    if (userId) {
      setRecentPlacesLoading(true);
      void getRecentPlaceIds(userId)
        .then(async (ids) => {
          const places = await getLivePlaceDetails(ids);
          if (active) setRecentPlaces(ids.map((id) => places.get(id)).filter((place): place is SearchPlace => !!place));
        })
        .catch(() => {
          if (active) setRecentPlaces([]);
        })
        .finally(() => {
          if (active) setRecentPlacesLoading(false);
        });
    } else {
      setRecentPlacesLoading(false);
    }

    return () => { active = false; };
  }, [userId]));

  async function run(next: SearchRequest) {
    const id = ++generation.current;
    setRequest(next);
    setResults([]);
    setResponse(null);
    setError(null);
    setLoading(true);
    setLoadingMore(false);
    morePending.current = false;
    try {
      const data = await searchPlaces(next);
      if (id !== generation.current) return;
      setResponse(data);
      setResults(mergeResults([], data.places, next.filters.sort));
    } catch (reason) {
      if (id === generation.current) setError(reason instanceof Error ? reason.message : 'Could not search. Try again.');
    } finally {
      if (id === generation.current) setLoading(false);
    }
  }

  async function loadMore() {
    if (!request || !response?.cursor || loading || morePending.current) return;
    const id = generation.current;
    morePending.current = true;
    setLoadingMore(true);
    setError(null);
    try {
      const data = await searchPlaces({ ...request, cursor: response.cursor });
      if (id !== generation.current) return;
      setResponse(data);
      setResults((old) => mergeResults(old, data.places, request.filters.sort));
    } catch (reason) {
      if (id === generation.current) setError(reason instanceof Error ? reason.message : 'Could not load more places.');
    } finally {
      if (id === generation.current) {
        morePending.current = false;
        setLoadingMore(false);
      }
    }
  }

  async function toggleSave(place: SearchPlace) {
    if (!userId || saving.current.has(place.id)) return;
    saving.current.add(place.id);
    setSavingIds(new Set(saving.current));
    const wasSaved = savedIds.has(place.id);
    try {
      if (wasSaved) await removeSavedPlace(userId, place.id);
      else await savePlace(userId, place.id, place.mode);
      setSavedIds((old) => {
        const next = new Set(old);
        if (wasSaved) next.delete(place.id);
        else next.add(place.id);
        return next;
      });
    } finally {
      saving.current.delete(place.id);
      setSavingIds(new Set(saving.current));
    }
  }

  async function removeRecentPlace(placeId: string) {
    setRecentPlaces((current) => current.filter((place) => place.id !== placeId));
    if (userId) await removeRecentPlaceId(userId, placeId);
  }

  return {
    results,
    response,
    request,
    loading,
    loadingMore,
    error,
    recentPlaces,
    recentPlacesLoading,
    savedIds,
    savingIds,
    run,
    loadMore,
    toggleSave,
    removeRecentPlace,
  };
}
