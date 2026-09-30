/**
 * Size limits, image dimensions, pagination page sizes, and string length boundaries.
 */

export const ImageLimits = {
  /** Profile avatar crop & resize square dimension in pixels */
  maxProfileAvatarDimensionPx: 512,
  /** Profile avatar picker quality */
  avatarQuality: 0.85,
  /** Profile avatar manipulator compression */
  avatarCompression: 0.8,
  /**
   * Maximum length of base64-encoded avatar string.
   * Corresponds to 2 MB binary payload: Math.ceil(2097152 * 4 / 3) ≈ 2,796,202.
   */
  maxAvatarBase64Chars: 2_796_200,
  /** Maximum binary size in bytes for uploaded avatar (2 MB) */
  maxAvatarSizeBytes: 2 * 1024 * 1024,
  /** Default Avatar UI component size in pixels */
  defaultAvatarUiSize: 88,
  /** Avatar UI component size inside profile edit form */
  formAvatarUiSize: 69,

  /** Maximum photos allowed per post */
  maxPostPhotos: 5,
  /** Post photos picker compression quality */
  postPhotoQuality: 0.85,
  /** Maximum binary size in bytes for uploaded post photo (5 MB) */
  maxPostPhotoSizeBytes: 5 * 1024 * 1024,
} as const;

export const InputLimits = {
  /** Maximum characters for user display name */
  maxDisplayNameLength: 60,
  /** Minimum characters for username */
  minUsernameLength: 3,
  /** Maximum characters for username */
  maxUsernameLength: 24,
  /** Maximum characters for user bio */
  maxBioLength: 240,
  /** Maximum characters for post body */
  maxPostBodyLength: 2000,
  /** Maximum characters for post comment */
  maxCommentLength: 1000,
  /** Minimum characters for place/profile suggestions */
  minSearchQueryLength: 2,
} as const;

export const PaginationLimits = {
  /** Notifications list page size */
  notificationsPageSize: 50,
  /** Post feed page size */
  feedPageSize: 20,
  /** Profile search result limit */
  searchProfilesLimit: 20,
  /** Maximum recent places stored in user history */
  maxRecentPlaces: 8,
  /** Maximum number of places kept in memory cache */
  livePlacesCacheCapacity: 120,
  /** Batch size when hydrating missing place details */
  placeHydrationBatchSize: 10,
  /** Profile visits pagination page size */
  profileVisitsPageSize: 500,
  /** Cached place candidates limit for rankings */
  candidatePlacesLimit: 40,
  /** Daily swipe allowance for free users */
  dailySwipeLimit: 10,
  /** Default feed ad interval (every N posts) */
  defaultAdInterval: 5,
} as const;

export const ChartLimits = {
  /** Max radar chart dimension in pixels */
  maxRadarChartSize: 700,
  /** Food mode chart size multiplier */
  foodChartScaleFactor: 0.84,
  /** Chart container height multiplier */
  chartHeightMultiplier: 0.95,
  /** Chart container padding offset */
  chartHeightOffset: 8,
} as const;
