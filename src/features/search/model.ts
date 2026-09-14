export * from '../../../supabase/functions/_shared/search-contract.ts';
import type { Center, SearchRequest } from '../../../supabase/functions/_shared/search-contract.ts';
import type { PlaceDetails } from '@/features/place-details/types';

export interface SearchPlace extends PlaceDetails { mode: 'food' | 'activities'; liveDetails: true; detailsComplete?: boolean; unavailable?: boolean }
export interface SearchArea extends Center { id: string; label: string; attributions?: { provider?: string; providerUri?: string }[] }
export interface SearchResponse { places: SearchPlace[]; cursor: string | null; limited: boolean }
export interface SearchSnapshot { request: SearchRequest; response: SearchResponse }
