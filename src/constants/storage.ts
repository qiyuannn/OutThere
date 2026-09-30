/**
 * Storage bucket names, AsyncStorage keys, and deep linking schemes.
 */

export const StorageBuckets = {
  avatars: 'avatars',
  postPhotos: 'post-photos',
} as const;

export type StorageBucket = (typeof StorageBuckets)[keyof typeof StorageBuckets];

export const StorageKeys = {
  /** AsyncStorage key for user recent places */
  recentPlaces: (userId: string) => `outthere:recent-places:${userId}`,
  /** AsyncStorage key for user discovery swipe allowance */
  discoveryAllowance: (userId: string) => `outthere:discovery-allowance:${userId}`,
} as const;

export const DeepLinks = {
  scheme: 'outthere',
  authCallbackPath: 'auth/callback',
  authCallbackUrl: 'outthere://auth/callback',
} as const;
