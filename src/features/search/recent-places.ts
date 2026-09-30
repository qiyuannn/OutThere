import AsyncStorage from '@react-native-async-storage/async-storage';
import { PaginationLimits } from '@/constants/limits';
import { StorageKeys } from '@/constants/storage';

const MAX_RECENT_PLACES = PaginationLimits.maxRecentPlaces;

export async function getRecentPlaceIds(userId: string): Promise<string[]> {
  const value = await AsyncStorage.getItem(StorageKeys.recentPlaces(userId));
  const parsed: unknown = value ? JSON.parse(value) : [];
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((item): item is string => typeof item === 'string' && item.length > 0 && item.length <= 256)
    .slice(0, MAX_RECENT_PLACES);
}

export async function recordRecentPlaceId(userId: string, placeId: string): Promise<void> {
  const current = await getRecentPlaceIds(userId);
  const next = [placeId, ...current.filter((id) => id !== placeId)].slice(0, MAX_RECENT_PLACES);
  await AsyncStorage.setItem(StorageKeys.recentPlaces(userId), JSON.stringify(next));
}


export async function removeRecentPlaceId(userId: string, placeId: string): Promise<void> {
  const current = await getRecentPlaceIds(userId);
  await AsyncStorage.setItem(StorageKeys.recentPlaces(userId), JSON.stringify(current.filter((id) => id !== placeId)));
}

