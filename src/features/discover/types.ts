export type DiscoverMode = 'activities' | 'food';
export type DiscoverChoice = 'pass' | 'notNow' | 'save';

export interface DiscoverLocation {
  latitude: number;
  longitude: number;
}

export interface Recommendation {
  id: string;
  name: string;
  category: string;
  address: string | null;
  distanceMeters: number;
  rating: number | null;
  ratingCount: number | null;
  priceLevel: string | null;
  openNow: boolean | null;
  mapsUrl: string | null;
  reason: string;
  score: number;
  matchPercent: number;
  photoUrl: string | null;
  photoAttribution: { displayName: string; uri: string | null } | null;
}

export interface RecommendationResponse {
  recommendations: Recommendation[];
  exhausted: boolean;
  passedCount: number;
}
