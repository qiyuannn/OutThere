export type DiscoverMode = 'activities' | 'food';
export type PlaceAction = 'saved' | 'rejected';

export interface DiscoverSettings {
  areaKey: string;
  areaLabel: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  activityInterests: string[];
  foodInterests: string[];
}

export interface Recommendation {
  id: string;
  name: string;
  headline: string;
  category: string;
  address: string | null;
  distanceMeters: number;
  rating: number | null;
  ratingCount: number | null;
  priceLevel: string | null;
  openNow: boolean | null;
  mapsUrl: string | null;
  summary: string | null;
  reason: string;
  score: number;
  matchPercent: number;
  photoUrl: string | null;
  photoAttribution: { displayName: string; uri: string | null } | null;
}
