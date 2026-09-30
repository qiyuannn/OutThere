/**
 * Network timeouts, cache expiration TTLs, and polling/debounce intervals.
 */

export const Timeouts = {
  /** Supabase edge function invocation timeout for place-search (ms) */
  placeSearchEdgeFunctionMs: 45_000,
  /** Device location request timeout (ms) */
  deviceLocationMs: 12_000,
  /** Maximum acceptable age for device cached last-known position (ms) */
  locationMaxAgeMs: 5 * 60 * 1000, // 5 minutes
  /** Search query typing debounce delay (ms) */
  searchDebounceMs: 350,
  /** Delay before auto-scrolling comment list to bottom on submit (ms) */
  commentScrollDelayMs: 100,
  /** Interval for periodic avatar signed URL refreshing in Avatar component (ms) */
  avatarRefreshIntervalMs: 50 * 60 * 1000, // 50 minutes
} as const;

export const CacheTtl = {
  /** Supabase Storage signed URL expiration lifetime (seconds). 1 hour. */
  signedUrlSeconds: 3600,
  /** In-memory live search places cache duration (ms). 2 minutes. */
  livePlacesMemoryCacheMs: 2 * 60 * 1000,
  /** Daily swipe allowance window duration (ms). 24 hours. */
  swipeWindowDurationMs: 24 * 60 * 60 * 1000,
} as const;
