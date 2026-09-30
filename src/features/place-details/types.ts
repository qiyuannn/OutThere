import type {
  CandidatePlace,
  RankedPlace,
  RankingMode,
  SaveRatingInput,
} from '@/features/rankings/types';

export interface PhotoAttribution {
  displayName: string | null;
  uri: string | null;
}

export interface PlacePhotoItem {
  googleMapsUri?: string | null;
  url?: string | null;
  name?: string | null;
  widthPx?: number | null;
  heightPx?: number | null;
  authorAttributions?: PhotoAttribution[];
}

export interface PlaceDetails {
  mode?: 'food' | 'activities';
  primaryType?: string | null;
  liveDetails?: boolean;
  attributions?: { provider?: string; providerUri?: string }[];
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

export interface UsePlaceDetailsOptions {
  place?: PlaceDetails;
  isSaved?: boolean;
  onToggleSave?: (saved: boolean) => void | Promise<void>;
}

export interface UsePlaceDetailsReturn {
  place: PlaceDetails | null;
  placeId: string | undefined;
  loading: boolean;
  isSaved: boolean;
  userRating: number | null;
  hasPosted: boolean;
  postStatusReady: boolean;
  detectedMode: RankingMode;
  existingRankings: RankedPlace[];
  rankingsReady: boolean;
  rankingsError: boolean;
  isRateModalVisible: boolean;
  candidateForModal: CandidatePlace | null;
  setIsRateModalVisible: (visible: boolean) => void;
  handleToggleSave: (nextSaved: boolean) => Promise<void>;
  handleSaveRating: (input: SaveRatingInput) => Promise<void>;
  retryRankings: () => void;
  openRateModal: () => void;
  closeRateModal: () => void;
}
