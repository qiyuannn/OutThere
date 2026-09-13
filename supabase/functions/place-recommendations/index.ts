// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders } from "jsr:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";

type Mode = "activities" | "food";
type PhotoAttribution = { displayName?: string; uri?: string };
type PlacePhoto = {
  name?: string;
  widthPx?: number;
  heightPx?: number;
  authorAttributions?: PhotoAttribution[];
};

type Place = {
  id?: string; displayName?: { text?: string }; formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  primaryTypeDisplayName?: { text?: string }; rating?: number;
  userRatingCount?: number; priceLevel?: string; currentOpeningHours?: { openNow?: boolean };
  googleMapsUri?: string;
  photos?: PlacePhoto[];
  websiteUri?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  dineIn?: boolean;
  takeout?: boolean;
  delivery?: boolean;
  reservable?: boolean;
  outdoorSeating?: boolean;
  servesBeer?: boolean;
  servesWine?: boolean;
  servesVegetarianFood?: boolean;
  goodForChildren?: boolean;
  goodForGroups?: boolean;
  parkingOptions?: { freeParkingLot?: boolean; paidParkingLot?: boolean; freeStreetParking?: boolean; paidStreetParking?: boolean; valetParking?: boolean };
  restroom?: boolean;
};

type CachedPlace = {
  google_place_id: string;
  display_name: string | null;
  formatted_address: string | null;
  latitude: number | null;
  longitude: number | null;
  primary_type_display_name: string | null;
  rating: number | null;
  user_rating_count: number | null;
  price_level: string | null;
  google_maps_uri: string | null;
  website_uri: string | null;
  phone_number: string | null;
  regular_opening_hours: string[];
  amenities: Record<string, boolean>;
  photos: PlacePhoto[];
  last_fetched_at: string;
};

const groups: Record<Mode, Record<string, string[]>> = {
  activities: {
    nature: ["park", "national_park", "botanical_garden", "hiking_area", "zoo"],
    culture: ["museum", "art_gallery", "historical_place", "cultural_landmark", "performing_arts_theater"],
    active: ["gym", "sports_complex", "swimming_pool", "stadium", "bowling_alley"],
    entertainment: ["amusement_park", "aquarium", "movie_theater", "tourist_attraction"],
    relaxation: ["spa", "park", "botanical_garden"], learning: ["library", "museum", "aquarium", "zoo"],
  },
  food: {
    cafes: ["cafe", "coffee_shop", "bakery"], local: ["restaurant", "food_court"],
    japanese: ["japanese_restaurant", "ramen_restaurant", "sushi_restaurant"], chinese: ["chinese_restaurant"],
    indian: ["indian_restaurant"], western: ["american_restaurant", "french_restaurant", "italian_restaurant"],
    desserts: ["dessert_shop", "ice_cream_shop", "bakery"],
  },
};
const defaults: Record<Mode, string[]> = {
  activities: ["park", "museum", "art_gallery", "tourist_attraction", "aquarium", "bowling_alley", "movie_theater", "zoo", "spa", "gym"],
  food: ["restaurant", "cafe", "coffee_shop", "bakery", "food_court", "dessert_shop"],
};
const headers = { ...corsHeaders, "Content-Type": "application/json" };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
const number = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : null;
const fieldMask = "places.id,places.displayName,places.formattedAddress,places.location,places.primaryTypeDisplayName,places.rating,places.userRatingCount,places.priceLevel,places.currentOpeningHours.openNow,places.googleMapsUri,places.photos,places.websiteUri,places.nationalPhoneNumber,places.internationalPhoneNumber,places.regularOpeningHours.weekdayDescriptions,places.dineIn,places.takeout,places.delivery,places.reservable,places.outdoorSeating,places.servesBeer,places.servesWine,places.servesVegetarianFood,places.goodForChildren,places.goodForGroups,places.parkingOptions,places.restroom";
const strings = (value: unknown, max: number) => Array.isArray(value)
  ? [...new Set(value.filter((item): item is string => typeof item === "string").map((item) => item.trim().toLowerCase()).filter(Boolean))].slice(0, max) : [];

type SearchCenter = { latitude: number; longitude: number };
type SearchPlan = { center: SearchCenter; radius: number; includedTypes: string[] };

function shuffle<T>(values: T[]) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function distance(fromLat: number, fromLng: number, toLat: number, toLng: number) {
  const rad = (degrees: number) => degrees * Math.PI / 180;
  const lat = rad(toLat - fromLat); const lng = rad(toLng - fromLng);
  const a = Math.sin(lat / 2) ** 2 + Math.cos(rad(fromLat)) * Math.cos(rad(toLat)) * Math.sin(lng / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function offsetLocation(origin: SearchCenter, meters: number, bearingDegrees: number): SearchCenter {
  const angularDistance = meters / 6_371_000;
  const bearing = bearingDegrees * Math.PI / 180;
  const latitude = origin.latitude * Math.PI / 180;
  const longitude = origin.longitude * Math.PI / 180;
  const shiftedLatitude = Math.asin(Math.sin(latitude) * Math.cos(angularDistance)
    + Math.cos(latitude) * Math.sin(angularDistance) * Math.cos(bearing));
  const shiftedLongitude = longitude + Math.atan2(
    Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latitude),
    Math.cos(angularDistance) - Math.sin(latitude) * Math.sin(shiftedLatitude),
  );
  return { latitude: shiftedLatitude * 180 / Math.PI, longitude: shiftedLongitude * 180 / Math.PI };
}

function buildSearchPlan(mode: Mode, origin: SearchCenter, radius: number): SearchPlan[] {
  const rotation = Math.random() * 90;
  const anchorDistance = radius * 0.55;
  const anchorRadius = Math.min(50_000, Math.max(1_000, Math.round(radius * 0.65)));
  const anchors = shuffle([0, 90, 180, 270].map((bearing) => offsetLocation(origin, anchorDistance, bearing + rotation)));
  const categoryGroups = shuffle(Object.values(groups[mode]).map((types) => [...new Set(types)]));
  return [
    { center: origin, radius, includedTypes: defaults[mode] },
    ...categoryGroups.map((includedTypes, index) => ({ center: anchors[index % anchors.length], radius: anchorRadius, includedTypes })),
    ...anchors.map((center) => ({ center, radius: anchorRadius, includedTypes: defaults[mode] })),
  ];
}

async function searchNearby(apiKey: string, plan: SearchPlan) {
  try {
    const response = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": fieldMask },
      body: JSON.stringify({
        includedTypes: plan.includedTypes,
        maxResultCount: 20,
        rankPreference: "DISTANCE",
        locationRestriction: { circle: { center: plan.center, radius: plan.radius } },
      }),
    });
    if (!response.ok) {
      console.error("Google Places distance request failed", response.status, await response.text());
      return { ok: false, places: [] as Place[] };
    }
    const payload = await response.json() as { places?: Place[] };
    return { ok: true, places: payload.places ?? [] };
  } catch (error) {
    console.error("Google Places distance request failed", error);
    return { ok: false, places: [] as Place[] };
  }
}

async function photo(apiKey: string, place: Place) {
  const source = place.photos?.[0];
  if (!source?.name) return { photoUrl: null, photoAttribution: null };
  try {
    const response = await fetch(`https://places.googleapis.com/v1/${source.name}/media?maxWidthPx=1200&skipHttpRedirect=true`, { headers: { "X-Goog-Api-Key": apiKey } });
    if (!response.ok) return { photoUrl: null, photoAttribution: null };
    const data = await response.json() as { photoUri?: string }; const by = source.authorAttributions?.[0];
    return { photoUrl: data.photoUri ?? null, photoAttribution: by?.displayName ? { displayName: by.displayName, uri: by.uri ?? null } : null };
  } catch { return { photoUrl: null, photoAttribution: null }; }
}

function extractAmenities(place: Place): Record<string, boolean> {
  const amenities: Record<string, boolean> = {};
  if (typeof place.dineIn === "boolean") amenities.dineIn = place.dineIn;
  if (typeof place.takeout === "boolean") amenities.takeout = place.takeout;
  if (typeof place.delivery === "boolean") amenities.delivery = place.delivery;
  if (typeof place.reservable === "boolean") amenities.reservable = place.reservable;
  if (typeof place.outdoorSeating === "boolean") amenities.outdoorSeating = place.outdoorSeating;
  if (typeof place.servesBeer === "boolean") amenities.servesBeer = place.servesBeer;
  if (typeof place.servesWine === "boolean") amenities.servesWine = place.servesWine;
  if (typeof place.servesVegetarianFood === "boolean") amenities.servesVegetarianFood = place.servesVegetarianFood;
  if (typeof place.goodForChildren === "boolean") amenities.goodForChildren = place.goodForChildren;
  if (typeof place.goodForGroups === "boolean") amenities.goodForGroups = place.goodForGroups;
  if (typeof place.restroom === "boolean") amenities.restroom = place.restroom;
  if (place.parkingOptions?.freeParkingLot || place.parkingOptions?.freeStreetParking) amenities.freeParking = true;
  return amenities;
}

function cachedPlace(place: Place, fetchedAt: string): CachedPlace | null {
  if (!place.id) return null;
  const photos = (place.photos ?? []).slice(0, 10).map((item) => ({
    name: item.name ?? null,
    widthPx: item.widthPx ?? null,
    heightPx: item.heightPx ?? null,
    authorAttributions: (item.authorAttributions ?? []).map((a) => ({
      displayName: a.displayName ?? null,
      uri: a.uri ?? null,
    })),
  }));
  return {
    google_place_id: place.id,
    display_name: place.displayName?.text ?? null,
    formatted_address: place.formattedAddress ?? null,
    latitude: place.location?.latitude ?? null,
    longitude: place.location?.longitude ?? null,
    primary_type_display_name: place.primaryTypeDisplayName?.text ?? null,
    rating: place.rating ?? null,
    user_rating_count: place.userRatingCount ?? null,
    price_level: place.priceLevel ?? null,
    google_maps_uri: place.googleMapsUri ?? null,
    website_uri: place.websiteUri ?? null,
    phone_number: place.nationalPhoneNumber ?? place.internationalPhoneNumber ?? null,
    regular_opening_hours: place.regularOpeningHours?.weekdayDescriptions ?? [],
    amenities: extractAmenities(place),
    photos,
    last_fetched_at: fetchedAt,
  };
}

async function cacheFetchedPlaces(client: ReturnType<typeof createClient>, places: Iterable<Place>) {
  const fetchedAt = new Date().toISOString();
  const rows = [...places].map((place) => cachedPlace(place, fetchedAt)).filter((place): place is CachedPlace => place !== null);
  if (rows.length === 0) return;
  const { error } = await client.from("places").upsert(rows, { onConflict: "google_place_id" });
  if (error) throw error;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return reply({ error: "Method not allowed." }, 405);
  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return reply({ error: "Sign in to get recommendations." }, 401);
  const url = Deno.env.get("SUPABASE_URL"); const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"); const googleKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
  if (!url || !anonKey || !serviceRoleKey || !googleKey) return reply({ error: "Recommendation service is not configured." }, 503);
  const client = createClient(url, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
  const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return reply({ error: "Invalid request body." }, 400); }

  if (body.action === "get-place-photos") {
    let rawPhotos: Array<{
      name?: string | null;
      widthPx?: number | null;
      heightPx?: number | null;
      url?: string | null;
      authorAttributions?: PhotoAttribution[];
    }> = [];

    if (typeof body.placeId === "string") {
      const { data: placeRow } = await admin
        .from("places")
        .select("photos")
        .eq("google_place_id", body.placeId)
        .maybeSingle();

      if (placeRow?.photos) {
        rawPhotos = (placeRow.photos as typeof rawPhotos).slice(0, 10);
      }
    }

    if (rawPhotos.length === 0 && Array.isArray(body.photos)) {
      rawPhotos = (body.photos as typeof rawPhotos).slice(0, 10);
    }

    // Sanitize authorAttributions to never contain contributor avatar URLs
    for (const p of rawPhotos) {
      if (p.authorAttributions) {
        p.authorAttributions = p.authorAttributions.map((a: any) => ({
          displayName: a.displayName ?? null,
          uri: a.uri ?? null,
        }));
      }
    }

    let updated = false;
    await Promise.all(
      rawPhotos.slice(0, 10).map(async (p) => {
        if (!p.url && p.name) {
          try {
            const res = await fetch(
              `https://places.googleapis.com/v1/${p.name}/media?maxWidthPx=1200&skipHttpRedirect=true`,
              { headers: { "X-Goog-Api-Key": googleKey } }
            );
            if (res.ok) {
              const data = (await res.json()) as { photoUri?: string };
              if (data.photoUri) {
                p.url = data.photoUri;
                updated = true;
              }
            }
          } catch {
            // ignore individual photo fetch error
          }
        }
      })
    );

    if (typeof body.placeId === "string") {
      await admin.from("places").update({ photos: rawPhotos }).eq("google_place_id", body.placeId);
    }

    return reply({
      photos: rawPhotos,
      photoUrl: rawPhotos.find((p) => p.url)?.url ?? null,
    });
  }

  if (body.action === "backfill-photos") {
    const { data: allPlaces } = await admin
      .from("places")
      .select("google_place_id, photos");

    let count = 0;
    for (const row of allPlaces ?? []) {
      const placeId = row.google_place_id;
      const placePhotos = ((row.photos ?? []) as Array<{
        name?: string | null;
        widthPx?: number | null;
        heightPx?: number | null;
        url?: string | null;
        authorAttributions?: any[];
      }>).slice(0, 10);

      for (const p of placePhotos) {
        if (p.authorAttributions) {
          p.authorAttributions = p.authorAttributions.map((a: any) => ({
            displayName: a.displayName ?? null,
            uri: a.uri ?? null,
          }));
        }
      }

      let rowUpdated = false;
      await Promise.all(
        placePhotos.map(async (p) => {
          if (!p.url && p.name) {
            try {
              const res = await fetch(
                `https://places.googleapis.com/v1/${p.name}/media?maxWidthPx=1200&skipHttpRedirect=true`,
                { headers: { "X-Goog-Api-Key": googleKey } }
              );
              if (res.ok) {
                const data = (await res.json()) as { photoUri?: string };
                if (data.photoUri) {
                  p.url = data.photoUri;
                  rowUpdated = true;
                }
              }
            } catch {
              // ignore
            }
          }
        })
      );

      await admin.from("places").update({ photos: placePhotos }).eq("google_place_id", placeId);
      if (rowUpdated) count += 1;
    }
    return reply({ ok: true, updatedPlaces: count });
  }

  const { data: { user }, error: userError } = await client.auth.getUser(authorization.slice(7));
  if (userError || !user) return reply({ error: "Your session has expired. Please sign in again." }, 401);

  const mode: Mode | null = body.mode === "activities" ? "activities" : body.mode === "food" ? "food" : null;
  const latitude = number(body.latitude); const longitude = number(body.longitude); const requestedRadius = number(body.radiusMeters);
  if (!mode || latitude === null || longitude === null || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return reply({ error: "Choose a valid discovery area." }, 400);
  const radius = Math.min(50_000, Math.max(1_000, Math.round(requestedRadius ?? 10_000)));
  const [{ data: savedPlaces, error: savedPlacesError }, { data: passedPlaces, error: passedPlacesError }] = await Promise.all([
    client.from("saved_places").select("google_place_id").eq("user_id", user.id),
    client.from("passed_places").select("google_place_id").eq("user_id", user.id).eq("mode", mode),
  ]);
  if (savedPlacesError || passedPlacesError) return reply({ error: "Could not load your recommendation history." }, 500);
  const excluded = new Set([
    ...(savedPlaces ?? []).map((row) => row.google_place_id),
    ...(passedPlaces ?? []).map((row) => row.google_place_id),
    ...strings(body.excludedPlaceIds, 100),
  ]);
  const candidates = new Map<string, { place: Place; meters: number; score: number }>();
  const fetchedPlaces = new Map<string, Place>();
  const searchPlan = buildSearchPlan(mode, { latitude, longitude }, radius);
  let successfulSearches = 0;
  for (const plan of searchPlan) {
    const result = await searchNearby(googleKey, plan);
    if (!result.ok) continue;
    successfulSearches += 1;
    for (const place of result.places) {
      if (place.id) fetchedPlaces.set(place.id, place);
      const placeLat = place.location?.latitude; const placeLng = place.location?.longitude;
      if (!place.id || !place.displayName?.text || placeLat === undefined || placeLng === undefined || excluded.has(place.id) || candidates.has(place.id)) continue;
      const meters = distance(latitude, longitude, placeLat, placeLng);
      if (meters > radius) continue;
      const proximity = Math.max(0, 1 - meters / radius);
      candidates.set(place.id, { place, meters, score: 0.6 + 0.4 * proximity });
    }
    if (candidates.size >= 20) break;
  }
  if (successfulSearches === 0) return reply({ error: "Nearby places are temporarily unavailable." }, 502);
  try {
    await cacheFetchedPlaces(admin, fetchedPlaces.values());
  } catch (error) {
    console.error("Could not cache fetched Google Places", error);
    return reply({ error: "Could not store nearby places." }, 500);
  }
  if (candidates.size === 0 && successfulSearches < searchPlan.length) {
    return reply({ error: "We could not finish searching this area. Please try again." }, 502);
  }
  const ranked = shuffle([...candidates.values()]).slice(0, 20);
  const recommendations = await Promise.all(ranked.map(async ({ place, meters, score }) => {
    const photoInfo = await photo(googleKey, place);
    const photos = (place.photos ?? []).slice(0, 10).map((p, index) => ({
      name: p.name ?? null,
      widthPx: p.widthPx ?? null,
      heightPx: p.heightPx ?? null,
      url: index === 0 ? photoInfo.photoUrl : null,
      authorAttributions: (p.authorAttributions ?? []).map((a) => ({
        displayName: a.displayName ?? null,
        uri: a.uri ?? null,
      })),
    }));
    return {
      id: place.id,
      name: place.displayName?.text,
      category: place.primaryTypeDisplayName?.text ?? "Place",
      address: place.formattedAddress ?? null,
      distanceMeters: Math.round(meters),
      rating: place.rating ?? null,
      ratingCount: place.userRatingCount ?? null,
      priceLevel: place.priceLevel ?? null,
      openNow: place.currentOpeningHours?.openNow ?? null,
      mapsUrl: place.googleMapsUri ?? null,
      websiteUri: place.websiteUri ?? null,
      phoneNumber: place.nationalPhoneNumber ?? place.internationalPhoneNumber ?? null,
      regularOpeningHours: place.regularOpeningHours?.weekdayDescriptions ?? [],
      amenities: extractAmenities(place),
      reason: meters < radius * 0.3 ? "A nearby option within your chosen range." : "A different corner of your chosen search area.",
      score: Number(score.toFixed(4)),
      matchPercent: Math.round(score * 100),
      photos,
      photoUrl: photoInfo.photoUrl,
      photoAttribution: photoInfo.photoAttribution,
    };
  }));
  return reply({ recommendations, exhausted: recommendations.length === 0, passedCount: passedPlaces?.length ?? 0 });
});
