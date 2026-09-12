// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders } from "jsr:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";

type Mode = "activities" | "food";
type Place = {
  id?: string; displayName?: { text?: string }; formattedAddress?: string;
  location?: { latitude?: number; longitude?: number }; primaryType?: string;
  primaryTypeDisplayName?: { text?: string }; types?: string[]; rating?: number;
  userRatingCount?: number; priceLevel?: string; currentOpeningHours?: { openNow?: boolean };
  googleMapsUri?: string; editorialSummary?: { text?: string };
  photos?: Array<{ name?: string; authorAttributions?: Array<{ displayName?: string; uri?: string }> }>;
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
const strings = (value: unknown, max: number) => Array.isArray(value)
  ? [...new Set(value.filter((item): item is string => typeof item === "string").map((item) => item.trim().toLowerCase()).filter(Boolean))].slice(0, max) : [];

function distance(fromLat: number, fromLng: number, toLat: number, toLng: number) {
  const rad = (degrees: number) => degrees * Math.PI / 180;
  const lat = rad(toLat - fromLat); const lng = rad(toLng - fromLng);
  const a = Math.sin(lat / 2) ** 2 + Math.cos(rad(fromLat)) * Math.cos(rad(toLat)) * Math.sin(lng / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function headline(mode: Mode, types: string[]) {
  if (mode === "food") {
    if (types.some((type) => ["cafe", "coffee_shop", "bakery"].includes(type))) return "Take a delicious little detour.";
    if (types.some((type) => ["dessert_shop", "ice_cream_shop"].includes(type))) return "Save room for something sweet.";
    return "Find your new favourite.";
  }
  if (types.some((type) => ["park", "national_park", "botanical_garden", "hiking_area"].includes(type))) return "Take the scenic route.";
  if (types.some((type) => ["museum", "art_gallery", "historical_place"].includes(type))) return "Make a little room for wonder.";
  if (types.some((type) => ["gym", "sports_complex", "bowling_alley"].includes(type))) return "Try something with a little energy.";
  return "Go somewhere new today.";
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

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return reply({ error: "Method not allowed." }, 405);
  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return reply({ error: "Sign in to get recommendations." }, 401);
  const url = Deno.env.get("SUPABASE_URL"); const anonKey = Deno.env.get("SUPABASE_ANON_KEY"); const googleKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
  if (!url || !anonKey || !googleKey) return reply({ error: "Recommendation service is not configured." }, 503);
  const client = createClient(url, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
  const { data: { user }, error: userError } = await client.auth.getUser(authorization.slice(7));
  if (userError || !user) return reply({ error: "Your session has expired. Please sign in again." }, 401);

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return reply({ error: "Invalid request body." }, 400); }
  const mode: Mode | null = body.mode === "activities" ? "activities" : body.mode === "food" ? "food" : null;
  const latitude = number(body.latitude); const longitude = number(body.longitude); const requestedRadius = number(body.radiusMeters);
  if (!mode || latitude === null || longitude === null || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return reply({ error: "Choose a valid discovery area." }, 400);
  const radius = Math.min(50_000, Math.max(1_000, Math.round(requestedRadius ?? 10_000)));
  const interests = strings(body.interests, 12).filter((interest) => interest in groups[mode]);
  const [{ data: actions, error: actionsError }, { data: impressions, error: impressionsError }] = await Promise.all([
    client.from("discover_place_actions").select("google_place_id").eq("user_id", user.id),
    client.from("discover_recommendation_impressions").select("google_place_id").eq("user_id", user.id).order("shown_at", { ascending: false }).limit(500),
  ]);
  if (actionsError || impressionsError) return reply({ error: "Could not load your recommendation history." }, 500);
  const excluded = new Set([...(actions ?? []).map((row) => row.google_place_id), ...strings(body.excludedPlaceIds, 100)]);
  const seen = new Map<string, number>();
  for (const row of impressions ?? []) seen.set(row.google_place_id, (seen.get(row.google_place_id) ?? 0) + 1);
  const includedTypes = [...new Set((interests.length ? interests.flatMap((interest) => groups[mode][interest]) : defaults[mode]))].slice(0, 50);
  const result = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": googleKey, "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.primaryType,places.primaryTypeDisplayName,places.types,places.rating,places.userRatingCount,places.priceLevel,places.currentOpeningHours.openNow,places.googleMapsUri,places.editorialSummary,places.photos" },
    body: JSON.stringify({ includedTypes, maxResultCount: 20, rankPreference: "POPULARITY", locationRestriction: { circle: { center: { latitude, longitude }, radius } } }),
  });
  if (!result.ok) { console.error("Google Places request failed", result.status, await result.text()); return reply({ error: "Nearby places are temporarily unavailable." }, 502); }
  const payload = await result.json() as { places?: Place[] };
  const ranked = (payload.places ?? []).flatMap((place) => {
    const placeLat = place.location?.latitude; const placeLng = place.location?.longitude;
    if (!place.id || !place.displayName?.text || placeLat === undefined || placeLng === undefined || excluded.has(place.id)) return [];
    const types = place.types ?? (place.primaryType ? [place.primaryType] : []);
    const matched = interests.find((interest) => groups[mode][interest]?.some((type) => types.includes(type)));
    const preference = interests.length === 0 ? 0.65 : matched ? 1 : 0.25; const meters = distance(latitude, longitude, placeLat, placeLng);
    const proximity = Math.max(0, 1 - meters / radius); const rating = Math.min(5, Math.max(0, place.rating ?? 0)); const count = Math.max(0, place.userRatingCount ?? 0);
    const quality = Math.max(0, Math.min(1, (((rating * count + 4.1 * 50) / (count + 50)) - 2.5) / 2.5)); const novelty = 1 / (1 + (seen.get(place.id) ?? 0));
    return [{ place, types, matched, meters, score: Math.max(0, Math.min(1, 0.5 * preference + 0.2 * proximity + 0.15 * quality + 0.15 * novelty)) }];
  }).sort((a, b) => b.score - a.score).slice(0, 12);
  const recommendations = await Promise.all(ranked.map(async ({ place, types, matched, meters, score }) => ({
    id: place.id, name: place.displayName?.text, headline: headline(mode, types), category: place.primaryTypeDisplayName?.text ?? "Place", address: place.formattedAddress ?? null,
    distanceMeters: Math.round(meters), rating: place.rating ?? null, ratingCount: place.userRatingCount ?? null, priceLevel: place.priceLevel ?? null,
    openNow: place.currentOpeningHours?.openNow ?? null, mapsUrl: place.googleMapsUri ?? null, summary: place.editorialSummary?.text ?? null,
    reason: matched ? `Because you’re interested in ${matched.replaceAll("_", " ")}.` : meters < radius * 0.3 ? "A well-rated option close to your chosen area." : "A popular place that adds variety to your day.",
    score: Number(score.toFixed(4)), matchPercent: Math.round(score * 100), ...await photo(googleKey, place),
  })));
  return reply({ recommendations });
});
