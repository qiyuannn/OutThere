import type { DiscoverMode, DiscoverSettings } from './types';

export const AREAS = [
  { key: 'central', label: 'Central Singapore', latitude: 1.290, longitude: 103.852 },
  { key: 'marina', label: 'Marina Bay', latitude: 1.283, longitude: 103.861 },
  { key: 'botanic', label: 'Botanic Gardens', latitude: 1.314, longitude: 103.816 },
  { key: 'east-coast', label: 'East Coast', latitude: 1.301, longitude: 103.913 },
  { key: 'sentosa', label: 'Sentosa', latitude: 1.249, longitude: 103.830 },
  { key: 'jurong-lake', label: 'Jurong Lake', latitude: 1.338, longitude: 103.729 },
] as const;

export const RADIUS_OPTIONS = [3000, 5000, 10000, 20000] as const;
export const INTERESTS: Record<DiscoverMode, ReadonlyArray<{ key: string; label: string }>> = {
  activities: [
    { key: 'nature', label: 'Nature' }, { key: 'culture', label: 'Arts & culture' },
    { key: 'active', label: 'Get active' }, { key: 'entertainment', label: 'Entertainment' },
    { key: 'relaxation', label: 'Relaxation' }, { key: 'learning', label: 'Learn something' },
  ],
  food: [
    { key: 'cafes', label: 'Cafés' }, { key: 'local', label: 'Local food' },
    { key: 'japanese', label: 'Japanese' }, { key: 'chinese', label: 'Chinese' },
    { key: 'indian', label: 'Indian' }, { key: 'western', label: 'Western' },
    { key: 'desserts', label: 'Desserts' },
  ],
};

export const DEFAULT_SETTINGS: DiscoverSettings = {
  areaKey: AREAS[0].key, areaLabel: AREAS[0].label,
  latitude: AREAS[0].latitude, longitude: AREAS[0].longitude,
  radiusMeters: 10000, activityInterests: [], foodInterests: [],
};
