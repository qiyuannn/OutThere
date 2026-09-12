import * as Location from 'expo-location';

import { supabase } from '@/lib/supabase';
import { AREAS, DEFAULT_SETTINGS } from './constants';
import type { DiscoverMode, DiscoverSettings, PlaceAction, Recommendation } from './types';

function client() {
  if (!supabase) throw new Error('Connect the app to Supabase to use recommendations.');
  return supabase;
}

export async function loadSettings(userId: string): Promise<DiscoverSettings> {
  const { data, error } = await client().from('discover_preferences').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  if (!data) return DEFAULT_SETTINGS;
  const knownArea = AREAS.find((area) => area.key === data.area_key);
  return {
    areaKey: data.area_key,
    areaLabel: knownArea?.label ?? (data.area_key === 'current' ? 'Current location' : 'Chosen area'),
    latitude: data.latitude, longitude: data.longitude, radiusMeters: data.radius_m,
    activityInterests: data.activity_interests ?? [], foodInterests: data.food_interests ?? [],
  };
}

export async function persistSettings(userId: string, settings: DiscoverSettings) {
  const { error } = await client().from('discover_preferences').upsert({
    user_id: userId, area_key: settings.areaKey, latitude: settings.latitude, longitude: settings.longitude,
    radius_m: settings.radiusMeters, activity_interests: settings.activityInterests,
    food_interests: settings.foodInterests, updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
  if (error) throw error;
}

export async function getRoundedDeviceLocation(): Promise<Pick<DiscoverSettings, 'areaKey' | 'areaLabel' | 'latitude' | 'longitude'>> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== 'granted') throw new Error('Location access was declined. Choose a Singapore area instead.');
  const result = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  const round = (value: number) => Math.round(value * 1000) / 1000;
  return { areaKey: 'current', areaLabel: 'Current location', latitude: round(result.coords.latitude), longitude: round(result.coords.longitude) };
}

export async function requestRecommendations(mode: DiscoverMode, settings: DiscoverSettings, excludedPlaceIds: string[]) {
  const interests = mode === 'activities' ? settings.activityInterests : settings.foodInterests;
  const { data, error } = await client().functions.invoke('place-recommendations', { body: {
    mode, latitude: settings.latitude, longitude: settings.longitude,
    radiusMeters: settings.radiusMeters, interests, excludedPlaceIds,
  } });
  if (error) throw error;
  if (!data || !Array.isArray(data.recommendations)) throw new Error('The recommendation service returned an invalid response.');
  return data.recommendations as Recommendation[];
}

export async function savePlaceAction(userId: string, placeId: string, mode: DiscoverMode, action: PlaceAction) {
  const { error } = await client().from('discover_place_actions').upsert({
    user_id: userId, google_place_id: placeId, mode, action, updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,google_place_id' });
  if (error) throw error;
}

export async function recordImpression(userId: string, place: Recommendation, mode: DiscoverMode) {
  const { error } = await client().from('discover_recommendation_impressions').insert({
    user_id: userId, google_place_id: place.id, mode, score: place.score,
  });
  if (error) throw error;
}
