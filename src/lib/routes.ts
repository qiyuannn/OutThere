import type { Href } from 'expo-router';
import type { RankingMode } from '@/features/rankings/types';
import type { SearchFilters } from '@/features/search/model';

export interface PostRatingRouteParams {
  placeId: string;
  name: string;
  category?: string;
  address?: string;
  rating: string | number;
}

export interface SearchResultsRouteParams {
  query: string;
  latitude: number | string;
  longitude: number | string;
  filters?: SearchFilters | string;
}

/**
 * Type-safe navigation route builders for Expo Router.
 * Centralizes all dynamic pathname strings and parameters, eliminating
 * the need for `as unknown as Href` type assertions.
 */
export const routes = {
  /** Navigate to post-creation screen for a rated venue */
  postRating: (params: PostRatingRouteParams): Href => ({
    pathname: '/rankings/post',
    params: {
      placeId: params.placeId,
      name: params.name,
      category: params.category ?? '',
      address: params.address ?? '',
      rating: typeof params.rating === 'number' ? params.rating.toFixed(1) : params.rating,
    },
  }),

  /** Navigate to venue details page */
  placeDetails: (id: string, mode?: RankingMode): Href => ({
    pathname: '/search/[id]',
    params: mode ? { id, mode } : { id },
  }),

  /** Navigate to another user's public profile */
  userProfile: (userId: string): Href => ({
    pathname: '/search/profile/[id]',
    params: { id: userId },
  }),

  /** Navigate to search results with coordinates and filter query */
  searchResults: (params: SearchResultsRouteParams): Href => ({
    pathname: '/search/results',
    params: {
      query: params.query.trim(),
      latitude: String(params.latitude),
      longitude: String(params.longitude),
      filters: typeof params.filters === 'string' ? params.filters : JSON.stringify(params.filters ?? {}),
    },
  }),

  /** Navigate to bucket list venue item */
  bucketListPlace: (id: string, mode?: string): Href => ({
    pathname: '/bucket-list/[id]',
    params: mode ? { id, mode } : { id },
  }),

  /** Navigate to post comments thread */
  postComments: (postId: string | number): Href => ({
    pathname: '/rankings/comments',
    params: { postId: String(postId) },
  }),

  /** User profile statistics */
  userStatistics: (userId: string, userName: string): Href => ({
    pathname: '/search/profile/statistics',
    params: { userId, userName },
  }),

  /** User profile activities */
  userActivities: (userId: string, userName: string): Href => ({
    pathname: '/search/profile/activities',
    params: { userId, userName },
  }),

  /** Static routes */
  search: '/search' as Href,
  rankings: '/rankings' as Href,
  profile: '/profile' as Href,
  editProfile: '/profile/edit' as Href,
  profileStatistics: '/profile/statistics' as Href,
  profileActivities: '/profile/activities' as Href,
} as const;
