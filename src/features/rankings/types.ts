import type { Vibe } from './comparison';

export type RankingMode = 'food' | 'activities';

export interface RankedPlace {
  id: string;
  user_id: string;
  google_place_id: string;
  mode: RankingMode;
  rating: number; // 0.0 to 10.0
  vibe: Vibe;
  recommend: boolean;
  notes: string | null;
  rated_at: string;
  display_name: string;
  formatted_address: string | null;
  primary_type: string | null;
  category_key: string | null;
  category_name: string | null;
  category_icon: string | null;
  photo_url: string | null;
}

export interface CandidatePlace {
  google_place_id: string;
  display_name: string;
  formatted_address: string | null;
  primary_type: string | null;
  primary_type_display_name?: string | null;
  photo_url: string | null;
  mode: RankingMode;
}

export interface SaveRatingInput {
  google_place_id: string;
  mode: RankingMode;
  rating: number;
  vibe: Vibe;
  recommend: boolean;
  notes?: string | null;
  recalibratedPlaces?: Array<{ google_place_id: string; rating: number; vibe?: Vibe }>;
}
