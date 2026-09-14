import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { DEFAULT_FILTERS, parseSearch, distanceMeters, mergeResults, addRecentSearch, SearchError } from '../supabase/functions/_shared/search-contract.ts';
import { createSearchHandler, classifyPlace, matches, googleSearchBody, normalizePlace } from '../supabase/functions/place-search/search.ts';

const input = (filters = {}) => ({ action: 'search', query: 'coffee', center: { latitude: 1.3, longitude: 103.8 }, filters: { ...DEFAULT_FILTERS, ...filters } });
const cafe = (changes = {}) => ({ id: 'cafe_1', displayName: { text: 'Good coffee' }, location: { latitude: 1.301, longitude: 103.801 }, primaryType: 'cafe', types: ['cafe', 'food'], rating: 4.5, priceLevel: 'PRICE_LEVEL_MODERATE', currentOpeningHours: { openNow: true }, ...changes });
function fixture(overrides = {}) {
  const calls = [], remembered = [];
  const handler = createSearchHandler({ authenticate: async token => token === 'valid' ? 'user-1' : token === 'other' ? 'user-2' : null,
    consumeQuota: () => true,
    google: async (path, mask, body) => { calls.push({ path, mask, body }); return { places: [cafe()], nextPageToken: 'google-page-token' }; },
    photo: async () => null, rememberIds: async ids => remembered.push(...ids),
    sign: async text => createHmac('sha256', 'test-only-signing-key').update(text).digest('hex'), ...overrides });
  async function call(body, token = 'valid', method = 'POST') {
    const response = await handler(new Request('https://example.test/place-search', { method,
      headers: token ? { Authorization: `Bearer ${token}` } : {}, ...(method === 'POST' ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}) }));
    return { status: response.status, headers: response.headers, body: await response.json() };
  }
  return { call, calls, remembered };
}

test('validates coordinates, bounds, category/mode combinations, and unknown filter values', () => {
  assert.equal(parseSearch(input()).query, 'coffee');
  for (const filters of [{ radiusMeters: 999 }, { radiusMeters: 50001 }, { mode: 'secret' }, { sort: 'best' }, { minRating: 4.2 }, { openNow: 'true' }, { category: 'museum', mode: 'food' }, { price: 'cheap' }]) {
    assert.throws(() => parseSearch(input(filters)));
  }
  for (const center of [{ latitude: NaN, longitude: 0 }, { latitude: 91, longitude: 0 }, { latitude: 0, longitude: -181 }]) assert.throws(() => parseSearch({ ...input(), center }));
  for (const query of ['', 'a', 'a'.repeat(161), null]) assert.throws(() => parseSearch({ ...input(), query }));
});
test('distance is stable at identical, antipodal and dateline coordinates', () => {
  assert.equal(distanceMeters({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 0 }), 0);
  assert.ok(Math.abs(distanceMeters({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 180 }) - 20015087) < 1);
  assert.ok(distanceMeters({ latitude: 0, longitude: 179.999 }, { latitude: 0, longitude: -179.999 }) < 225);
});
test('food and activity classification respects primary types', () => {
  assert.equal(classifyPlace(cafe()), 'food');
  assert.equal(classifyPlace(cafe({ primaryType: 'museum', types: ['museum', 'cafe'] })), 'activities');
  assert.equal(classifyPlace(cafe({ primaryType: 'ramen_restaurant' })), 'food');
  assert.equal(matches(cafe({ primaryType: 'bank', types: ['bank'] }), parseSearch(input({ mode: 'activities' }))), false);
});
test('radius, price, rating and open-now filters never invent missing values', () => {
  assert.equal(matches(cafe(), parseSearch(input({ openNow: true, minRating: 4, price: 'PRICE_LEVEL_MODERATE' }))), true);
  for (const p of [cafe({ currentOpeningHours: undefined }), cafe({ currentOpeningHours: { openNow: false } })]) assert.equal(matches(p, parseSearch(input({ openNow: true }))), false);
  assert.equal(matches(cafe({ rating: undefined }), parseSearch(input({ minRating: 4 }))), false);
  assert.equal(matches(cafe({ priceLevel: undefined }), parseSearch(input({ price: 'PRICE_LEVEL_FREE' }))), false);
  assert.equal(matches(cafe({ location: { latitude: 1.5, longitude: 103.8 } }), parseSearch(input({ radiusMeters: 1000 }))), false);
  assert.equal(matches(cafe({ location: undefined }), parseSearch(input())), false);
});
test('Google request uses supported filters and handles Free by post-filtering', () => {
  const req = googleSearchBody(parseSearch(input({ category: 'cafe', openNow: true, price: 'PRICE_LEVEL_FREE', sort: 'distance' })), 'next');
  assert.equal(req.includedType, 'cafe'); assert.equal(req.strictTypeFiltering, true);
  assert.equal(req.rankPreference, 'DISTANCE'); assert.equal(req.pageToken, 'next');
  assert.equal(req.priceLevels, undefined); assert.equal(req.pageSize, 20);
  assert.ok(req.locationBias.circle); assert.equal(req.locationRestriction, undefined);
});
test('normalization preserves unknown hours and attribution without persisting photo names', () => {
  const result = normalizePlace(cafe({ currentOpeningHours: undefined, rating: undefined, photos: [{ name: 'private-resource-name', googleMapsUri: 'https://maps.google.com/photo', authorAttributions: [{ displayName: 'Author', uri: 'https://maps.google.com/author' }] }] }), 'https://example.test/image');
  assert.equal(result.openNow, null); assert.equal(result.rating, null);
  assert.equal(result.photos[0].name, undefined); assert.equal(result.photos[0].authorAttributions[0].displayName, 'Author');
  assert.equal(result.photos[0].googleMapsUri, 'https://maps.google.com/photo');
});
test('merging pages removes duplicates and reorders all loaded matches by distance', () => {
  const a = [{ id: 'a', distanceMeters: 100 }, { id: 'b', distanceMeters: 30 }];
  const b = [{ id: 'a', distanceMeters: 90 }, { id: 'c', distanceMeters: 10 }];
  assert.deepEqual(mergeResults(a, b, 'distance').map(p => p.id), ['c', 'b', 'a']);
  assert.deepEqual(mergeResults(a, b, 'relevance').map(p => p.id), ['a', 'b', 'c']);
});
test('recent history is deduplicated, bounded and only contains user queries', () => {
  assert.deepEqual(addRecentSearch(['Ramen', 'Parks'], ' ramen '), ['ramen', 'Parks']);
  assert.equal(addRecentSearch(Array.from({ length: 8 }, (_, i) => `query${i}`), 'new query').length, 8);
});
test('all actions authenticate before any provider call', async () => {
  const f = fixture();
  for (const action of ['areas', 'details', 'search', 'suggest']) {
    assert.equal((await f.call({ ...input(), action }, null)).status, 401);
    assert.equal((await f.call({ ...input(), action }, 'invalid')).status, 401);
  }
  assert.equal(f.calls.length, 0);
});
test('rejects malformed JSON and oversized bodies before contacting Google', async () => {
  const f = fixture();
  for (const body of ['{bad', 'null', '[]']) assert.equal((await f.call(body)).status, 400);
  assert.equal((await f.call('x'.repeat(16001))).status, 413);
  assert.equal((await f.call(input(), 'valid', 'GET')).status, 405);
  assert.equal(f.calls.length, 0);
});
test('rate limited requests do not make provider calls', async () => {
  const f = fixture({ consumeQuota: () => false });
  assert.equal((await f.call(input())).status, 429); assert.equal(f.calls.length, 0);
});
test('search returns real normalized matches and only remembers identifiers', async () => {
  const f = fixture(); const response = await f.call(input());
  assert.equal(response.status, 200); assert.equal(response.body.places[0].name, 'Good coffee');
  assert.deepEqual(f.remembered, ['cafe_1']); assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.ok(f.calls[0].mask.includes('places.rating')); assert.ok(response.body.cursor);
});
test('pagination is bound to the authenticated user, query, area and filters', async () => {
  const f = fixture(); const { body: first } = await f.call(input());
  const before = f.calls.length;
  for (const request of [{ ...input(), query: 'parks' }, input({ radiusMeters: 1000 }), { ...input(), center: { latitude: 2, longitude: 104 } }]) {
    assert.equal((await f.call({ ...request, cursor: first.cursor })).status, 400);
  }
  assert.equal((await f.call({ ...input(), cursor: first.cursor }, 'other')).status, 400);
  assert.equal((await f.call({ ...input(), cursor: first.cursor + 'tampered' })).status, 400);
  assert.equal(f.calls.length, before);
});
test('pagination stops after three provider pages and preserves the Google token', async () => {
  const f = fixture(); const first = await f.call(input());
  const second = await f.call({ ...input(), cursor: first.body.cursor });
  const third = await f.call({ ...input(), cursor: second.body.cursor });
  assert.equal(f.calls[1].body.pageToken, 'google-page-token');
  assert.equal(third.body.cursor, null); assert.equal(third.body.limited, true); assert.equal(f.calls.length, 3);
});
test('empty post-filtered pages still provide continuation', async () => {
  const f = fixture(); const result = await f.call(input({ price: 'PRICE_LEVEL_FREE' }));
  assert.deepEqual(result.body.places, []); assert.ok(result.body.cursor); assert.deepEqual(f.remembered, []);
});
test('detail requests cap work and reject path injection', async () => {
  const f = fixture();
  for (const ids of [[], Array(11).fill('id'), ['../../secrets'], ['id?key=secret'], [null]]) assert.equal((await f.call({ action: 'details', ids })).status, 400);
  assert.equal(f.calls.length, 0);
});
test('a removed venue does not prevent the remaining saved places from loading', async () => {
  const f = fixture({ google: async path => { if (path === 'places/removed') throw new SearchError('Not found', 404); return cafe(); } });
  const result = await f.call({ action: 'details', ids: ['removed', 'cafe_1'] });
  assert.equal(result.status, 200); assert.equal(result.body.places.length, 2);
  assert.equal(result.body.places[0].unavailable, true);
  assert.equal(result.body.places[1].name, 'Good coffee');
  assert.equal(result.body.places[1].detailsComplete, true);
});
test('area lookup returns selectable coordinates without asking for device location', async () => {
  const f = fixture(); const result = await f.call({ action: 'areas', query: 'Singapore' });
  assert.equal(result.status, 200); assert.equal(result.body.areas[0].latitude, 1.301);
  assert.equal(f.calls[0].body.locationBias, undefined); assert.equal(f.calls[0].body.pageSize, 5);
});
test('provider and storage failures surface a retryable error, not an empty success or secret', async () => {
  for (const override of [{ google: async () => { throw new Error('secret-google-key'); } }, { rememberIds: async () => { throw new Error('secret-database-key'); } }]) {
    const result = await fixture(override).call(input()); assert.equal(result.status, 502);
    assert.equal(JSON.stringify(result.body).includes('secret'), false);
  }
});

test('autocomplete forwards partial input and location and returns named places only', async () => {
  let sent;
  const prediction = { placePrediction: { placeId: 'din_tai', structuredFormat: { mainText: { text: 'Din Tai Fung' }, secondaryText: { text: 'Orchard Road, Singapore' } } } };
  const f = fixture({ google: async (path, mask, body) => {
    sent = { path, mask, body };
    return { suggestions: [prediction, prediction, { queryPrediction: { text: { text: 'din tai restaurants' } } }] };
  } });
  const result = await f.call({ action: 'suggest', query: 'Din Tai', center: input().center });
  assert.equal(result.status, 200);
  assert.equal(sent.path, 'places:autocomplete');
  assert.equal(sent.body.input, 'Din Tai');
  assert.deepEqual(sent.body.locationBias.circle.center, input().center);
  assert.equal(sent.body.includeQueryPredictions, false);
  assert.deepEqual(result.body.suggestions, [{ id: 'din_tai', name: 'Din Tai Fung', address: 'Orchard Road, Singapore' }]);
  assert.deepEqual(f.remembered, []);
});
test('autocomplete rejects invalid input and coordinates before provider work', async () => {
  const f = fixture();
  for (const request of [{ query: 'x' }, { query: 'a'.repeat(161) }, { query: 'cafe', center: { latitude: 91, longitude: 0 } }]) {
    assert.equal((await f.call({ action: 'suggest', ...request })).status, 400);
  }
  assert.equal(f.calls.length, 0);
  assert.equal((await fixture({ consumeQuota: () => false }).call({ action: 'suggest', query: 'cafe' })).status, 429);
});
