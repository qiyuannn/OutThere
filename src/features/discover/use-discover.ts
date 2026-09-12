import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useAuth } from '@/providers/auth-provider';
import { DEFAULT_SETTINGS } from './constants';
import { loadSettings, persistSettings, recordImpression, requestRecommendations, savePlaceAction } from './service';
import type { DiscoverMode, DiscoverSettings, Recommendation } from './types';

const emptyLists = (): Record<DiscoverMode, Recommendation[]> => ({ activities: [], food: [] });
const zeroes = (): Record<DiscoverMode, number> => ({ activities: 0, food: 0 });
const falseModes = (): Record<DiscoverMode, boolean> => ({ activities: false, food: false });
const hiddenLists = (): Record<DiscoverMode, string[]> => ({ activities: [], food: [] });

export function useDiscover() {
  const { session } = useAuth(); const userId = session?.user.id;
  const [mode, setMode] = useState<DiscoverMode>('activities');
  const [settings, setSettings] = useState<DiscoverSettings>(DEFAULT_SETTINGS);
  const [items, setItems] = useState(emptyLists); const [indices, setIndices] = useState(zeroes);
  const [loaded, setLoaded] = useState(falseModes); const [hidden, setHidden] = useState(hiddenLists);
  const [loading, setLoading] = useState(true); const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null); const [notice, setNotice] = useState<string | null>(null);
  const requestNumber = useRef(0); const recorded = useRef(new Set<string>());

  const fetchMode = useCallback(async (target: DiscoverMode, next = settings, excluded = hidden[target]) => {
    const requestId = ++requestNumber.current; setLoading(true); setError(null); setNotice(null);
    try {
      const recommendations = await requestRecommendations(target, next, excluded);
      if (requestId !== requestNumber.current) return;
      setItems((value) => ({ ...value, [target]: recommendations }));
      setIndices((value) => ({ ...value, [target]: 0 })); setLoaded((value) => ({ ...value, [target]: true }));
    } catch (reason) {
      if (requestId === requestNumber.current) { setError(reason instanceof Error ? reason.message : 'Could not load nearby places.'); setLoaded((value) => ({ ...value, [target]: true })); }
    } finally { if (requestId === requestNumber.current) setLoading(false); }
  }, [hidden, settings]);

  useEffect(() => {
    if (!userId) return; let active = true; setLoading(true);
    loadSettings(userId).then((saved) => { if (active) { setSettings(saved); return fetchMode('activities', saved, []); } })
      .catch((reason) => active && setError(reason instanceof Error ? reason.message : 'Could not load your preferences.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => { if (userId && !loaded[mode] && !loading) void fetchMode(mode); }, [fetchMode, loaded, loading, mode, userId]);
  const current = items[mode][indices[mode]] ?? null;
  useEffect(() => {
    if (!userId || !current) return; const key = `${mode}:${current.id}`;
    if (recorded.current.has(key)) return; recorded.current.add(key);
    void recordImpression(userId, current, mode).catch(() => recorded.current.delete(key));
  }, [current, mode, userId]);

  const choose = useCallback(async (choice: 'pass' | 'later' | 'save') => {
    if (!userId || !current || acting) return; setActing(true); setError(null);
    try {
      if (choice !== 'later') await savePlaceAction(userId, current.id, mode, choice === 'save' ? 'saved' : 'rejected');
      setHidden((value) => ({ ...value, [mode]: [...value[mode], current.id] }));
      setIndices((value) => ({ ...value, [mode]: value[mode] + 1 }));
      setNotice(choice === 'save' ? 'Saved for later.' : choice === 'later' ? 'Skipped for this session.' : 'You won’t see that place again.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save that choice.'); }
    finally { setActing(false); }
  }, [acting, current, mode, userId]);

  const updateSettings = useCallback(async (next: DiscoverSettings) => {
    if (!userId) return; setLoading(true); setError(null);
    try {
      await persistSettings(userId, next); setSettings(next); setHidden(hiddenLists()); setItems(emptyLists()); setIndices(zeroes());
      setLoaded(falseModes()); await fetchMode(mode, next, []);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save your preferences.'); setLoading(false); throw reason; }
  }, [fetchMode, mode, userId]);

  const startOver = useCallback(async () => { setHidden((value) => ({ ...value, [mode]: [] })); setNotice(null); await fetchMode(mode, settings, []); }, [fetchMode, mode, settings]);
  return useMemo(() => ({ mode, setMode, settings, current, loading, acting, error, notice, choose, updateSettings, startOver,
    retry: () => fetchMode(mode, settings, hidden[mode]) }),
  [acting, choose, current, error, fetchMode, hidden, loading, mode, notice, settings, startOver, updateSettings]);
}
