/**
 * supabase/functions/place-recommendations/handler.ts
 * Pure recommendation service handler with dependency injection.
 */

import type {
  CachedPlace,
  Coordinates,
  EnrichedPlace,
  Mode,
  Place,
  PlacePhoto,
  PlaceRecommendationsPayload,
  RecommendationResponse,
  RecommendationsDependencies,
  SupabaseClientLike,
} from './types.ts';
import { computeCircleGeometry, haversineDistanceMeters, EPSILON_METERS } from './geometry.ts';
import {
  allocateTierPlaceTypes,
  calculateRecommendationScore,
  extractAmenities,
  HOTEL_LODGING_TYPES,
  isHotelOrLodging,
  sanitizeAttributions,
} from './taxonomy.ts';

const FIELD_MASK =
  "places.id,places.displayName,places.formattedAddress,places.location,places.primaryType,places.primaryTypeDisplayName,places.types,places.rating,places.userRatingCount,places.priceLevel,places.currentOpeningHours.openNow,places.googleMapsUri,places.photos,places.websiteUri,places.nationalPhoneNumber,places.internationalPhoneNumber,places.regularOpeningHours.weekdayDescriptions,places.dineIn,places.takeout,places.delivery,places.reservable,places.outdoorSeating,places.servesBeer,places.servesWine,places.servesVegetarianFood,places.goodForChildren,places.goodForGroups,places.parkingOptions,places.restroom";

export async function fetchGooglePhotoUri(googleKey: string, photoName: string): Promise<string | null> {
  try {
    const res = await fetch(`https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=1200&skipHttpRedirect=true`, {
      headers: { "X-Goog-Api-Key": googleKey, "X-Goog-Maps-Solution-ID": "gmp_git_agentskills_v1" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { photoUri?: string };
    return data.photoUri ?? null;
  } catch {
    return null;
  }
}

export async function searchNearbyGoogle(
  apiKey: string, center: Coordinates, radius: number, includedTypes: string[],
  tierName = "unknown", excludedPrimaryTypes?: string[]
): Promise<{ ok: boolean; places: Place[] }> {
  if (includedTypes.length === 0) return { ok: true, places: [] };
  try {
    const requestBody: Record<string, unknown> = {
      includedTypes: includedTypes.slice(0, 50), maxResultCount: 20, rankPreference: "POPULARITY",
      locationRestriction: { circle: { center: { latitude: center.latitude, longitude: center.longitude }, radius } },
      ...(excludedPrimaryTypes?.length ? { excludedPrimaryTypes: excludedPrimaryTypes.slice(0, 50) } : {}),
    };
    const response = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": FIELD_MASK, "X-Goog-Maps-Solution-ID": "gmp_git_agentskills_v1" },
      body: JSON.stringify(requestBody),
    });
    if (!response.ok) return { ok: false, places: [] };
    const payload = (await response.json()) as { places?: Place[] };
    return { ok: true, places: payload.places ?? [] };
  } catch {
    return { ok: false, places: [] };
  }
}

export function cachedPlace(place: Place, fetchedAt: string): CachedPlace | null {
  if (!place.id) return null;
  const photos = (place.photos ?? []).slice(0, 10).map((item) => ({
    name: item.name ?? null, widthPx: item.widthPx ?? null, heightPx: item.heightPx ?? null,
    authorAttributions: (item.authorAttributions ?? []).map((a) => ({ displayName: a.displayName ?? null, uri: a.uri ?? null })),
  }));
  return {
    google_place_id: place.id, display_name: place.displayName?.text ?? null,
    formatted_address: place.formattedAddress ?? null, latitude: place.location?.latitude ?? null,
    longitude: place.location?.longitude ?? null, primary_type_display_name: place.primaryTypeDisplayName?.text ?? null,
    rating: place.rating ?? null, user_rating_count: place.userRatingCount ?? null,
    price_level: place.priceLevel ?? null, google_maps_uri: place.googleMapsUri ?? null,
    website_uri: place.websiteUri ?? null, phone_number: place.nationalPhoneNumber ?? place.internationalPhoneNumber ?? null,
    regular_opening_hours: place.regularOpeningHours?.weekdayDescriptions ?? [], amenities: extractAmenities(place),
    photos, last_fetched_at: fetchedAt,
  };
}

export async function cacheFetchedPlaces(admin: SupabaseClientLike, places: Iterable<Place>): Promise<void> {
  const fetchedAt = new Date().toISOString();
  const rows = [...places].map((p) => cachedPlace(p, fetchedAt)).filter((p): p is CachedPlace => p !== null);
  if (rows.length === 0) return;
  const { error } = await admin.from("places").upsert(rows, { onConflict: "google_place_id" });
  if (error) {
    console.error("Failed to cache places in database:", error);
  }
}

export function filterTierPlaces(
  places: Place[], mode: Mode, origin: Coordinates, radius: number, seenPlaceIds: Set<string>
): Place[] {
  const valid: Place[] = [];
  for (const place of places) {
    if (!place.id || !place.displayName?.text || typeof place.location?.latitude !== "number" ||
        !Number.isFinite(place.location.latitude) || typeof place.location?.longitude !== "number" ||
        !Number.isFinite(place.location.longitude)) continue;
    if (mode === "food" && isHotelOrLodging(place)) continue;
    const meters = haversineDistanceMeters(origin, { latitude: place.location.latitude, longitude: place.location.longitude });
    if (meters > radius + EPSILON_METERS || seenPlaceIds.has(place.id)) continue;
    seenPlaceIds.add(place.id);
    valid.push(place);
  }
  return valid;
}

export async function enrichPlaces(
  places: Place[], tier: "high" | "med" | "low", origin: Coordinates, radius: number,
  mode: Mode, weightsMap: Map<string, number>, googleKey: string,
  fetchPhoto?: (name: string) => Promise<string | null>
): Promise<EnrichedPlace[]> {
  const photoFetcher = fetchPhoto ?? ((name: string) => fetchGooglePhotoUri(googleKey, name));
  return Promise.all(
    places.map(async (place) => {
      const scoring = calculateRecommendationScore(place, origin, radius, mode, weightsMap, tier);
      const source = place.photos?.[0];
      let photoUrl: string | null = null;
      let photoAttribution = null;
      if (source?.name) {
        photoUrl = await photoFetcher(source.name);
        const by = source.authorAttributions?.[0];
        photoAttribution = by?.displayName ? { displayName: by.displayName, uri: by.uri ?? null } : null;
      }
      const photos = (place.photos ?? []).slice(0, 10).map((p, idx) => ({
        name: p.name ?? null, widthPx: p.widthPx ?? null, heightPx: p.heightPx ?? null,
        url: idx === 0 ? photoUrl : null,
        authorAttributions: (p.authorAttributions ?? []).map((a) => ({ displayName: a.displayName ?? null, uri: a.uri ?? null })),
      }));

      return {
        id: place.id!, name: place.displayName?.text ?? "Unknown Venue",
        category: place.primaryTypeDisplayName?.text ?? "Place", categoryKey: scoring.matchedKeys[0] ?? null,
        categoryKeys: scoring.matchedKeys, address: place.formattedAddress ?? null,
        distanceMeters: Math.round(scoring.meters), rating: place.rating ?? null,
        ratingCount: place.userRatingCount ?? null, priceLevel: place.priceLevel ?? null,
        openNow: place.currentOpeningHours?.openNow ?? null, mapsUrl: place.googleMapsUri ?? null,
        websiteUri: place.websiteUri ?? null, phoneNumber: place.nationalPhoneNumber ?? place.internationalPhoneNumber ?? null,
        regularOpeningHours: place.regularOpeningHours?.weekdayDescriptions ?? [], amenities: extractAmenities(place),
        reason: scoring.reason, score: scoring.normalizedScore, matchPercent: scoring.matchPercent,
        photos, photoUrl, photoAttribution,
      };
    })
  );
}

export async function handleGetPlacePhotos(
  payload: PlaceRecommendationsPayload, admin: SupabaseClientLike, googleKey: string,
  fetchPhoto?: (name: string) => Promise<string | null>
) {
  const photoFetcher = fetchPhoto ?? ((name: string) => fetchGooglePhotoUri(googleKey, name));
  let rawPhotos: PlacePhoto[] = [];
  if (typeof payload.placeId === "string") {
    const { data: placeRow } = await admin.from("places").select("photos").eq("google_place_id", payload.placeId).maybeSingle();
    if (placeRow?.photos) rawPhotos = (placeRow.photos as PlacePhoto[]).slice(0, 10);
  }
  if (rawPhotos.length === 0 && Array.isArray(payload.photos)) rawPhotos = payload.photos.slice(0, 10);
  for (const p of rawPhotos) {
    if (p.authorAttributions) p.authorAttributions = sanitizeAttributions(p.authorAttributions);
  }
  await Promise.all(rawPhotos.slice(0, 10).map(async (p) => {
    if (!p.url && p.name) {
      const photoUri = await photoFetcher(p.name);
      if (photoUri) p.url = photoUri;
    }
  }));
  if (typeof payload.placeId === "string") {
    await admin.from("places").update({ photos: rawPhotos }).eq("google_place_id", payload.placeId);
  }
  return { photos: rawPhotos, photoUrl: rawPhotos.find((p) => p.url)?.url ?? null };
}

export async function handleBackfillPhotos(
  admin: SupabaseClientLike, googleKey: string,
  fetchPhoto?: (name: string) => Promise<string | null>
) {
  const photoFetcher = fetchPhoto ?? ((name: string) => fetchGooglePhotoUri(googleKey, name));
  const { data: allPlaces } = await admin.from("places").select("google_place_id, photos");
  let count = 0;
  for (const row of allPlaces ?? []) {
    const placeId = row.google_place_id;
    const placePhotos = ((row.photos ?? []) as PlacePhoto[]).slice(0, 10);
    for (const p of placePhotos) {
      if (p.authorAttributions) p.authorAttributions = sanitizeAttributions(p.authorAttributions);
    }
    let rowUpdated = false;
    await Promise.all(placePhotos.map(async (p) => {
      if (!p.url && p.name) {
        const photoUri = await photoFetcher(p.name);
        if (photoUri) { p.url = photoUri; rowUpdated = true; }
      }
    }));
    await admin.from("places").update({ photos: placePhotos }).eq("google_place_id", placeId);
    if (rowUpdated) count += 1;
  }
  return { ok: true, updatedPlaces: count };
}

export async function handleRecommendations(
  userId: string, payload: PlaceRecommendationsPayload, deps: RecommendationsDependencies
): Promise<RecommendationResponse> {
  const { client, admin, googleKey } = deps;
  const mode = payload.mode!;
  const latitude = payload.latitude!;
  const longitude = payload.longitude!;
  const circleIndex = payload.circleIndex ?? 0;
  const radius = Math.min(50_000, Math.max(1_000, Math.round(payload.radiusMeters ?? 10_000)));
  const origin: Coordinates = { latitude, longitude };

  const weightsTable = mode === "food" ? "user_food_category_weights" : "user_activity_category_weights";
  const [{ data: savedPlaces, error: sErr }, { data: passedPlaces, error: pErr }, { data: categoryWeights }] =
    await Promise.all([
      client.from("saved_places").select("google_place_id").eq("user_id", userId),
      client.from("passed_places").select("google_place_id").eq("user_id", userId).eq("mode", mode),
      client.from(weightsTable).select("category_key, weight").eq("user_id", userId),
    ]);

  if (sErr || pErr) throw new Error("Could not load your recommendation history.");

  const excluded = new Set([
    ...(savedPlaces ?? []).map((r: { google_place_id: string }) => r.google_place_id),
    ...(passedPlaces ?? []).map((r: { google_place_id: string }) => r.google_place_id),
    ...(payload.excludedPlaceIds ?? []),
  ]);

  const weightsMap = new Map<string, number>();
  for (const row of (categoryWeights ?? []) as Array<{ category_key?: string | null; weight?: number | string | null }>) {
    const key = row?.category_key;
    if (typeof key === "string" && key.length > 0) {
      const raw = row.weight;
      const num = typeof raw === "number" ? raw : typeof raw === "string" ? parseFloat(raw) : NaN;
      weightsMap.set(key, Number.isFinite(num) ? Math.max(0.0, Math.min(1.0, num)) : 0.0);
    }
  }

  const activeCircle = computeCircleGeometry(origin, radius, circleIndex);
  const { highTypes, medTypes, lowTypes } = allocateTierPlaceTypes(mode, weightsMap);
  const excludedPrimaryTypes = mode === "food" ? HOTEL_LODGING_TYPES : undefined;

  const searchFn = deps.searchNearby ?? ((c, r, t, tier, ex) => searchNearbyGoogle(googleKey, c, r, t, tier, ex));
  const [highRes, medRes, lowRes] = await Promise.all([
    searchFn(activeCircle.center, activeCircle.radiusMeters, highTypes, "HIGH", excludedPrimaryTypes),
    searchFn(activeCircle.center, activeCircle.radiusMeters, medTypes, "MED", excludedPrimaryTypes),
    searchFn(activeCircle.center, activeCircle.radiusMeters, lowTypes, "LOW", excludedPrimaryTypes),
  ]);

  if (!highRes.ok && !medRes.ok && !lowRes.ok) {
    throw new Error("Nearby places are temporarily unavailable.");
  }

  const fetchedPlaces = new Map<string, Place>();
  for (const place of [...highRes.places, ...medRes.places, ...lowRes.places]) {
    if (place.id) fetchedPlaces.set(place.id, place);
  }
  await cacheFetchedPlaces(admin, fetchedPlaces.values());

  const seenPlaceIds = new Set<string>(excluded);
  const rawHigh = filterTierPlaces(highRes.places, mode, origin, radius, seenPlaceIds);
  const rawMed = filterTierPlaces(medRes.places, mode, origin, radius, seenPlaceIds);
  const rawLow = filterTierPlaces(lowRes.places, mode, origin, radius, seenPlaceIds);

  const [highQueue, medQueue, lowQueue] = await Promise.all([
    enrichPlaces(rawHigh, "high", origin, radius, mode, weightsMap, googleKey, deps.fetchPhoto),
    enrichPlaces(rawMed, "med", origin, radius, mode, weightsMap, googleKey, deps.fetchPhoto),
    enrichPlaces(rawLow, "low", origin, radius, mode, weightsMap, googleKey, deps.fetchPhoto),
  ]);

  const recommendations = [...highQueue, ...medQueue, ...lowQueue];
  return {
    queues: { high: highQueue, med: medQueue, low: lowQueue },
    recommendations, circleIndex,
    exhausted: recommendations.length === 0,
    passedCount: passedPlaces?.length ?? 0,
    debug: {
      rawCounts: { high: highRes.places.length, med: medRes.places.length, low: lowRes.places.length, total: highRes.places.length + medRes.places.length + lowRes.places.length },
      dedupedCounts: { high: rawHigh.length, med: rawMed.length, low: rawLow.length, total: rawHigh.length + rawMed.length + rawLow.length },
      excludedCount: excluded.size,
    },
  };
}
