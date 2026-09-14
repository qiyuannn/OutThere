import { distanceMeters, parseSearch, SearchError, validQuery, type SearchRequest } from '../_shared/search-contract.ts';

export interface GooglePlace {
  id?: string; displayName?: { text?: string }; formattedAddress?: string;
  location?: { latitude: number; longitude: number }; primaryType?: string; types?: string[];
  primaryTypeDisplayName?: { text?: string }; rating?: number; userRatingCount?: number;
  priceLevel?: string; currentOpeningHours?: { openNow?: boolean };
  googleMapsUri?: string; websiteUri?: string; internationalPhoneNumber?: string;
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  photos?: { name?: string; googleMapsUri?: string; authorAttributions?: { displayName?: string; uri?: string }[] }[];
  attributions?: { provider?: string; providerUri?: string }[];
  dineIn?: boolean; takeout?: boolean; delivery?: boolean; reservable?: boolean;
  outdoorSeating?: boolean; goodForChildren?: boolean; goodForGroups?: boolean;
  servesVegetarianFood?: boolean; restroom?: boolean;
}
const FOOD = new Set(['food', 'restaurant', 'cafe', 'coffee_shop', 'bakery', 'bar', 'pub', 'brewery', 'food_court', 'meal_takeaway', 'meal_delivery', 'ice_cream_shop', 'tea_house', 'dessert_shop', 'juice_shop']);
const ACTIVITIES = new Set(['park', 'museum', 'tourist_attraction', 'art_gallery', 'hiking_area', 'amusement_park', 'aquarium', 'zoo', 'botanical_garden', 'movie_theater', 'bowling_alley', 'historical_landmark', 'cultural_landmark', 'performing_arts_theater', 'beach', 'garden', 'playground', 'national_park', 'nature_preserve', 'scenic_spot', 'sports_complex', 'night_club', 'casino', 'concert_hall', 'water_park', 'amusement_center', 'video_arcade']);
export function classifyPlace(place: GooglePlace): 'food' | 'activities' {
  const types = [place.primaryType ?? '', ...(place.types ?? [])];
  // Primary type takes precedence for attractions that also contain a café.
  if (ACTIVITIES.has(place.primaryType ?? '')) return 'activities';
  return types.some(t => FOOD.has(t) || t.endsWith('_restaurant') || t.endsWith('_cafe')) ? 'food' : 'activities';
}
export function matches(place: GooglePlace, request: SearchRequest): boolean {
  if (!place.id || !place.displayName?.text || !place.location) return false;
  const { filters: f } = request;
  if (distanceMeters(request.center, place.location) > f.radiusMeters) return false;
  if (f.mode !== 'all' && classifyPlace(place) !== f.mode) return false;
  if (f.mode === 'activities' && ![place.primaryType, ...(place.types ?? [])].some(t => t && ACTIVITIES.has(t))) return false;
  if (f.category && place.primaryType !== f.category && !place.types?.includes(f.category)) return false;
  if (f.openNow && place.currentOpeningHours?.openNow !== true) return false;
  if (f.price && place.priceLevel !== f.price) return false;
  return !f.minRating || (place.rating !== undefined && place.rating >= f.minRating);
}
export function googleSearchBody(request: SearchRequest, pageToken?: string) {
  const f = request.filters;
  return {
    textQuery: request.query, pageSize: 20,
    locationBias: { circle: { center: request.center, radius: f.radiusMeters } },
    rankPreference: f.sort === 'distance' ? 'DISTANCE' : 'RELEVANCE',
    ...(f.category ? { includedType: f.category, strictTypeFiltering: true } : {}),
    ...(f.openNow ? { openNow: true } : {}), ...(f.minRating ? { minRating: f.minRating } : {}),
    ...(f.price && f.price !== 'PRICE_LEVEL_FREE' ? { priceLevels: [f.price] } : {}),
    ...(pageToken ? { pageToken } : {}),
  };
}
const FIELDS = 'id,displayName,formattedAddress,location,primaryType,primaryTypeDisplayName,types,rating,userRatingCount,priceLevel,currentOpeningHours.openNow,googleMapsUri,websiteUri,internationalPhoneNumber,regularOpeningHours.weekdayDescriptions,photos,attributions,dineIn,takeout,delivery,reservable,outdoorSeating,goodForChildren,goodForGroups,servesVegetarianFood,restroom';
export const SEARCH_MASK = 'id,displayName,formattedAddress,location,primaryType,primaryTypeDisplayName,types,rating,userRatingCount,priceLevel,currentOpeningHours.openNow,googleMapsUri,photos,attributions'.split(',').map(f => `places.${f}`).join(',') + ',nextPageToken';
export const DETAIL_MASK = FIELDS;
export function normalizePlace(p: GooglePlace, photoUrl: string | null = null, request?: SearchRequest) {
  const amenities: Record<string, boolean> = {};
  for (const key of ['dineIn', 'takeout', 'delivery', 'reservable', 'outdoorSeating', 'goodForChildren', 'goodForGroups', 'servesVegetarianFood', 'restroom'] as const) {
    if (typeof p[key] === 'boolean') amenities[key] = p[key];
  }
  return {
    id: p.id!, name: p.displayName?.text ?? 'Place unavailable', mode: classifyPlace(p),
    category: p.primaryTypeDisplayName?.text ?? p.primaryType ?? 'Place', primaryType: p.primaryType ?? null,
    address: p.formattedAddress ?? null, latitude: p.location?.latitude ?? null, longitude: p.location?.longitude ?? null,
    distanceMeters: request && p.location ? Math.round(distanceMeters(request.center, p.location)) : null,
    rating: p.rating ?? null, ratingCount: p.userRatingCount ?? null, priceLevel: p.priceLevel ?? null,
    openNow: p.currentOpeningHours?.openNow ?? null, mapsUrl: p.googleMapsUri ?? null,
    websiteUri: p.websiteUri ?? null, phoneNumber: p.internationalPhoneNumber ?? null,
    regularOpeningHours: p.regularOpeningHours?.weekdayDescriptions ?? [], amenities,
    photoUrl,
    // Resolved media is used only in memory. Do not persist expiring photo resource names.
    photos: photoUrl ? [{ url: photoUrl, googleMapsUri: p.photos?.[0]?.googleMapsUri ?? p.googleMapsUri,
      authorAttributions: (p.photos?.[0]?.authorAttributions ?? []).map(a => ({ displayName: a.displayName ?? null, uri: a.uri ?? null })) }] : [],
    attributions: p.attributions ?? [], liveDetails: true,
  };
}
export interface SearchDependencies {
  authenticate: (token: string) => Promise<string | null>;
  consumeQuota: (userId: string, units: number) => boolean;
  google: (path: string, mask: string, body?: unknown) => Promise<Record<string, unknown>>;
  photo: (place: GooglePlace) => Promise<string | null>;
  rememberIds: (ids: string[]) => Promise<void>;
  sign: (payload: string) => Promise<string>;
}
const encode = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s)));
const decode = (s: string) => new TextDecoder().decode(Uint8Array.from(atob(s), c => c.charCodeAt(0)));
const fingerprint = (r: SearchRequest) => JSON.stringify({ query: r.query, center: r.center, filters: r.filters });
const ID = /^[A-Za-z0-9_-]{1,255}$/;
export function createSearchHandler(deps: SearchDependencies) {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
  return async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') return new Response('ok', { headers });
    if (request.method !== 'POST') return reply({ error: 'Method not allowed.' }, 405);
    try {
      const authorization = request.headers.get('Authorization');
      if (!authorization?.startsWith('Bearer ')) throw new SearchError('Sign in to search for places.', 401);
      const userId = await deps.authenticate(authorization.slice(7));
      if (!userId) throw new SearchError('Your session has expired. Please sign in again.', 401);
      const raw = await request.text();
      if (raw.length > 16000) throw new SearchError('Search request is too large.', 413);
      let body: Record<string, unknown>;
      try { body = JSON.parse(raw); } catch { throw new SearchError('Invalid search request.'); }
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new SearchError('Invalid search request.');
      const charge = (units: number) => { if (!deps.consumeQuota(userId, units)) throw new SearchError('Too many requests. Wait a minute and try again.', 429); };
      if (body.action === 'areas') {
        const query = validQuery(body.query);
        charge(1);
        const data = await deps.google('places:searchText', 'places.id,places.displayName,places.formattedAddress,places.location,places.attributions', { textQuery: query, pageSize: 5 });
        const places = (data.places ?? []) as GooglePlace[];
        return reply({ areas: places.filter(p => p.id && p.location).map(p => ({ id: p.id, label: p.formattedAddress ?? p.displayName?.text ?? query, ...p.location, attributions: p.attributions ?? [] })) });
      }
      if (body.action === 'details') {
        if (!Array.isArray(body.ids) || !body.ids.length || body.ids.length > 10 || !body.ids.every(id => typeof id === 'string' && ID.test(id))) throw new SearchError('Choose up to 10 valid places.');
        const ids = [...new Set(body.ids as string[])];
        charge(ids.length);
        const places = [];
        // Bounded concurrency and request count for saved/rated-place hydration.
        for (let i = 0; i < ids.length; i += 4) {
          places.push(...await Promise.all(ids.slice(i, i + 4).map(async id => {
            try {
              const p = await deps.google(`places/${id}`, DETAIL_MASK) as GooglePlace;
              return { ...normalizePlace(p, await deps.photo(p)), detailsComplete: true };
            } catch (error) {
              // A removed venue must not make an entire saved/rated list inaccessible.
              if (error instanceof SearchError && error.status === 404) return {
                ...normalizePlace({ id, displayName: { text: 'Place no longer available' } }),
                detailsComplete: true, unavailable: true,
              };
              throw error;
            }
          })));
        }
        await deps.rememberIds(ids);
        return reply({ places });
      }
      if (body.action !== 'search') throw new SearchError('Unknown search action.');
      const search = parseSearch(body);
      let page = 0, pageToken: string | undefined;
      if (search.cursor) {
        try {
          const [payload, signature, extra] = search.cursor.split('.');
          if (extra || !signature || await deps.sign(payload) !== signature) throw new Error();
          const cursor = JSON.parse(decode(payload));
          if (cursor.userId !== userId || cursor.exp < Date.now() || cursor.key !== fingerprint(search) || !Number.isInteger(cursor.page) || cursor.page < 1 || cursor.page > 2 || typeof cursor.token !== 'string') throw new Error();
          page = cursor.page; pageToken = cursor.token;
        } catch { throw new SearchError('This search page has expired. Search again.'); }
      }
      charge(1);
      const data = await deps.google('places:searchText', SEARCH_MASK, googleSearchBody(search, pageToken));
      const selected = [...new Map(((data.places ?? []) as GooglePlace[]).filter(p => matches(p, search)).map(p => [p.id!, p])).values()];
      const places = [];
      for (let i = 0; i < selected.length; i += 4) {
        places.push(...await Promise.all(selected.slice(i, i + 4).map(async p => normalizePlace(p, await deps.photo(p), search))));
      }
      // Store identifiers only for the existing saved/rating foreign keys, never search content.
      await deps.rememberIds(selected.map(p => p.id!));
      let cursor: string | null = null;
      if (typeof data.nextPageToken === 'string' && page < 2) {
        const payload = encode(JSON.stringify({ userId, exp: Date.now() + 15 * 60000, key: fingerprint(search), token: data.nextPageToken, page: page + 1 }));
        cursor = payload + '.' + await deps.sign(payload);
      }
      return reply({ places, cursor, limited: !!data.nextPageToken && page >= 2 });
    } catch (error) {
      if (error instanceof SearchError) return reply({ error: error.message }, error.status);
      // Do not expose provider responses, credentials, queries, or precise location in errors/logs.
      return reply({ error: 'Place search is temporarily unavailable. Please try again.' }, 502);
    }
  };
}
