/**
 * supabase/functions/place-recommendations/types.ts
 * Pure TypeScript interfaces and types for place recommendations edge function.
 */

export type Mode = 'activities' | 'food';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface SearchCircle {
  index: number;
  center: Coordinates;
  radiusMeters: number;
  bearingDegrees?: number;
  offsetMeters?: number;
}

export interface PhotoAttribution {
  displayName?: string | null;
  uri?: string | null;
}

export interface PlacePhoto {
  name?: string | null;
  widthPx?: number | null;
  heightPx?: number | null;
  url?: string | null;
  authorAttributions?: PhotoAttribution[];
}

export interface Place {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  primaryType?: string;
  primaryTypeDisplayName?: { text?: string };
  types?: string[];
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  currentOpeningHours?: { openNow?: boolean };
  googleMapsUri?: string;
  photos?: PlacePhoto[];
  websiteUri?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  dineIn?: boolean;
  takeout?: boolean;
  delivery?: boolean;
  reservable?: boolean;
  outdoorSeating?: boolean;
  servesBeer?: boolean;
  servesWine?: boolean;
  servesVegetarianFood?: boolean;
  goodForChildren?: boolean;
  goodForGroups?: boolean;
  parkingOptions?: {
    freeParkingLot?: boolean;
    paidParkingLot?: boolean;
    freeStreetParking?: boolean;
    paidStreetParking?: boolean;
    valetParking?: boolean;
  };
  restroom?: boolean;
}

export interface CachedPlace {
  google_place_id: string;
  display_name: string | null;
  formatted_address: string | null;
  latitude: number | null;
  longitude: number | null;
  primary_type_display_name: string | null;
  rating: number | null;
  user_rating_count: number | null;
  price_level: string | null;
  google_maps_uri: string | null;
  website_uri: string | null;
  phone_number: string | null;
  regular_opening_hours: string[];
  amenities: Record<string, boolean>;
  photos: PlacePhoto[];
  last_fetched_at: string;
}

export interface EnrichedPlace {
  id: string;
  name: string;
  category: string;
  categoryKey: string | null;
  categoryKeys: string[];
  address: string | null;
  distanceMeters: number;
  rating: number | null;
  ratingCount: number | null;
  priceLevel: string | null;
  openNow: boolean | null;
  mapsUrl: string | null;
  websiteUri: string | null;
  phoneNumber: string | null;
  regularOpeningHours: string[];
  amenities: Record<string, boolean>;
  reason: string;
  score: number;
  matchPercent: number;
  photos: PlacePhoto[];
  photoUrl: string | null;
  photoAttribution: PhotoAttribution | null;
}

export interface RecommendationQueues {
  high: EnrichedPlace[];
  med: EnrichedPlace[];
  low: EnrichedPlace[];
}

export interface RecommendationResponse {
  queues: RecommendationQueues;
  recommendations: EnrichedPlace[];
  circleIndex: number;
  exhausted: boolean;
  passedCount: number;
  debug?: Record<string, unknown>;
}

export interface PlaceRecommendationsPayload {
  action?: 'get-place-photos' | 'backfill-photos';
  mode?: Mode;
  latitude?: number;
  longitude?: number;
  radiusMeters?: number;
  circleIndex?: number;
  excludedPlaceIds?: string[];
  placeId?: string;
  photos?: PlacePhoto[];
}

export interface SupabaseClientLike {
  auth: {
    getUser(jwt?: string): Promise<{ data: { user: { id: string } | null }; error: unknown | null }>;
  };
  from(table: string): {
    select(columns: string): any;
    upsert(values: unknown, options?: Record<string, unknown>): Promise<{ error: unknown | null }>;
    update(values: unknown): any;
  };
}

export interface RecommendationsDependencies {
  client: SupabaseClientLike;
  admin: SupabaseClientLike;
  googleKey: string;
  fetchPhoto?: (photoName: string) => Promise<string | null>;
  searchNearby?: (
    center: Coordinates,
    radius: number,
    types: string[],
    tierName?: string,
    excludedPrimaryTypes?: string[]
  ) => Promise<{ ok: boolean; places: Place[] }>;
}
