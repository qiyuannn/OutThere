/**
 * supabase/functions/place-recommendations/geometry.ts
 * Pure geodesic mathematics and spatial calculations for place recommendations.
 */

import type { Coordinates, SearchCircle } from './types.ts';

export const EARTH_RADIUS_METERS = 6_371_000;
export const MODERATE_OVERLAP_RADIUS_RATIO = 0.48; // r = 0.48 * R
export const MODERATE_OVERLAP_OFFSET_RATIO = 0.54; // d = 0.54 * R
export const BEARING_STEP_DEGREES = 60;
export const EPSILON_METERS = 1e-6;

export function normalizeLongitude(lng: number): number {
  if (lng === 180 || lng === -180) return lng;
  const mod = (lng + 180) % 360;
  const wrapped = mod < 0 ? mod + 360 : mod;
  return wrapped === 0 ? 180 : wrapped - 180;
}

export function haversineDistanceMeters(a: Coordinates, b: Coordinates): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const lat1 = rad(a.latitude);
  const lat2 = rad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const clampedH = Math.min(1, Math.max(0, h));
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(clampedH));
}

export function computeOffsetLocation(
  origin: Coordinates,
  distanceMeters: number,
  bearingDegrees: number
): Coordinates {
  if (distanceMeters === 0) {
    return { latitude: origin.latitude, longitude: normalizeLongitude(origin.longitude) };
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
  return { latitude: deg(phi2), longitude: normalizeLongitude(deg(lambda2)) };
}

export function computeCircleGeometry(
  origin: Coordinates,
  radiusMeters: number,
  circleIndex: number
): SearchCircle {
  const subRadiusMeters = Math.round(radiusMeters * MODERATE_OVERLAP_RADIUS_RATIO);
  if (circleIndex === 0) {
    return {
      index: 0,
      center: { latitude: origin.latitude, longitude: normalizeLongitude(origin.longitude) },
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

export function isWithinRadius(origin: Coordinates, point: Coordinates, radiusMeters: number): boolean {
  return haversineDistanceMeters(origin, point) <= radiusMeters + EPSILON_METERS;
}
