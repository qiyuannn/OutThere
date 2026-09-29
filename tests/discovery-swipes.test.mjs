import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DAILY_SWIPE_LIMIT,
  SWIPE_WINDOW_DURATION_MS,
  computeAllowanceState,
  formatResetTime,
  formatTimeRemaining,
} from '../src/features/discover/allowance-model.ts';

import {
  parseDiscoveryRequest,
  parseSwipeResponse,
  DiscoveryError,
} from '../supabase/functions/_shared/discovery-contract.ts';

import {
  createDiscoveryHandler,
  revenueCatProUntil,
} from '../supabase/functions/discovery-swipes/handler.ts';

// ============================================================================
// Group 1: Non-Pro Daily Swipe Limit (10/day) & 24-Hour Reset Window
// ============================================================================

test('Non-pro starts with 10 swipes available and not limit reached', () => {
  const state = computeAllowanceState({ isPro: false, used: 0, windowStartedAt: null });
  assert.equal(state.unlimited, false);
  assert.equal(state.limit, 10);
  assert.equal(state.remaining, 10);
  assert.equal(state.resetsAt, null);
  assert.equal(state.isLimitReached, false);
});

test('First swipe initializes the 24-hour reset window from first swipe timestamp', () => {
  const t0 = new Date('2026-09-29T12:00:00.000Z').getTime();
  const state = computeAllowanceState({
    isPro: false,
    used: 1,
    windowStartedAt: new Date(t0).toISOString(),
    now: t0,
  });

  assert.equal(state.unlimited, false);
  assert.equal(state.remaining, 9);
  assert.equal(state.isLimitReached, false);
  assert.ok(state.resetsAt instanceof Date);
  assert.equal(state.resetsAt.toISOString(), '2026-09-30T12:00:00.000Z');
  assert.equal(state.resetsAt.getTime() - t0, SWIPE_WINDOW_DURATION_MS);
});

test('Swiping 10 times marks the daily limit as reached', () => {
  const t0 = new Date('2026-09-29T12:00:00.000Z').getTime();
  const state = computeAllowanceState({
    isPro: false,
    used: 10,
    windowStartedAt: new Date(t0).toISOString(),
    now: t0 + 2 * 60 * 60 * 1000, // 2 hours later
  });

  assert.equal(state.unlimited, false);
  assert.equal(state.remaining, 0);
  assert.equal(state.isLimitReached, true);
  assert.equal(state.resetsAt?.toISOString(), '2026-09-30T12:00:00.000Z');
});

test('Exceeding 10 swipes clamps remaining to 0 and keeps limit reached', () => {
  const t0 = new Date('2026-09-29T12:00:00.000Z').getTime();
  const state = computeAllowanceState({
    isPro: false,
    used: 15,
    windowStartedAt: new Date(t0).toISOString(),
    now: t0 + 3600000,
  });

  assert.equal(state.remaining, 0);
  assert.equal(state.isLimitReached, true);
});

test('24 hours after the first swipe, the limit resets back to 10 swipes', () => {
  const t0 = new Date('2026-09-29T12:00:00.000Z').getTime();
  const windowStartedAt = new Date(t0).toISOString();

  // 23 hours 59 minutes: still in window, used 10 -> limit reached
  const beforeReset = computeAllowanceState({
    isPro: false,
    used: 10,
    windowStartedAt,
    now: t0 + (24 * 60 - 1) * 60 * 1000,
  });
  assert.equal(beforeReset.remaining, 0);
  assert.equal(beforeReset.isLimitReached, true);

  // Exactly 24 hours: window expired and resets!
  const atReset = computeAllowanceState({
    isPro: false,
    used: 10,
    windowStartedAt,
    now: t0 + 24 * 60 * 60 * 1000,
  });
  assert.equal(atReset.remaining, 10);
  assert.equal(atReset.resetsAt, null);
  assert.equal(atReset.isLimitReached, false);

  // After 25 hours: still fresh 10
  const afterReset = computeAllowanceState({
    isPro: false,
    used: 10,
    windowStartedAt,
    now: t0 + 25 * 60 * 60 * 1000,
  });
  assert.equal(afterReset.remaining, 10);
  assert.equal(afterReset.resetsAt, null);
  assert.equal(afterReset.isLimitReached, false);
});

// ============================================================================
// Group 2: Pro Subscription Unlimited Swipes
// ============================================================================

test('Pro subscription grants unlimited swipes with remaining = null and isLimitReached = false', () => {
  const t0 = Date.now();
  const proState = computeAllowanceState({
    isPro: true,
    used: 150,
    windowStartedAt: new Date(t0).toISOString(),
    now: t0,
  });

  assert.equal(proState.unlimited, true);
  assert.equal(proState.remaining, null);
  assert.equal(proState.resetsAt, null);
  assert.equal(proState.isLimitReached, false);
});

test('Upgrading to Pro immediately unblocks a user who reached the 10 swipe limit', () => {
  const t0 = Date.now();
  const nonProState = computeAllowanceState({
    isPro: false,
    used: 10,
    windowStartedAt: new Date(t0).toISOString(),
    now: t0 + 3600000,
  });
  assert.equal(nonProState.isLimitReached, true);

  const upgradedState = computeAllowanceState({
    isPro: true,
    used: 10,
    windowStartedAt: new Date(t0).toISOString(),
    now: t0 + 3600000,
  });
  assert.equal(upgradedState.unlimited, true);
  assert.equal(upgradedState.isLimitReached, false);
  assert.equal(upgradedState.remaining, null);
});

// ============================================================================
// Group 3: Formatting Time Remaining and Reset Time
// ============================================================================

test('formatTimeRemaining formats countdown correctly', () => {
  const now = new Date('2026-09-29T12:00:00.000Z').getTime();

  assert.equal(formatTimeRemaining(null, now), '');

  // 23 hours 45 minutes
  const t1 = new Date(now + (23 * 60 + 45) * 60 * 1000);
  assert.equal(formatTimeRemaining(t1, now), '23h 45m');

  // Exactly 2 hours
  const t2 = new Date(now + 2 * 60 * 60 * 1000);
  assert.equal(formatTimeRemaining(t2, now), '2h');

  // 35 minutes
  const t3 = new Date(now + 35 * 60 * 1000);
  assert.equal(formatTimeRemaining(t3, now), '35m');

  // Less than 1 minute
  const t4 = new Date(now + 20 * 1000);
  assert.equal(formatTimeRemaining(t4, now), '< 1m');

  // Already passed
  const t5 = new Date(now - 1000);
  assert.equal(formatTimeRemaining(t5, now), 'now');
});

test('formatResetTime returns non-empty string for valid Date', () => {
  const d = new Date('2026-09-29T18:30:00.000Z');
  assert.ok(formatResetTime(d).length > 0);
  assert.equal(formatResetTime(null), '');
});

// ============================================================================
// Group 4: Shared Contract Validation
// ============================================================================

test('parseDiscoveryRequest accepts valid status action', () => {
  assert.deepEqual(parseDiscoveryRequest({ action: 'status' }), { action: 'status' });
});

test('parseDiscoveryRequest accepts valid swipe action', () => {
  const validSwipe = {
    action: 'swipe',
    requestId: '12345678-1234-4234-8234-123456789abc',
    placeId: 'ChIJN1t_tDeuEmsRUsoyG83frY4',
    mode: 'food',
    choice: 'save',
  };
  assert.deepEqual(parseDiscoveryRequest(validSwipe), validSwipe);
});

test('parseDiscoveryRequest rejects unexpected fields or invalid choices', () => {
  assert.throws(() => parseDiscoveryRequest(null), DiscoveryError);
  assert.throws(() => parseDiscoveryRequest({ action: 'unknown' }), DiscoveryError);
  assert.throws(
    () => parseDiscoveryRequest({ action: 'status', extra: 'hacker' }),
    DiscoveryError
  );
  assert.throws(
    () =>
      parseDiscoveryRequest({
        action: 'swipe',
        requestId: 'not-a-uuid',
        placeId: 'p1',
        mode: 'food',
        choice: 'save',
      }),
    DiscoveryError
  );
  assert.throws(
    () =>
      parseDiscoveryRequest({
        action: 'swipe',
        requestId: '12345678-1234-4234-8234-123456789abc',
        placeId: 'p1',
        mode: 'shopping',
        choice: 'save',
      }),
    DiscoveryError
  );
  assert.throws(
    () =>
      parseDiscoveryRequest({
        action: 'swipe',
        requestId: '12345678-1234-4234-8234-123456789abc',
        placeId: 'p1',
        mode: 'food',
        choice: 'superlike',
      }),
    DiscoveryError
  );
});

test('parseSwipeResponse validates server response structure', () => {
  const validPro = {
    accepted: true,
    duplicate: false,
    unlimited: true,
    limit: 10,
    remaining: null,
    resetsAt: null,
    proExpiresAt: '2026-10-29T12:00:00.000Z',
    serverTime: '2026-09-29T12:00:00.000Z',
  };
  assert.deepEqual(parseSwipeResponse(validPro), validPro);

  const validNonPro = {
    accepted: true,
    duplicate: false,
    unlimited: false,
    limit: 10,
    remaining: 7,
    resetsAt: '2026-09-30T12:00:00.000Z',
    proExpiresAt: null,
    serverTime: '2026-09-29T12:00:00.000Z',
  };
  assert.deepEqual(parseSwipeResponse(validNonPro), validNonPro);

  assert.throws(() => parseSwipeResponse({ ...validNonPro, limit: 100 }), Error);
  assert.throws(() => parseSwipeResponse({ ...validNonPro, remaining: -1 }), Error);
  assert.throws(() => parseSwipeResponse({ ...validPro, remaining: 5 }), Error);
});

// ============================================================================
// Group 5: RevenueCat Entitlement Verification
// ============================================================================

test('revenueCatProUntil returns null when subscriber has no pro entitlement', () => {
  assert.equal(revenueCatProUntil({ subscriber: { entitlements: {} } }), null);
  assert.equal(
    revenueCatProUntil({ subscriber: { entitlements: { other_feature: { expires_date: null } } } }),
    null
  );
});

test('revenueCatProUntil returns infinity for lifetime pro', () => {
  const result = revenueCatProUntil({
    subscriber: {
      entitlements: {
        outthere_pro: { expires_date: null },
      },
    },
  });
  assert.equal(result, 'infinity');
});

test('revenueCatProUntil returns ISO date for active subscription and null for expired', () => {
  const now = new Date('2026-09-29T12:00:00.000Z').getTime();

  // Active (expires tomorrow)
  const active = revenueCatProUntil(
    {
      subscriber: {
        entitlements: {
          outthere_pro: { expires_date: '2026-09-30T12:00:00.000Z' },
        },
      },
    },
    now
  );
  assert.equal(active, '2026-09-30T12:00:00.000Z');

  // Expired (expired yesterday)
  const expired = revenueCatProUntil(
    {
      subscriber: {
        entitlements: {
          outthere_pro: { expires_date: '2026-09-28T12:00:00.000Z' },
        },
      },
    },
    now
  );
  assert.equal(expired, null);
});

// ============================================================================
// Group 6: Discovery HTTP Edge Function Handler
// ============================================================================

test('createDiscoveryHandler handles CORS, auth, and requests', async () => {
  const handler = createDiscoveryHandler({
    authenticate: async (token) => (token === 'valid-jwt' ? 'user-123' : null),
    proUntil: async () => null,
    transact: async (userId, proUntil, req) => ({
      accepted: true,
      duplicate: false,
      unlimited: false,
      limit: 10,
      remaining: 8,
      resetsAt: '2026-09-30T12:00:00.000Z',
      proExpiresAt: null,
      serverTime: '2026-09-29T12:00:00.000Z',
    }),
  });

  // 1. OPTIONS CORS preflight
  const optionsRes = await handler(new Request('https://test/discovery-swipes', { method: 'OPTIONS' }));
  assert.equal(optionsRes.status, 204);
  assert.equal(optionsRes.headers.get('Access-Control-Allow-Origin'), '*');

  // 2. Reject GET
  const getRes = await handler(new Request('https://test/discovery-swipes', { method: 'GET' }));
  assert.equal(getRes.status, 405);

  // 3. Reject unauthenticated
  const unauthRes = await handler(
    new Request('https://test/discovery-swipes', {
      method: 'POST',
      body: JSON.stringify({ action: 'status' }),
    })
  );
  assert.equal(unauthRes.status, 401);

  // 4. Authenticated status request
  const statusRes = await handler(
    new Request('https://test/discovery-swipes', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer valid-jwt',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'status' }),
    })
  );
  assert.equal(statusRes.status, 200);
  const statusJson = await statusRes.json();
  assert.equal(statusJson.limit, 10);
  assert.equal(statusJson.remaining, 8);
});
