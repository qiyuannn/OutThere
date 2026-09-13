import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useProfile } from '@/providers/profile-provider';
import { useAuth } from '@/providers/auth-provider';
import { DEFAULT_RADIUS_METERS } from './constants';
import { clearPassedPlaces, getRoundedDeviceLocation, passPlace, requestRecommendations, savePlace } from './service';
import type { DiscoverChoice, DiscoverLocation, DiscoverMode, Recommendation } from './types';

const emptyLists = (): Record<DiscoverMode, Recommendation[]> => ({ activities: [], food: [] });
const zeroes = (): Record<DiscoverMode, number> => ({ activities: 0, food: 0 });
const falseModes = (): Record<DiscoverMode, boolean> => ({ activities: false, food: false });

export function useDiscover() {
  const { session } = useAuth(); const userId = session?.user.id;
  const { profile } = useProfile();
  const preferredRadius = profile?.travel_radius_meters ?? DEFAULT_RADIUS_METERS;
  const [mode, setMode] = useState<DiscoverMode>('activities');
  const [location, setLocation] = useState<DiscoverLocation | null>(null);
  const [radiusMeters, setRadiusMeters] = useState(preferredRadius);
  const [items, setItems] = useState(emptyLists); const [indices, setIndices] = useState(zeroes);
  const [loaded, setLoaded] = useState(falseModes); const [exhausted, setExhausted] = useState(falseModes);
  const [passedCounts, setPassedCounts] = useState(zeroes);
  const [loading, setLoading] = useState(true); const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestNumber = useRef(0);

  const fetchMode = useCallback(async (
    target: DiscoverMode,
    nextRadius = radiusMeters,
    knownLocation = location,
  ) => {
    const requestId = ++requestNumber.current; setLoading(true); setError(null);
    try {
      const nextLocation = knownLocation ?? await getRoundedDeviceLocation();
      const result = await requestRecommendations(target, nextLocation, nextRadius);
      if (requestId !== requestNumber.current) return;
      setLocation(nextLocation);
      setItems((value) => ({ ...value, [target]: result.recommendations }));
      setIndices((value) => ({ ...value, [target]: 0 }));
      setExhausted((value) => ({ ...value, [target]: result.exhausted }));
      setPassedCounts((value) => ({ ...value, [target]: result.passedCount }));
      setLoaded((value) => ({ ...value, [target]: true }));
    } catch (reason) {
      if (requestId === requestNumber.current) { setError(reason instanceof Error ? reason.message : 'Could not load nearby places.'); setLoaded((value) => ({ ...value, [target]: true })); }
    } finally { if (requestId === requestNumber.current) setLoading(false); }
  }, [location, radiusMeters]);

  useEffect(() => {
    if (!userId) return;
    setRadiusMeters(preferredRadius);
    setItems(emptyLists()); setIndices(zeroes()); setLoaded(falseModes());
    setExhausted(falseModes()); setPassedCounts(zeroes());
    void fetchMode('activities', preferredRadius, null);
    return () => { requestNumber.current += 1; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, preferredRadius]);

  useEffect(() => { if (userId && !loaded[mode] && !loading) void fetchMode(mode); }, [fetchMode, loaded, loading, mode, userId]);
  const current = items[mode][indices[mode]] ?? null;

  const choose = useCallback(async (choice: DiscoverChoice) => {
    if (!userId || !current || acting) return; setActing(true); setError(null);
    try {
      if (choice === 'pass') {
        await passPlace(userId, current.id, mode);
      } else if (choice === 'save') {
        await savePlace(userId, current.id, mode);
      }

      const reachedEnd = indices[mode] + 1 >= items[mode].length;
      if (reachedEnd) {
        await fetchMode(mode, radiusMeters, location);
      } else {
        setIndices((value) => ({ ...value, [mode]: value[mode] + 1 }));
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save that choice.'); }
    finally { setActing(false); }
  }, [acting, current, fetchMode, indices, items, location, mode, radiusMeters, userId]);

  const reviewPassed = useCallback(async () => {
    if (!userId || acting) return; setActing(true); setError(null);
    try { await clearPassedPlaces(userId, mode); await fetchMode(mode, radiusMeters, location); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not restore passed places.'); }
    finally { setActing(false); }
  }, [acting, fetchMode, location, mode, radiusMeters, userId]);

  const updateRadius = useCallback(async (nextRadius: number) => {
    if (!userId) return; setLoading(true); setError(null);
    try {
      setRadiusMeters(nextRadius); setItems(emptyLists()); setIndices(zeroes()); setExhausted(falseModes()); setPassedCounts(zeroes());
      setLoaded(falseModes()); await fetchMode(mode, nextRadius, location);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not update the search range.'); setLoading(false); throw reason; }
  }, [fetchMode, location, mode, userId]);

  return useMemo(() => ({ mode, setMode, radiusMeters, current, loading, acting, error, exhausted: exhausted[mode], passedCount: passedCounts[mode], choose, reviewPassed, updateRadius,
    retry: () => fetchMode(mode, radiusMeters, location) }),
  [acting, choose, current, error, exhausted, fetchMode, loading, location, mode, passedCounts, radiusMeters, reviewPassed, updateRadius]);
}
