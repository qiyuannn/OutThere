/**
 * src/features/discover/geometry.ts
 *
 * 7-Circle Spatial Partitioning (Moderate Overlap: r = 0.48 R, d = 0.54 R)
 * and Spherical Earth Geodesic Distance Calculations.
 *
 * Pure TypeScript module: Zero external dependencies, zero React Native / DOM runtime calls.
 */

// ============================================================================
// Interfaces & Types
// ============================================================================

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface SearchCircle {
  index: number;
  center: Coordinates;
  radiusMeters: number;
  bearingDegrees?: number;
  offsetMeters?: number;
}

// ============================================================================
// Constants
// ============================================================================

/** Mean spherical Earth radius in meters (WGS 84 mean radius) */
export const EARTH_RADIUS_METERS = 6_371_000;

/** Moderate Overlap configuration constants */
export const MODERATE_OVERLAP_RADIUS_RATIO = 0.48; // r = 0.48 * R
export const CIRCLE_RADIUS_RATIO = MODERATE_OVERLAP_RADIUS_RATIO;

export const MODERATE_OVERLAP_OFFSET_RATIO = 0.54; // d = 0.54 * R
export const OUTER_CIRCLE_OFFSET_RATIO = MODERATE_OVERLAP_OFFSET_RATIO;

export const TOTAL_CIRCLES_COUNT = 7;             // 1 center + 6 outer
export const TOTAL_SEARCH_CIRCLES = TOTAL_CIRCLES_COUNT;
export const OUTER_CIRCLES_COUNT = 6;
export const BEARING_STEP_DEGREES = 60;            // (k - 1) * 60°

/** Valid search radius range constraints */
export const MIN_SEARCH_RADIUS_METERS = 1_000;    // 1 km
export const MAX_SEARCH_RADIUS_METERS = 50_000;   // 50 km
export const DEFAULT_SEARCH_RADIUS_METERS = 10_000; // 10 km

/** Numerical precision tolerance in meters for boundary checks (1 micrometer) */
export const EPSILON_METERS = 1e-6;

// ============================================================================
// Validation & Normalization Helpers
// ============================================================================

/**
 * Validates if coordinates are finite numbers within valid geographic bounds:
 * latitude in [-90, 90], longitude in [-180, 180].
 */
export function isValidCoordinates(coords: unknown): coords is Coordinates {
  if (!coords || typeof coords !== 'object') return false;
  const c = coords as Record<string, unknown>;
  return (
    typeof c.latitude === 'number' &&
    Number.isFinite(c.latitude) &&
    c.latitude >= -90 &&
    c.latitude <= 90 &&
    typeof c.longitude === 'number' &&
    Number.isFinite(c.longitude) &&
    c.longitude >= -180 &&
    c.longitude <= 180
  );
}

/**
 * Normalizes any longitude in degrees to the [-180, 180] interval.
 * Accurately wraps coordinates crossing the antimeridian (180th meridian).
 */
export function normalizeLongitude(lng: number): number {
  if (lng === 180 || lng === -180) return lng;
  const mod = (lng + 180) % 360;
  const wrapped = mod < 0 ? mod + 360 : mod;
  return wrapped === 0 ? 180 : wrapped - 180;
}

// ============================================================================
// Geodesic Mathematics
// ============================================================================

/**
 * Computes the spherical Haversine great-circle distance between two coordinates in meters.
 * Clamps intermediate values to [0, 1] to prevent NaN for antipodal coordinates.
 */
export function haversineDistanceMeters(a: Coordinates, b: Coordinates): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const lat1 = rad(a.latitude);
  const lat2 = rad(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  const clampedH = Math.min(1, Math.max(0, h));
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(clampedH));
}

/**
 * Computes destination coordinates along a great circle given an origin point,
 * distance in meters, and bearing in degrees clockwise from true north.
 * Clamps intermediate values to [-1, 1] and normalizes output longitude.
 */
export function computeOffsetLocation(
  origin: Coordinates,
  distanceMeters: number,
  bearingDegrees: number
): Coordinates {
  if (distanceMeters === 0) {
    return {
      latitude: origin.latitude,
      longitude: normalizeLongitude(origin.longitude),
    };
  }

  const rad = (deg: number) => (deg * Math.PI) / 180;
  const deg = (r: number) => (r * 180) / Math.PI;

  const delta = distanceMeters / EARTH_RADIUS_METERS;
  const theta = rad(bearingDegrees);
  const phi1 = rad(origin.latitude);
  const lambda1 = rad(origin.longitude);

  const sinPhi1 = Math.sin(phi1);
  const cosPhi1 = Math.cos(phi1);
  const sinDelta = Math.sin(delta);
  const cosDelta = Math.cos(delta);

  const sinPhi2 = sinPhi1 * cosDelta + cosPhi1 * sinDelta * Math.cos(theta);
  const clampedSinPhi2 = Math.min(1, Math.max(-1, sinPhi2));
  const phi2 = Math.asin(clampedSinPhi2);

  const y = Math.sin(theta) * sinDelta * cosPhi1;
  const x = cosDelta - sinPhi1 * Math.sin(phi2);
  const lambda2 = lambda1 + Math.atan2(y, x);

  return {
    latitude: deg(phi2),
    longitude: normalizeLongitude(deg(lambda2)),
  };
}

/** Alias for computeOffsetLocation to support alternate naming conventions */
export const computeDestinationPoint = computeOffsetLocation;

// ============================================================================
// 7-Circle Moderate Overlap Spatial Partitioning
// ============================================================================

/**
 * Computes the geometry for a single circle in the 7-circle Moderate Overlap pattern.
 * - Circle 0: Center at user location, radius 0.48 * R, bearing 0°, offset 0 m.
 * - Circles 1 to 6: Center at distance 0.54 * R along bearing (k - 1) * 60°, radius 0.48 * R.
 *
 * @throws {TypeError} if origin coordinates are invalid.
 * @throws {RangeError} if radiusMeters is not a positive finite number or circleIndex is out of [0, 6].
 */
export function computeCircleGeometry(
  origin: Coordinates,
  radiusMeters: number,
  circleIndex: number
): SearchCircle {
  if (!isValidCoordinates(origin)) {
    throw new TypeError(
      `Invalid origin coordinates: latitude must be in [-90, 90] and longitude in [-180, 180]. Received: ${JSON.stringify(origin)}`
    );
  }
  if (typeof radiusMeters !== 'number' || !Number.isFinite(radiusMeters) || radiusMeters <= 0) {
    throw new RangeError(
      `Invalid radiusMeters: must be a positive finite number. Received: ${radiusMeters}`
    );
  }
  if (
    typeof circleIndex !== 'number' ||
    !Number.isInteger(circleIndex) ||
    circleIndex < 0 ||
    circleIndex >= TOTAL_CIRCLES_COUNT
  ) {
    throw new RangeError(
      `Invalid circleIndex: must be an integer between 0 and ${TOTAL_CIRCLES_COUNT - 1}. Received: ${circleIndex}`
    );
  }

  const subRadiusMeters = radiusMeters * MODERATE_OVERLAP_RADIUS_RATIO;

  if (circleIndex === 0) {
    return {
      index: 0,
      center: {
        latitude: origin.latitude,
        longitude: normalizeLongitude(origin.longitude),
      },
      radiusMeters: subRadiusMeters,
      bearingDegrees: 0,
      offsetMeters: 0,
    };
  }

  const bearingDegrees = (circleIndex - 1) * BEARING_STEP_DEGREES;
  const offsetMeters = radiusMeters * MODERATE_OVERLAP_OFFSET_RATIO;
  const center = computeOffsetLocation(origin, offsetMeters, bearingDegrees);

  return {
    index: circleIndex,
    center,
    radiusMeters: subRadiusMeters,
    bearingDegrees,
    offsetMeters,
  };
}

/**
 * Computes geometries for all 7 circles in the Moderate Overlap pattern.
 * Always returns Circle 0 at index 0, followed by Circles 1 through 6.
 */
export function computeAllCircles(
  origin: Coordinates,
  radiusMeters: number
): SearchCircle[] {
  const circles: SearchCircle[] = [];
  for (let i = 0; i < TOTAL_CIRCLES_COUNT; i++) {
    circles.push(computeCircleGeometry(origin, radiusMeters, i));
  }
  return circles;
}

// ============================================================================
// Boundary Distance Enforcement
// ============================================================================

/**
 * Strictly enforces user search radius boundary R.
 * Returns true if the Haversine distance between origin and point is <= radiusMeters (within EPSILON).
 * Returns false if coordinates are invalid or point lies outside radiusMeters.
 */
export function isWithinRadius(
  origin: Coordinates,
  point: Coordinates,
  radiusMeters: number
): boolean {
  if (!isValidCoordinates(origin) || !isValidCoordinates(point)) {
    return false;
  }
  if (typeof radiusMeters !== 'number' || !Number.isFinite(radiusMeters) || radiusMeters < 0) {
    return false;
  }
  return haversineDistanceMeters(origin, point) <= radiusMeters + EPSILON_METERS;
}
