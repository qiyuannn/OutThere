export interface PhotoAttribution {
  displayName: string | null;
  uri: string | null;
}

export interface PlacePhotoItem {
  url?: string | null;
  name?: string | null;
  widthPx?: number | null;
  heightPx?: number | null;
  authorAttributions?: PhotoAttribution[];
}

export interface PlaceDetails {
  id: string;
  name: string;
  category?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  distanceMeters?: number | null;
  rating?: number | null;
  ratingCount?: number | null;
  priceLevel?: string | null;
  openNow?: boolean | null;
  mapsUrl?: string | null;
  websiteUri?: string | null;
  phoneNumber?: string | null;
  regularOpeningHours?: string[];
  amenities?: Record<string, boolean>;
  reason?: string | null;
  score?: number | null;
  matchPercent?: number | null;
  photoUrl?: string | null;
  photoAttribution?: { displayName: string; uri: string | null } | null;
  photos?: PlacePhotoItem[];
}

export interface PlaceDetailsScreenProps {
  place: PlaceDetails;
  onBack?: () => void;
  isSaved?: boolean;
  onToggleSave?: (saved: boolean) => void | Promise<void>;
}
