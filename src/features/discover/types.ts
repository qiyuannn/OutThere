export type DiscoverMode = 'activities' | 'food';
export type DiscoverChoice = 'pass' | 'save' | 'details';

export interface DiscoverLocation {
  latitude: number;
  longitude: number;
}

export type QueueTier = 'high' | 'med' | 'low';

export interface QueueRecommendations {
  high: Recommendation[];
  med: Recommendation[];
  low: Recommendation[];
}

export interface Recommendation {
  id: string;
  name: string;
  category: string;
  categoryKey?: string | null;
  categoryKeys?: string[];
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
  photos?: PlacePhoto[];
  websiteUri?: string | null;
  phoneNumber?: string | null;
  regularOpeningHours?: string[];
  amenities?: Record<string, boolean>;
  queueTier?: QueueTier;
  circleIndex?: number;
}

export interface PlacePhoto {
  name: string | null;
  widthPx: number | null;
  heightPx: number | null;
  authorAttributions: { displayName: string | null; uri: string | null; photoUri?: string | null }[];
}

export interface RecommendationResponse {
  recommendations: Recommendation[];
  queues?: QueueRecommendations;
  circleIndex?: number;
  exhausted: boolean;
  passedCount: number;
  debug?: {
    rawCounts?: { high: number; med: number; low: number; total: number };
    dedupedCounts?: { high: number; med: number; low: number; total: number };
    excludedCount?: number;
  };
}
