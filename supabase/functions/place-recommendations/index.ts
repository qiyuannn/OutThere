/**
 * supabase/functions/place-recommendations/index.ts
 * Thin Deno entrypoint adapter for place recommendations.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders } from "jsr:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";
import { handleBackfillPhotos, handleGetPlacePhotos, handleRecommendations } from "./handler.ts";
import type { PlaceRecommendationsPayload } from "./types.ts";

const headers = { ...corsHeaders, "Content-Type": "application/json" };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return reply({ error: "Method not allowed." }, 405);

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return reply({ error: "Sign in to get recommendations." }, 401);

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const googleKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
  if (!url || !anonKey || !serviceRoleKey || !googleKey) {
    return reply({ error: "Recommendation service is not configured." }, 503);
  }

  const client = createClient(url, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
  const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });

  let payload: PlaceRecommendationsPayload;
  try {
    payload = await request.json();
  } catch {
    return reply({ error: "Invalid request body." }, 400);
  }

  try {
    if (payload.action === "get-place-photos") {
      return reply(await handleGetPlacePhotos(payload, admin, googleKey));
    }
    if (payload.action === "backfill-photos") {
      return reply(await handleBackfillPhotos(admin, googleKey));
    }

    const { data: { user }, error: userError } = await client.auth.getUser(authorization.slice(7));
    if (userError || !user) return reply({ error: "Your session has expired. Please sign in again." }, 401);

    const mode = payload.mode;
    const lat = payload.latitude;
    const lng = payload.longitude;
    if (!mode || lat == null || lng == null || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return reply({ error: "Choose a valid discovery area." }, 400);
    }
    if (payload.circleIndex != null && (!Number.isInteger(payload.circleIndex) || payload.circleIndex < 0 || payload.circleIndex > 6)) {
      return reply({ error: "circleIndex must be an integer between 0 and 6." }, 400);
    }

    const result = await handleRecommendations(user.id, payload, { client, admin, googleKey });
    return reply(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "An error occurred processing recommendations.";
    return reply({ error: message }, 500);
  }
});
