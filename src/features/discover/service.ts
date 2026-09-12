import * as Location from 'expo-location';

import { supabase } from '@/lib/supabase';
import type { DiscoverLocation, DiscoverMode, Recommendation, RecommendationResponse } from './types';

function client() {
  if (!supabase) throw new Error('Connect the app to Supabase to use recommendations.');
  return supabase;
}

export async function getRoundedDeviceLocation(): Promise<DiscoverLocation> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== 'granted') throw new Error('Location access was declined. Enable it in device settings to see nearby places.');
  if (!await Location.hasServicesEnabledAsync()) {
    throw new Error('Location Services are turned off. Enable them in device settings, then try again.');
  }

  const currentPosition = Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Location request timed out.')), 12_000));
  let result: Location.LocationObject;
  try {
    result = await Promise.race([currentPosition, timeout]);
  } catch {
    const lastKnown = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60 * 1000, requiredAccuracy: 1000 });
    if (!lastKnown) throw new Error('Could not find your location. Check your device location settings and try again.');
    result = lastKnown;
  }
  const round = (value: number) => Math.round(value * 1000) / 1000;
  return { latitude: round(result.coords.latitude), longitude: round(result.coords.longitude) };
}

export async function requestRecommendations(mode: DiscoverMode, location: DiscoverLocation, radiusMeters: number) {
  const { data, error } = await client().functions.invoke('place-recommendations', { body: {
    mode, latitude: location.latitude, longitude: location.longitude, radiusMeters,
  } });
  if (error) throw error;
  if (!data || !Array.isArray(data.recommendations) || typeof data.exhausted !== 'boolean' || typeof data.passedCount !== 'number') {
    throw new Error('The recommendation service returned an invalid response.');
  }
  return data as RecommendationResponse;
}

export async function savePlace(userId: string, placeId: string, mode: DiscoverMode) {
  const { error } = await client().from('saved_places').upsert({
    user_id: userId, google_place_id: placeId, mode, saved_at: new Date().toISOString(),
  }, { onConflict: 'user_id,google_place_id' });
  if (error) throw error;
}

export async function passPlace(userId: string, placeId: string, mode: DiscoverMode) {
  const { error } = await client().from('passed_places').upsert({
    user_id: userId, google_place_id: placeId, mode, passed_at: new Date().toISOString(),
  }, { onConflict: 'user_id,google_place_id,mode' });
  if (error) throw error;
}

export async function clearPassedPlaces(userId: string, mode: DiscoverMode) {
  const { error } = await client().from('passed_places').delete().eq('user_id', userId).eq('mode', mode);
  if (error) throw error;
}

export async function recordImpression(userId: string, place: Recommendation, mode: DiscoverMode) {
  const { error } = await client().from('discover_recommendation_impressions').insert({
    user_id: userId, google_place_id: place.id, mode, score: place.score,
  });
  if (error) throw error;
}
