import test from 'node:test';
import assert from 'node:assert/strict';

import {
  computeCircleGeometry,
  computeAllCircles,
  haversineDistanceMeters,
  computeOffsetLocation,
  isWithinRadius,
  normalizeLongitude,
  isValidCoordinates,
  EARTH_RADIUS_METERS,
  MODERATE_OVERLAP_RADIUS_RATIO,
  MODERATE_OVERLAP_OFFSET_RATIO,
  TOTAL_CIRCLES_COUNT,
  OUTER_CIRCLES_COUNT,
  BEARING_STEP_DEGREES,
} from '../src/features/discover/geometry.ts';

import {
  allocateTierGroups,
  sampleCalibratedQueue,
  shouldReplenish,
  pickNextCircle,
  isFeedExhausted,
  drawNextRecommendation,
  toQueueCounts,
  createEmptyQueueSet,
  getQueueTotal,
  enqueueItems,
  ACTIVITIES_TIER_COUNTS,
  FOOD_TIER_COUNTS,
} from '../src/features/discover/queues.ts';

// ============================================================================
// Group 1: Moderate Overlap 7-Circle Geometry (R1)
// ============================================================================

test('Circle 0 is centered at origin with radius 0.48 * R, offset 0, and bearing 0', () => {
  const origin = { latitude: 37.7749, longitude: -122.4194 };
  const R = 10000;
  const circle0 = computeCircleGeometry(origin, R, 0);

  assert.equal(circle0.index, 0);
  assert.equal(circle0.center.latitude, origin.latitude);
  assert.equal(circle0.center.longitude, origin.longitude);
  assert.equal(circle0.radiusMeters, R * MODERATE_OVERLAP_RADIUS_RATIO);
  assert.equal(circle0.radiusMeters, 4800);
  assert.equal(circle0.offsetMeters, 0);
  assert.equal(circle0.bearingDegrees, 0);
});

test('Outer circles 1 to 6 are at distance 0.54 * R with bearings (k - 1) * 60° and radius 0.48 * R', () => {
  const origin = { latitude: 37.7749, longitude: -122.4194 };
  const R = 10000;
  const expectedBearings = [0, 60, 120, 180, 240, 300];

  for (let k = 1; k <= OUTER_CIRCLES_COUNT; k++) {
    const circle = computeCircleGeometry(origin, R, k);
    assert.equal(circle.index, k);
    assert.equal(circle.radiusMeters, 4800);
    assert.equal(circle.offsetMeters, 5400);
    assert.equal(circle.bearingDegrees, expectedBearings[k - 1]);
    assert.equal(circle.bearingDegrees, (k - 1) * BEARING_STEP_DEGREES);

    // Geodesic distance verification within numerical tolerance (< 0.1 m)
    const distance = haversineDistanceMeters(origin, circle.center);
    assert.ok(Math.abs(distance - 5400) < 0.1, `Circle ${k} distance ${distance} expected ~5400`);
  }
});

test('computeAllCircles returns exactly 7 circles with indices 0 to 6 and hexagonal symmetry', () => {
  const origin = { latitude: 1.3521, longitude: 103.8198 }; // Singapore
  const R = 5000;
  const circles = computeAllCircles(origin, R);

  assert.equal(circles.length, TOTAL_CIRCLES_COUNT);

  // Check all indices and sub-radii
  for (let i = 0; i < 7; i++) {
    assert.equal(circles[i].index, i);
    assert.equal(circles[i].radiusMeters, 5000 * 0.48);
  }

  // Adjacent outer circles in the hexagonal ring are separated by distance d = 0.54 * R
  for (let k = 1; k <= 6; k++) {
    const next = k === 6 ? 1 : k + 1;
    const distBetween = haversineDistanceMeters(circles[k].center, circles[next].center);
    assert.ok(Math.abs(distBetween - 2700) < 0.1, `Adjacent circle distance error: ${distBetween}`);
  }
});

test('Antimeridian longitude wrapping and coordinate normalization', () => {
  assert.equal(normalizeLongitude(0), 0);
  assert.equal(normalizeLongitude(180), 180);
  assert.equal(normalizeLongitude(-180), -180);
  assert.equal(normalizeLongitude(190), -170);
  assert.equal(normalizeLongitude(-190), 170);
  assert.equal(normalizeLongitude(360), 0);
  assert.equal(normalizeLongitude(540), 180);

  // Shifting East from 179.99° longitude wraps across the 180th meridian into negative longitude
  const fiji = { latitude: -18.0, longitude: 179.99 };
  const east = computeOffsetLocation(fiji, 5400, 90);
  assert.ok(east.longitude < 0, `Expected wrapped negative longitude, got ${east.longitude}`);
  assert.ok(Math.abs(haversineDistanceMeters(fiji, east) - 5400) < 0.1);

  // Shifting West from -179.99° wraps across the 180th meridian into positive longitude
  const west = computeOffsetLocation({ latitude: -18.0, longitude: -179.99 }, 5400, 270);
  assert.ok(west.longitude > 0, `Expected wrapped positive longitude, got ${west.longitude}`);

  // Shortest distance across antimeridian is small, not full Earth circumference
  const p1 = { latitude: 0, longitude: 179.999 };
  const p2 = { latitude: 0, longitude: -179.999 };
  assert.ok(haversineDistanceMeters(p1, p2) < 250);
});

test('Strict search boundary enforcement drops places with distance > R', () => {
  const origin = { latitude: 37.7749, longitude: -122.4194 };
  const R = 10000;

  // Origin point is inside
  assert.equal(isWithinRadius(origin, origin, R), true);

  // Exact boundary point at R meters
  const boundaryPoint = computeOffsetLocation(origin, R, 45);
  assert.equal(isWithinRadius(origin, boundaryPoint, R), true);

  // Point inside at 9,999 m
  const insidePoint = computeOffsetLocation(origin, R - 1, 90);
  assert.equal(isWithinRadius(origin, insidePoint, R), true);

  // Point outside boundary at R + 1 m
  const outsidePoint = computeOffsetLocation(origin, R + 1, 45);
  assert.equal(isWithinRadius(origin, outsidePoint, R), false);

  // Far outside point
  const farPoint = computeOffsetLocation(origin, 15000, 180);
  assert.equal(isWithinRadius(origin, farPoint, R), false);

  // Invalid inputs return false
  assert.equal(isWithinRadius(origin, { latitude: 999, longitude: 0 }, R), false);
  assert.equal(isWithinRadius(origin, boundaryPoint, -50), false);
});

test('Geometry input validation enforces coordinate and radius bounds', () => {
  const origin = { latitude: 37.7749, longitude: -122.4194 };

  assert.throws(() => computeCircleGeometry(origin, 10000, -1), RangeError);
  assert.throws(() => computeCircleGeometry(origin, 10000, 7), RangeError);
  assert.throws(() => computeCircleGeometry(origin, 10000, 1.5), RangeError);
  assert.throws(() => computeCircleGeometry(origin, -500, 0), RangeError);
  assert.throws(() => computeCircleGeometry(origin, 0, 0), RangeError);
  assert.throws(() => computeCircleGeometry({ latitude: 95, longitude: 0 }, 10000, 0), TypeError);
  assert.throws(() => computeCircleGeometry(null, 10000, 0), TypeError);

  assert.equal(isValidCoordinates({ latitude: 0, longitude: 0 }), true);
  assert.equal(isValidCoordinates({ latitude: -90, longitude: 180 }), true);
  assert.equal(isValidCoordinates({ latitude: -91, longitude: 0 }), false);
  assert.equal(isValidCoordinates({ latitude: 0, longitude: 181 }), false);
  assert.equal(isValidCoordinates(null), false);
  assert.equal(isValidCoordinates('not-coords'), false);
});

// ============================================================================
// Group 2: Dynamic 3-Tier Queue Allocation & Tie-Breaking (R2)
// ============================================================================

test('allocateTierGroups: Activities partitions into exactly 1 High, 2 Med, 3 Low', () => {
  const groups = [
    { key: 'nature' }, { key: 'museums' }, { key: 'games' },
    { key: 'music' }, { key: 'sports' }, { key: 'nightlife' },
  ];
  const weights = {
    nature: 0.95,
    museums: 0.80,
    games: 0.60,
    music: 0.40,
    sports: 0.20,
    nightlife: 0.10,
  };

  const allocated = allocateTierGroups('activities', groups, weights);

  assert.equal(allocated.high.length, ACTIVITIES_TIER_COUNTS.high);
  assert.equal(allocated.med.length, ACTIVITIES_TIER_COUNTS.med);
  assert.equal(allocated.low.length, ACTIVITIES_TIER_COUNTS.low);

  assert.equal(allocated.high[0].key, 'nature');
  assert.deepEqual(allocated.med.map((g) => g.key), ['museums', 'games']);
  assert.deepEqual(allocated.low.map((g) => g.key), ['music', 'sports', 'nightlife']);
});

test('allocateTierGroups: Food partitions into exactly 2 High, 3 Med, 5 Low', () => {
  const groups = Array.from({ length: 10 }, (_, i) => ({ key: `food_${i}` }));
  const weights = {
    food_0: 0.9, food_1: 0.8, food_2: 0.7, food_3: 0.6, food_4: 0.5,
    food_5: 0.4, food_6: 0.3, food_7: 0.2, food_8: 0.1, food_9: 0.05,
  };

  const allocated = allocateTierGroups('food', groups, weights);

  assert.equal(allocated.high.length, FOOD_TIER_COUNTS.high);
  assert.equal(allocated.med.length, FOOD_TIER_COUNTS.med);
  assert.equal(allocated.low.length, FOOD_TIER_COUNTS.low);

  assert.deepEqual(allocated.high.map((g) => g.key), ['food_0', 'food_1']);
  assert.deepEqual(allocated.med.map((g) => g.key), ['food_2', 'food_3', 'food_4']);
  assert.deepEqual(allocated.low.map((g) => g.key), ['food_5', 'food_6', 'food_7', 'food_8', 'food_9']);
});

test('allocateTierGroups: defaults unset/null/NaN weights to 0.00', () => {
  const groups = [
    { key: 'g0' }, { key: 'g1' }, { key: 'g2' },
    { key: 'g3' }, { key: 'g4' }, { key: 'g5' },
  ];
  const weights = { g2: 0.85 }; // Only g2 set; all others unset

  const allocated = allocateTierGroups('activities', groups, weights);

  assert.equal(allocated.high.length, 1);
  assert.equal(allocated.high[0].key, 'g2');

  const remaining = [...allocated.med, ...allocated.low].map((g) => g.key);
  assert.equal(remaining.length, 5);
  assert.ok(!remaining.includes('g2'));
});

test('allocateTierGroups: randomized tie-breaking yields uniform distribution', () => {
  const groups = [
    { key: 'a' }, { key: 'b' }, { key: 'c' },
    { key: 'd' }, { key: 'e' }, { key: 'f' },
  ];
  const weights = {}; // All 0.00
  const highCounts = { a: 0, b: 0, c: 0, d: 0, e: 0, f: 0 };
  const N = 12000;

  for (let i = 0; i < N; i++) {
    const res = allocateTierGroups('activities', groups, weights);
    highCounts[res.high[0].key]++;
  }

  // Expected frequency: 1/6 ≈ 0.1667 (2000 counts out of 12,000)
  for (const k of Object.keys(highCounts)) {
    const freq = highCounts[k] / N;
    assert.ok(
      Math.abs(freq - 1 / 6) < 0.02,
      `Key ${k} frequency ${freq} expected close to ${1 / 6}`
    );
  }
});

// ============================================================================
// Group 3: Calibrated 3:2:1 Sampling & Proportional Dynamic Fallback (R4)
// ============================================================================

test('sampleCalibratedQueue: adheres to 3:2:1 calibrated ratio (50/33.3/16.7)', () => {
  const queues = { high: 10, med: 10, low: 10 };

  // Deterministic checks
  assert.equal(sampleCalibratedQueue(queues, 0.0), 'high');
  assert.equal(sampleCalibratedQueue(queues, 0.499), 'high');
  assert.equal(sampleCalibratedQueue(queues, 0.500), 'med');
  assert.equal(sampleCalibratedQueue(queues, 0.833), 'med');
  assert.equal(sampleCalibratedQueue(queues, 0.834), 'low');
  assert.equal(sampleCalibratedQueue(queues, 0.999), 'low');
  assert.equal(sampleCalibratedQueue(queues, 1.0), 'low');

  // Statistical distribution over 10,000 draws
  const counts = { high: 0, med: 0, low: 0 };
  for (let i = 0; i < 10000; i++) {
    const tier = sampleCalibratedQueue(queues);
    counts[tier]++;
  }

  // High ≈ 50% (5000 ± 250), Med ≈ 33.3% (3333 ± 250), Low ≈ 16.7% (1667 ± 200)
  assert.ok(counts.high >= 4750 && counts.high <= 5250, `High: ${counts.high}`);
  assert.ok(counts.med >= 3083 && counts.med <= 3583, `Med: ${counts.med}`);
  assert.ok(counts.low >= 1467 && counts.low <= 1867, `Low: ${counts.low}`);
});

test('sampleCalibratedQueue: proportional fallback across all tier combinations', () => {
  // High + Med (3:2 -> 60% / 40%)
  const hm = { high: 5, med: 5, low: 0 };
  assert.equal(sampleCalibratedQueue(hm, 0.0), 'high');
  assert.equal(sampleCalibratedQueue(hm, 0.59), 'high');
  assert.equal(sampleCalibratedQueue(hm, 0.60), 'med');
  assert.equal(sampleCalibratedQueue(hm, 0.99), 'med');

  // High + Low (3:1 -> 75% / 25%)
  const hl = { high: 5, med: 0, low: 5 };
  assert.equal(sampleCalibratedQueue(hl, 0.0), 'high');
  assert.equal(sampleCalibratedQueue(hl, 0.74), 'high');
  assert.equal(sampleCalibratedQueue(hl, 0.75), 'low');
  assert.equal(sampleCalibratedQueue(hl, 0.99), 'low');

  // Med + Low (2:1 -> 66.7% / 33.3%)
  const ml = { high: 0, med: 5, low: 5 };
  assert.equal(sampleCalibratedQueue(ml, 0.0), 'med');
  assert.equal(sampleCalibratedQueue(ml, 0.66), 'med');
  assert.equal(sampleCalibratedQueue(ml, 0.67), 'low');
  assert.equal(sampleCalibratedQueue(ml, 0.99), 'low');

  // Single active tiers -> 100%
  assert.equal(sampleCalibratedQueue({ high: 5, med: 0, low: 0 }, 0.99), 'high');
  assert.equal(sampleCalibratedQueue({ high: 0, med: 5, low: 0 }, 0.99), 'med');
  assert.equal(sampleCalibratedQueue({ high: 0, med: 0, low: 5 }, 0.99), 'low');

  // All empty -> null
  assert.equal(sampleCalibratedQueue({ high: 0, med: 0, low: 0 }), null);
  assert.equal(sampleCalibratedQueue(null), null);
});

// ============================================================================
// Group 4: Straggler Replenishment, Progression, & Exhaustion (R4, R5)
// ============================================================================

test('shouldReplenish: triggers on high === 0 OR total <= 2', () => {
  // High empty -> true
  assert.equal(shouldReplenish({ high: 0, med: 10, low: 10 }), true);
  assert.equal(shouldReplenish({ high: 0, med: 5, low: 0 }), true);

  // Total <= 2 -> true
  assert.equal(shouldReplenish({ high: 1, med: 1, low: 0 }), true);
  assert.equal(shouldReplenish({ high: 2, med: 0, low: 0 }), true);
  assert.equal(shouldReplenish({ high: 1, med: 0, low: 0 }), true);
  assert.equal(shouldReplenish({ high: 0, med: 0, low: 0 }), true);

  // High > 0 AND total >= 3 -> false
  assert.equal(shouldReplenish({ high: 1, med: 1, low: 1 }), false);
  assert.equal(shouldReplenish({ high: 2, med: 1, low: 0 }), false);
  assert.equal(shouldReplenish({ high: 3, med: 0, low: 0 }), false);
  assert.equal(shouldReplenish({ high: 5, med: 5, low: 5 }), false);
});

test('pickNextCircle: prioritizes Circle 0 then selects outer circles without replacement', () => {
  // Starting state includes Circle 0
  let unvisited = [0, 1, 2, 3, 4, 5, 6];
  const first = pickNextCircle(unvisited);
  assert.equal(first.nextCircle, 0);
  assert.deepEqual(first.remaining, [1, 2, 3, 4, 5, 6]);

  // Draining outer circles
  unvisited = first.remaining;
  const picked = [];
  while (unvisited.length > 0) {
    const res = pickNextCircle(unvisited);
    assert.ok(res);
    assert.ok(unvisited.includes(res.nextCircle));
    assert.equal(res.remaining.length, unvisited.length - 1);
    assert.ok(!res.remaining.includes(res.nextCircle));
    picked.push(res.nextCircle);
    unvisited = res.remaining;
  }

  assert.equal(picked.length, 6);
  assert.equal(new Set(picked).size, 6);
  assert.equal(pickNextCircle([]), null);
});

test('isFeedExhausted: true iff 7 circles visited, all queues empty, and activeCard is null', () => {
  const empty = { high: 0, med: 0, low: 0 };
  const populated = { high: 1, med: 0, low: 0 };
  const card = { id: 'place_1' };

  // All 3 conditions met
  assert.equal(isFeedExhausted(7, empty, null), true);
  assert.equal(isFeedExhausted(7, empty, undefined), true);
  assert.equal(isFeedExhausted(8, empty, null), true);

  // Active card still on screen -> false
  assert.equal(isFeedExhausted(7, empty, card), false);

  // Queues not empty -> false
  assert.equal(isFeedExhausted(7, populated, null), false);

  // Less than 7 circles visited -> false
  assert.equal(isFeedExhausted(6, empty, null), false);
  assert.equal(isFeedExhausted(0, empty, null), false);
});

// ============================================================================
// Group 5: Client-Side Instant Skip & Resample (R4)
// ============================================================================

test('drawNextRecommendation: skips excluded places instantly and resamples without loss', () => {
  const savedIds = new Set(['saved_1', 'saved_2']);
  const passedIds = new Set(['passed_1']);
  const isExcluded = (item) => savedIds.has(item.id) || passedIds.has(item.id);

  const queues = {
    high: [{ id: 'saved_1' }, { id: 'saved_2' }, { id: 'place_high' }],
    med: [{ id: 'passed_1' }, { id: 'place_med' }],
    low: [{ id: 'place_low' }],
  };

  const draw1 = drawNextRecommendation(queues, isExcluded);
  assert.ok(draw1.item);
  assert.ok(!savedIds.has(draw1.item.id));
  assert.ok(!passedIds.has(draw1.item.id));

  // Drain remaining eligible recommendations
  const drawn = [draw1.item.id];
  while (getQueueTotal(queues) > 0) {
    const next = drawNextRecommendation(queues, isExcluded);
    if (next.item) drawn.push(next.item.id);
  }

  assert.equal(drawn.length, 3);
  assert.ok(drawn.includes('place_high'));
  assert.ok(drawn.includes('place_med'));
  assert.ok(drawn.includes('place_low'));
  assert.equal(getQueueTotal(queues), 0);

  // Empty draw returns null item
  const emptyDraw = drawNextRecommendation(queues, isExcluded);
  assert.equal(emptyDraw.item, null);
  assert.equal(emptyDraw.sampledTier, null);
});

// ============================================================================
// Group 6: Queue Helpers & Enqueue (R3, R4)
// ============================================================================

test('Queue helpers: toQueueCounts, getQueueTotal, enqueueItems, createEmptyQueueSet', () => {
  const empty = createEmptyQueueSet();
  assert.deepEqual(empty, { high: [], med: [], low: [] });
  assert.equal(getQueueTotal(empty), 0);

  const counts = toQueueCounts({ high: 3, med: 2.7, low: -1 });
  assert.deepEqual(counts, { high: 3, med: 2, low: 0 });

  const enqueued = enqueueItems(
    { high: ['a'], med: ['b'], low: [] },
    { high: ['c'], low: ['d'] }
  );
  assert.deepEqual(enqueued, { high: ['a', 'c'], med: ['b'], low: ['d'] });
  assert.equal(getQueueTotal(enqueued), 4);
});
