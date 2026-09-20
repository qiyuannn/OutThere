import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useNetworkState } from 'expo-network';
import { mutateSocial, readSocial, subscribeSocial } from './api';
import { hasNextSocialPage, mergeSocialPage, socialError, socialPagePayload, visiblePage } from './model';
import type { SocialMutation, SocialReadAction } from './types';

export function useNetworkStatus() {
  const state = useNetworkState();
  return { offline: state.isConnected === false || state.isInternetReachable === false };
}

export function useSocialQuery<T>(action: SocialReadAction, payload: Record<string, unknown> = {}, enabled = true) {
  const { offline } = useNetworkStatus();
  const payloadKey = JSON.stringify(payload);
  const stablePayload = useMemo(() => JSON.parse(payloadKey) as Record<string, unknown>, [payloadKey]);
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState('');
  const version = useRef(0);

  const refresh = useCallback(async () => {
    if (!enabled) { setLoading(false); return; }
    if (offline) { setLoading(false); setError(''); return; }
    const request = ++version.current;
    setLoading(true); setError('');
    try {
      const next = await readSocial<T>(action, stablePayload);
      if (request === version.current) setData(next);
    } catch (reason) {
      if (request === version.current) setError(socialError(reason));
    } finally {
      if (request === version.current) setLoading(false);
    }
  }, [action, enabled, offline, stablePayload]);

  useFocusEffect(useCallback(() => { void refresh(); return () => { version.current++; }; }, [refresh]));
  useEffect(() => subscribeSocial(() => { void refresh(); }), [refresh]);
  return { data, loading, error, offline, refresh };
}

export function useSocialList<T extends { id: string; created_at?: string }>(action: SocialReadAction, payload: Record<string, unknown> = {}, enabled = true, offsetBased = false) {
  const { offline } = useNetworkStatus();
  const payloadKey = JSON.stringify(payload);
  const stablePayload = useMemo(() => JSON.parse(payloadKey) as Record<string, unknown>, [payloadKey]);
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const version = useRef(0);
  const itemsRef = useRef<T[]>([]);
  useEffect(() => { itemsRef.current = items; }, [items]);

  const load = useCallback(async (more = false) => {
    if (!enabled) { setLoading(false); return; }
    if (offline) { setLoading(false); setLoadingMore(false); setError(''); return; }
    const request = ++version.current;
    if (more) setLoadingMore(true);
    else setLoading(true);
    setError('');
    try {
      const currentItems = itemsRef.current;
      const pagePayload = socialPagePayload(stablePayload, currentItems, more, offsetBased);
      const page = await readSocial<T[]>(action, pagePayload);
      if (request !== version.current) return;
      const visible = visiblePage(page);
      setHasMore(hasNextSocialPage(page));
      setItems((current) => more ? mergeSocialPage(current, visible) : visible);
    } catch (reason) {
      if (request === version.current) setError(socialError(reason));
    } finally {
      if (request === version.current) { setLoading(false); setLoadingMore(false); }
    }
  }, [action, enabled, offline, offsetBased, stablePayload]);

  const refresh = useCallback(() => load(false), [load]);
  useFocusEffect(useCallback(() => { void refresh(); return () => { version.current++; }; }, [refresh]));
  useEffect(() => subscribeSocial(() => { void refresh(); }), [refresh]);
  return { items, loading, loadingMore, error, hasMore, offline, refresh, loadMore: () => load(true) };
}

export function useSocialMutation() {
  const { offline } = useNetworkStatus();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = useCallback(async (action: SocialMutation, payload: Record<string, unknown> = {}) => {
    if (busy) return false;
    if (offline) { setError('You’re offline. Reconnect and try again.'); return false; }
    setBusy(true); setError('');
    try { await mutateSocial(action, payload); return true; }
    catch (reason) { setError(socialError(reason)); return false; }
    finally { setBusy(false); }
  }, [busy, offline]);
  return { busy, error, offline, clearError: () => setError(''), run };
}
