import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';
import { savePlace } from '@/features/discover/service';
import { removeSavedPlace } from '@/features/bucket-list/service';
import { addRecentSearch, mergeResults, type SearchPlace, type SearchRequest, type SearchResponse } from './model';
import { searchPlaces } from './service';

export function usePlaceSearch() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [results, setResults] = useState<SearchPlace[]>([]);
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [request, setRequest] = useState<SearchRequest | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const recentRef = useRef<string[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const saving = useRef(new Set<string>());
  const generation = useRef(0);
  const morePending = useRef(false);
  const historyWrites = useRef(Promise.resolve());
  const historyVersion = useRef(0);
  const key = userId ? `outthere:search-history:${userId}` : null;
  useEffect(() => {
    const version = ++historyVersion.current;
    let active = true;
    setResults([]); setResponse(null); setRequest(null); setSavedIds(new Set()); setRecent([]); recentRef.current = [];
    setError(null); setLoading(false); setLoadingMore(false); morePending.current = false;
    if (key) void AsyncStorage.getItem(key).then(value => {
      if (!active || historyVersion.current !== version) return;
      const data: unknown = value ? JSON.parse(value) : [];
      if (Array.isArray(data)) { const next = data.filter((x): x is string => typeof x === 'string' && x.length <= 160).slice(0, 8); setRecent(next); recentRef.current = next; }
    }).catch(() => { /* History is optional; search remains usable. */ });
    return () => { active = false; generation.current++; };
  }, [key]);
  useFocusEffect(useCallback(() => {
    let active = true;
    if (userId && supabase) void supabase.from('saved_places').select('google_place_id').eq('user_id', userId).then(({ data, error }) => {
      if (active && !error) setSavedIds(new Set((data ?? []).map(row => row.google_place_id)));
    });
    return () => { active = false; };
  }, [userId]));
  function writeHistory(next: string[]) {
    historyVersion.current++; recentRef.current = next; setRecent(next);
    if (key) historyWrites.current = historyWrites.current.then(() => AsyncStorage.setItem(key, JSON.stringify(next))).catch(() => {});
  }
  async function run(next: SearchRequest) {
    const id = ++generation.current;
    setRequest(next); setResults([]); setResponse(null); setError(null); setLoading(true); setLoadingMore(false); morePending.current = false;
    try {
      const data = await searchPlaces(next);
      if (id !== generation.current) return;
      setResponse(data); setResults(mergeResults([], data.places, next.filters.sort));
      writeHistory(addRecentSearch(recentRef.current, next.query));
    } catch (e) { if (id === generation.current) setError(e instanceof Error ? e.message : 'Could not search. Try again.'); }
    finally { if (id === generation.current) setLoading(false); }
  }
  async function loadMore() {
    if (!request || !response?.cursor || loading || morePending.current) return;
    const id = generation.current;
    morePending.current = true; setLoadingMore(true); setError(null);
    try {
      const data = await searchPlaces({ ...request, cursor: response.cursor });
      if (id !== generation.current) return;
      setResponse(data); setResults(old => mergeResults(old, data.places, request.filters.sort));
    } catch (e) { if (id === generation.current) setError(e instanceof Error ? e.message : 'Could not load more places.'); }
    finally { if (id === generation.current) { morePending.current = false; setLoadingMore(false); } }
  }
  async function toggleSave(place: SearchPlace) {
    if (!userId || saving.current.has(place.id)) return;
    saving.current.add(place.id); setSavingIds(new Set(saving.current));
    const wasSaved = savedIds.has(place.id);
    try {
      if (wasSaved) await removeSavedPlace(userId, place.id); else await savePlace(userId, place.id, place.mode);
      setSavedIds(old => { const next = new Set(old); if (wasSaved) next.delete(place.id); else next.add(place.id); return next; });
    } finally { saving.current.delete(place.id); setSavingIds(new Set(saving.current)); }
  }
  return { results, response, request, loading, loadingMore, error, recent, savedIds, savingIds,
    run, loadMore, toggleSave, clearRecent: () => writeHistory([]) };
}
