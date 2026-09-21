import { useEffect, useState } from 'react';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { ActivityIndicator } from 'react-native';
import { Button, Screen } from '@/components/foundation';
import { ThemedText } from '@/components/themed-text';
import { PlaceDetailsScreen } from '@/features/place-details';
import { useAuth } from '@/providers/auth-provider';
import { recordRecentPlaceId } from './recent-places';
import { getLivePlaceDetails } from './service';
import type { SearchPlace } from './model';

export function SearchDetailsScreen() {
  const { id, mode } = useLocalSearchParams<{ id: string; mode?: string }>();
  const { session } = useAuth();
  const userId = session?.user.id;
  const [place, setPlace] = useState<SearchPlace | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true; setPlace(null); setError(null);
    void getLivePlaceDetails([id]).then(places => {
      if (active) {
        const next = places.get(id);
        if (next) {
          setPlace({ ...next, mode: mode === 'food' || mode === 'activities' ? mode : next.mode });
          if (userId) void recordRecentPlaceId(userId, id).catch(() => {});
        } else setError('This place is no longer available.');
      }
    }).catch(e => { if (active) setError(e instanceof Error ? e.message : 'Could not load this place.'); });
    return () => { active = false; };
  }, [id, mode, attempt, userId]);
  const back = () => router.canGoBack() ? router.back() : router.replace('/search' as Href);
  if (place) return <PlaceDetailsScreen key={place.id} place={place} onBack={back} />;
  return <Screen title="Place details" headerDescription="Place details" showBack onBack={back}>{error ? <><ThemedText accessibilityRole="alert">{error}</ThemedText><Button label="Retry" onPress={() => setAttempt(n => n + 1)} /></> : <ActivityIndicator accessibilityLabel="Loading place details" />}</Screen>;
}
