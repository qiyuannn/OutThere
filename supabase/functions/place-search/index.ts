// This adapter is checked with Deno; the shared handler is also checked by Expo/TypeScript.
import { createClient } from 'npm:@supabase/supabase-js@2.116.0';
import { createSearchHandler } from './search.ts';
import { SearchError } from '../_shared/search-contract.ts';

const url = Deno.env.get('SUPABASE_URL');
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const googleKey = Deno.env.get('GOOGLE_PLACES_API_KEY');
const admin = url && serviceKey ? createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
const quota = new Map<string, { count: number; until: number }>();
const signingKey = serviceKey ? await crypto.subtle.importKey('raw', new TextEncoder().encode(serviceKey), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']) : null;

Deno.serve(createSearchHandler({
  async authenticate(token) {
    if (!admin || !googleKey) throw new SearchError('Place search is not configured yet.', 503);
    const { data, error } = await admin.auth.getUser(token);
    return error ? null : data.user?.id ?? null;
  },
  consumeQuota(userId, units) {
    const now = Date.now();
    for (const [id, v] of quota) if (v.until <= now) quota.delete(id);
    // Per-isolate abuse protection. Also set project-wide Google API quotas in production.
    if (!quota.has(userId) && quota.size >= 10000) return false;
    const bucket = quota.get(userId) ?? { count: 0, until: now + 60000 };
    if (bucket.count + units > 60) return false;
    bucket.count += units; quota.set(userId, bucket); return true;
  },
  async google(path, mask, body) {
    const response = await fetch(`https://places.googleapis.com/v1/${path}`, {
      method: body ? 'POST' : 'GET', signal: AbortSignal.timeout(8000),
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': googleKey!, 'X-Goog-FieldMask': mask },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (response.status === 429) throw new SearchError('Place search is busy. Please try again shortly.', 429);
    if (response.status === 404) throw new SearchError('This place is no longer available.', 404);
    if (!response.ok) throw new SearchError('The places provider could not complete this search. Please try again.', 502);
    return await response.json();
  },
  async photo(place) {
    const name = place.photos?.[0]?.name;
    if (!name || !/^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/.test(name)) return null;
    try {
      const response = await fetch(`https://places.googleapis.com/v1/${name}/media?maxWidthPx=800&skipHttpRedirect=true`, {
        signal: AbortSignal.timeout(3000), headers: { 'X-Goog-Api-Key': googleKey! },
      });
      if (!response.ok) return null;
      const data = await response.json(); return data.photoUri ?? null;
    } catch { return null; }
  },
  async rememberIds(ids) {
    if (!ids.length) return;
    const { error } = await admin!.from('places').upsert(ids.map(google_place_id => ({ google_place_id })), { onConflict: 'google_place_id', ignoreDuplicates: true });
    if (error) throw new Error('Could not prepare place identifiers.');
  },
  async sign(payload) {
    const bytes = await crypto.subtle.sign('HMAC', signingKey!, new TextEncoder().encode(payload));
    return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
  },
}));
