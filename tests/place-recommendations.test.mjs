import test from 'node:test';
import assert from 'node:assert/strict';

import {
  EARTH_RADIUS_METERS,
  normalizeLongitude,
  haversineDistanceMeters,
  computeOffsetLocation,
  computeCircleGeometry,
  isWithinRadius,
} from '../supabase/functions/place-recommendations/geometry.ts';

import {
  allocateTierPlaceTypes,
  calculateRecommendationScore,
  extractAmenities,
  isHotelOrLodging,
  sanitizeAttributions,
} from '../supabase/functions/place-recommendations/taxonomy.ts';

import {
  cachedPlace,
  cacheFetchedPlaces,
  filterTierPlaces,
  enrichPlaces,
  handleGetPlacePhotos,
  handleRecommendations,
} from '../supabase/functions/place-recommendations/handler.ts';

// ============================================================================
// Group 1: Geodesic Math & Circle Geometry
// ============================================================================

test('normalizeLongitude handles boundaries and wrapping', () => {
  assert.equal(normalizeLongitude(0), 0);
  assert.equal(normalizeLongitude(180), 180);
  assert.equal(normalizeLongitude(-180), -180);
  assert.equal(normalizeLongitude(185), -175);
  assert.equal(normalizeLongitude(-185), 175);
  assert.equal(normalizeLongitude(540), 180);
});

test('haversineDistanceMeters calculates exact and close distances', () => {
  const origin = { latitude: 1.3521, longitude: 103.8198 }; // Singapore
  assert.equal(haversineDistanceMeters(origin, origin), 0);

  const nearby = { latitude: 1.3522, longitude: 103.8198 };
  const d = haversineDistanceMeters(origin, nearby);
  assert.ok(d > 10 && d < 12); // ~11.1 meters

  const equator0 = { latitude: 0, longitude: 0 };
  const equator180 = { latitude: 0, longitude: 180 };
  const antipodal = haversineDistanceMeters(equator0, equator180);
  assert.ok(Math.abs(antipodal - Math.PI * EARTH_RADIUS_METERS) < 100);
});

test('computeOffsetLocation handles zero distance and directional bearings', () => {
  const origin = { latitude: 1.3, longitude: 103.8 };
  const same = computeOffsetLocation(origin, 0, 90);
  assert.equal(same.latitude, origin.latitude);
  assert.ok(Math.abs(same.longitude - origin.longitude) < 1e-6);

  const north = computeOffsetLocation(origin, 1000, 0);
  assert.ok(north.latitude > origin.latitude);
  assert.ok(Math.abs(north.longitude - origin.longitude) < 0.0001);

  const east = computeOffsetLocation(origin, 1000, 90);
  assert.ok(east.longitude > origin.longitude);
});

test('computeCircleGeometry generates central circle 0 and outer circles 1..6', () => {
  const origin = { latitude: 1.3, longitude: 103.8 };
  const radius = 10000;

  const c0 = computeCircleGeometry(origin, radius, 0);
  assert.equal(c0.index, 0);
  assert.equal(c0.center.latitude, origin.latitude);
  assert.ok(Math.abs(c0.center.longitude - origin.longitude) < 1e-6);
  assert.equal(c0.radiusMeters, Math.round(radius * 0.48));
  assert.equal(c0.offsetMeters, 0);

  const c1 = computeCircleGeometry(origin, radius, 1);
  assert.equal(c1.index, 1);
  assert.equal(c1.bearingDegrees, 0);
  assert.ok(c1.center.latitude > origin.latitude);

  const c2 = computeCircleGeometry(origin, radius, 2);
  assert.equal(c2.index, 2);
  assert.equal(c2.bearingDegrees, 60);

  const c6 = computeCircleGeometry(origin, radius, 6);
  assert.equal(c6.index, 6);
  assert.equal(c6.bearingDegrees, 300);
});

test('isWithinRadius respects boundary within epsilon', () => {
  const origin = { latitude: 1.3, longitude: 103.8 };
  assert.equal(isWithinRadius(origin, origin, 100), true);

  const point1000m = computeOffsetLocation(origin, 1000, 0);
  assert.equal(isWithinRadius(origin, point1000m, 1000), true);
  assert.equal(isWithinRadius(origin, point1000m, 990), false);
});

// ============================================================================
// Group 2: Taxonomy, Scoring, & Amenities Extraction
// ============================================================================

test('isHotelOrLodging correctly flags lodging places', () => {
  assert.equal(isHotelOrLodging({ primaryType: 'hotel' }), true);
  assert.equal(isHotelOrLodging({ primaryTypeDisplayName: { text: 'Boutique Hotel' } }), true);
  assert.equal(isHotelOrLodging({ types: ['resort_hotel'], displayName: { text: 'Beach Resort' } }), true);
  assert.equal(isHotelOrLodging({ primaryType: 'cafe', types: ['cafe', 'food'], displayName: { text: 'Coffee Spot' } }), false);
  assert.equal(isHotelOrLodging({}), false);
});

test('allocateTierPlaceTypes categorizes types by user weights', () => {
  const weights = new Map([
    ['east_southeast_asian', 0.95],
    ['cafes_bakeries_sweets', 0.9],
    ['quick_bites_fast_food', 0.1],
  ]);

  const foodTiers = allocateTierPlaceTypes('food', weights);
  assert.ok(foodTiers.highTypes.includes('ramen_restaurant') || foodTiers.highTypes.includes('cafe'));
  assert.ok(foodTiers.highTypes.length > 0);
  assert.ok(foodTiers.medTypes.length > 0);

  const activityTiers = allocateTierPlaceTypes('activities', new Map());
  assert.ok(activityTiers.highTypes.length > 0);
  assert.ok(activityTiers.medTypes.length > 0);
});

test('extractAmenities maps boolean features from Place', () => {
  const place = {
    dineIn: true,
    takeout: false,
    parkingOptions: {
      freeParkingLot: true,
      valetParking: false,
    },
    goodForChildren: true,
  };
  const amenities = extractAmenities(place);
  assert.equal(amenities.dineIn, true);
  assert.equal(amenities.takeout, false);
  assert.equal(amenities.freeParking, true);
  assert.equal(amenities.goodForChildren, true);
});

test('sanitizeAttributions maps photo attributions', () => {
  assert.equal(sanitizeAttributions(null), undefined);
  assert.equal(sanitizeAttributions(undefined), undefined);

  const raw = [
    { displayName: 'John Doe', uri: 'https://example.com' },
    { displayName: undefined, uri: null },
  ];
  const cleaned = sanitizeAttributions(raw);
  assert.equal(cleaned.length, 2);
  assert.equal(cleaned[0].displayName, 'John Doe');
  assert.equal(cleaned[0].uri, 'https://example.com');
  assert.equal(cleaned[1].displayName, null);
  assert.equal(cleaned[1].uri, null);
});

test('calculateRecommendationScore returns sensible score and match percentage', () => {
  const origin = { latitude: 1.3, longitude: 103.8 };
  const place = {
    id: 'place_1',
    displayName: { text: 'Ramen Master' },
    primaryType: 'ramen_restaurant',
    types: ['ramen_restaurant', 'japanese_restaurant', 'restaurant'],
    location: { latitude: 1.305, longitude: 103.805 },
    rating: 4.8,
    userRatingCount: 350,
    priceLevel: 'PRICE_LEVEL_MODERATE',
  };
  const weights = new Map([['east_southeast_asian', 0.9]]);
  const score = calculateRecommendationScore(place, origin, 5000, 'food', weights, 'high');

  assert.ok(score.normalizedScore >= 0 && score.normalizedScore <= 100);
  assert.ok(score.matchPercent >= 0 && score.matchPercent <= 100);
  assert.ok(score.matchedKeys.length > 0);
  assert.ok(typeof score.reason === 'string');
});

// ============================================================================
// Group 3: Place Caching & Deduplication
// ============================================================================

test('cachedPlace transforms Place into database schema row', () => {
  const now = new Date().toISOString();
  assert.equal(cachedPlace({}, now), null);

  const place = {
    id: 'place_abc',
    displayName: { text: 'Art Museum' },
    formattedAddress: '123 Art St',
    location: { latitude: 1.35, longitude: 103.82 },
    primaryTypeDisplayName: { text: 'Museum' },
    rating: 4.6,
    userRatingCount: 120,
    priceLevel: 'PRICE_LEVEL_FREE',
    googleMapsUri: 'https://maps.google.com/?cid=123',
    nationalPhoneNumber: '61234567',
    regularOpeningHours: { weekdayDescriptions: ['Mon: 9am - 5pm'] },
    photos: [{ name: 'places/photo_1', widthPx: 800, heightPx: 600, authorAttributions: [{ displayName: 'Alice' }] }],
  };

  const row = cachedPlace(place, now);
  assert.ok(row !== null);
  assert.equal(row.google_place_id, 'place_abc');
  assert.equal(row.display_name, 'Art Museum');
  assert.equal(row.phone_number, '61234567');
  assert.equal(row.photos[0].name, 'places/photo_1');
  assert.equal(row.photos[0].authorAttributions[0].displayName, 'Alice');
  assert.equal(row.last_fetched_at, now);
});

test('cacheFetchedPlaces upserts non-empty places without crashing on empty', async () => {
  let upsertCalled = false;
  let upsertCount = 0;
  const mockAdmin = {
    from: (table) => {
      assert.equal(table, 'places');
      return {
        upsert: async (rows) => {
          upsertCalled = true;
          upsertCount = rows.length;
          return { error: null };
        },
      };
    },
  };

  // Empty places does not upsert
  await cacheFetchedPlaces(mockAdmin, []);
  assert.equal(upsertCalled, false);

  // Valid places upsert
  await cacheFetchedPlaces(mockAdmin, [
    { id: 'p1', displayName: { text: 'Cafe 1' } },
    { id: 'p2', displayName: { text: 'Cafe 2' } },
  ]);
  assert.equal(upsertCalled, true);
  assert.equal(upsertCount, 2);
});

test('filterTierPlaces filters out hotels in food mode and eliminates duplicates/out-of-bounds', () => {
  const origin = { latitude: 1.3, longitude: 103.8 };
  const radius = 5000;
  const seen = new Set(['excluded_1']);

  const places = [
    { id: 'excluded_1', displayName: { text: 'Seen Place' }, location: { latitude: 1.301, longitude: 103.801 } },
    { id: 'hotel_1', displayName: { text: 'Grand Hotel' }, primaryType: 'hotel', location: { latitude: 1.301, longitude: 103.801 } },
    { id: 'far_away', displayName: { text: 'Far Cafe' }, location: { latitude: 2.5, longitude: 104.5 } },
    { id: 'invalid_coords', displayName: { text: 'No Coords' }, location: { latitude: NaN, longitude: 103.8 } },
    { id: 'valid_cafe', displayName: { text: 'Valid Cafe' }, primaryType: 'cafe', location: { latitude: 1.302, longitude: 103.802 } },
  ];

  const filtered = filterTierPlaces(places, 'food', origin, radius, seen);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, 'valid_cafe');
  assert.ok(seen.has('valid_cafe'));
});

// ============================================================================
// Group 4: Photo Handlers & Recommendation Execution
// ============================================================================

test('enrichPlaces formats output and calls photoFetcher', async () => {
  const origin = { latitude: 1.3, longitude: 103.8 };
  const places = [
    {
      id: 'place_1',
      displayName: { text: 'Top Bistro' },
      primaryTypeDisplayName: { text: 'Bistro' },
      primaryType: 'restaurant',
      types: ['restaurant'],
      location: { latitude: 1.302, longitude: 103.802 },
      photos: [{ name: 'places/photo_123', authorAttributions: [{ displayName: 'Photographer', uri: 'https://author.com' }] }],
    },
  ];

  let fetchedPhotoName = null;
  const fetchPhoto = async (name) => {
    fetchedPhotoName = name;
    return 'https://cdn.example.com/resolved-image.jpg';
  };

  const enriched = await enrichPlaces(places, 'high', origin, 5000, 'food', new Map(), 'fake-key', fetchPhoto);
  assert.equal(enriched.length, 1);
  assert.equal(fetchedPhotoName, 'places/photo_123');
  assert.equal(enriched[0].id, 'place_1');
  assert.equal(enriched[0].photoUrl, 'https://cdn.example.com/resolved-image.jpg');
  assert.equal(enriched[0].photoAttribution.displayName, 'Photographer');
  assert.equal(enriched[0].photoAttribution.uri, 'https://author.com');
});

test('handleGetPlacePhotos retrieves, enriches, and stores place photos', async () => {
  let updatedPlaceId = null;
  let updatedPhotos = null;

  const mockAdmin = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { photos: [{ name: 'places/photo_from_db' }] },
          }),
        }),
      }),
      update: (val) => ({
        eq: (_col, id) => {
          updatedPlaceId = id;
          updatedPhotos = val.photos;
          return { error: null };
        },
      }),
    }),
  };

  const fetchPhoto = async () => 'https://cdn.example.com/db-photo.jpg';

  const res = await handleGetPlacePhotos(
    { action: 'get-place-photos', placeId: 'place_1' },
    mockAdmin,
    'fake-key',
    fetchPhoto
  );

  assert.equal(res.photoUrl, 'https://cdn.example.com/db-photo.jpg');
  assert.equal(res.photos.length, 1);
  assert.equal(updatedPlaceId, 'place_1');
  assert.equal(updatedPhotos[0].url, 'https://cdn.example.com/db-photo.jpg');
});

test('handleRecommendations performs full recommendation pipeline', async () => {
  const origin = { latitude: 1.3, longitude: 103.8 };

  const createQueryMock = (data) => {
    const builder = {
      eq: () => builder,
      then: (resolve) => resolve({ data, error: null }),
    };
    return builder;
  };

  const mockClient = {
    from: (table) => ({
      select: () => {
        if (table === 'saved_places') return createQueryMock([{ google_place_id: 'already_saved' }]);
        if (table === 'passed_places') return createQueryMock([{ google_place_id: 'already_passed' }]);
        if (table.includes('weights')) return createQueryMock([{ category_key: 'east_southeast_asian', weight: 0.9 }]);
        return createQueryMock([]);
      },
    }),
  };

  const mockAdmin = {
    from: () => ({
      upsert: async () => ({ error: null }),
    }),
  };

  const mockSearchNearby = async (center, radius, types, tier) => {
    if (tier === 'HIGH') {
      return {
        ok: true,
        places: [
          {
            id: 'high_cafe',
            displayName: { text: 'High Priority Cafe' },
            primaryType: 'cafe',
            types: ['cafe', 'coffee_shop'],
            location: { latitude: center.latitude + 0.001, longitude: center.longitude + 0.001 },
          },
          {
            id: 'already_saved', // Must be filtered out
            displayName: { text: 'Saved Cafe' },
            location: { latitude: center.latitude, longitude: center.longitude },
          },
        ],
      };
    }
    return { ok: true, places: [] };
  };

  const payload = {
    mode: 'food',
    latitude: origin.latitude,
    longitude: origin.longitude,
    radiusMeters: 5000,
    circleIndex: 0,
    excludedPlaceIds: ['custom_excluded'],
  };

  const deps = {
    client: mockClient,
    admin: mockAdmin,
    googleKey: 'fake-key',
    searchNearby: mockSearchNearby,
    fetchPhoto: async () => null,
  };

  const response = await handleRecommendations('user_123', payload, deps);

  assert.equal(response.circleIndex, 0);
  assert.equal(response.exhausted, false);
  assert.equal(response.queues.high.length, 1);
  assert.equal(response.queues.high[0].id, 'high_cafe');
  assert.equal(response.queues.med.length, 0);
  assert.equal(response.queues.low.length, 0);
  assert.equal(response.recommendations.length, 1);
  assert.equal(response.debug.excludedCount, 3); // saved, passed, custom_excluded
});

test('handleRecommendations throws clean error if nearby search fails for all tiers', async () => {
  const createQueryMock = (data) => {
    const builder = {
      eq: () => builder,
      then: (resolve) => resolve({ data, error: null }),
    };
    return builder;
  };

  const mockClient = {
    from: () => ({
      select: () => createQueryMock([]),
    }),
  };

  const mockAdmin = { from: () => ({ upsert: async () => ({ error: null }) }) };

  const failingSearch = async () => ({ ok: false, places: [] });

  const payload = {
    mode: 'food',
    latitude: 1.3,
    longitude: 103.8,
  };

  const deps = {
    client: mockClient,
    admin: mockAdmin,
    googleKey: 'fake-key',
    searchNearby: failingSearch,
  };

  await assert.rejects(
    () => handleRecommendations('user_123', payload, deps),
    /Nearby places are temporarily unavailable\./
  );
});
