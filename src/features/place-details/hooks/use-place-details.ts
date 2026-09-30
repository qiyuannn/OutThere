import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/providers/auth-provider';
import type { PlaceDetailsScreenProps, UsePlaceDetailsReturn } from '../types';
import { usePlaceRecord } from './use-place-record';
import { usePlaceInteractions } from './use-place-interactions';

export function usePlaceDetails(
  options: Partial<PlaceDetailsScreenProps> = {}
): UsePlaceDetailsReturn {
  const { place: directPlace, isSaved: directIsSaved, onToggleSave: directOnToggleSave } = options;
  const { session } = useAuth();
  const userId = session?.user?.id;

  const searchParams = useLocalSearchParams<{
    id?: string;
    placeJson?: string;
    mode?: 'food' | 'activities';
  }>();

  const record = usePlaceRecord({
    directPlace,
    idParam: searchParams.id,
    placeJsonParam: searchParams.placeJson,
    modeParam: searchParams.mode,
  });

  const interactions = usePlaceInteractions({
    userId,
    place: record.place,
    placeId: record.placeId,
    detectedMode: record.detectedMode,
    directIsSaved,
    directOnToggleSave,
  });

  return {
    place: record.place,
    placeId: record.placeId,
    loading: record.loading,
    detectedMode: record.detectedMode,
    ...interactions,
  };
}
