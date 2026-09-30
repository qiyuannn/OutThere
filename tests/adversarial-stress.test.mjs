import test from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveSignedUrl,
  resolveSignedUrls,
  resolveSignedUrlMap,
  DEFAULT_SIGNED_URL_LIFETIME_SECONDS,
  DEFAULT_STORAGE_BUCKET,
} from '../src/lib/storage.ts';

import {
  normalizePostgrestError,
  getErrorCode,
  getErrorMessage,
  getErrorDetails,
  getErrorHint,
  isPostgrestError,
  isUniqueViolation,
  isCheckViolation,
  isForeignKeyViolation,
  isRlsOrPrivilegeViolation,
  isNoRowsError,
  AppError,
  POSTGRES_ERROR_CODES,
  POSTGREST_ERROR_CODES,
} from '../src/lib/errors.ts';

import {
  toDate,
  formatTimeLabel,
  formatCalendarTimestamp,
  formatFeedTimestamp,
  formatRelativeTime,
  formatNotificationTime,
  formatDisplayDate,
  formatTimeRemaining,
  formatResetTime,
} from '../src/lib/format.ts';

import { unwrapSingleRelation } from '../src/lib/supabase-relation.ts';
import { Config } from '../src/constants/config.ts';
import { Timeouts, CacheTtl } from '../src/constants/timing.ts';
import { ImageLimits, InputLimits, PaginationLimits, ChartLimits } from '../src/constants/limits.ts';
import { StorageBuckets, StorageKeys, DeepLinks } from '../src/constants/storage.ts';

// ============================================================================
// Suite 1: storage.ts Adversarial Stress-Tests
// ============================================================================

test('storage: resolveSignedUrls handles empty, falsy, and whitespace arrays without client calls', async () => {
  const mockClient = {
    storage: {
      from: () => ({
        createSignedUrls: () => assert.fail('Client should not be invoked for empty/falsy inputs'),
      }),
    },
  };

  assert.deepEqual(await resolveSignedUrls([], 'avatars', 3600, mockClient), {});
  assert.deepEqual(await resolveSignedUrls([null], 'avatars', 3600, mockClient), {});
  assert.deepEqual(await resolveSignedUrls([undefined], 'avatars', 3600, mockClient), {});
  assert.deepEqual(await resolveSignedUrls([''], 'avatars', 3600, mockClient), {});
  assert.deepEqual(await resolveSignedUrls(['   ', '\t', '\n'], 'avatars', 3600, mockClient), {});
  assert.deepEqual(await resolveSignedUrls([null, undefined, '', '   '], 'avatars', 3600, mockClient), {});
});

test('storage: resolveSignedUrls handles deduplication and whitespace normalization', async () => {
  let requestedPaths = [];
  const mockClient = {
    storage: {
      from: () => ({
        createSignedUrls: async (paths) => {
          requestedPaths = paths;
          return {
            data: paths.map((p) => ({ path: p, signedUrl: `https://cdn/${p}` })),
            error: null,
          };
        },
      }),
    },
  };

  const input = ['user/a.png', '  user/a.png  ', 'user/b.png', 'user/a.png', '   '];
  const result = await resolveSignedUrls(input, 'avatars', 1800, mockClient);

  assert.deepEqual(requestedPaths, ['user/a.png', 'user/b.png']);
  assert.deepEqual(result, {
    'user/a.png': 'https://cdn/user/a.png',
    'user/b.png': 'https://cdn/user/b.png',
  });
});

test('storage: resolveSignedUrls handles partial failures in returned batch', async () => {
  const mockClient = {
    storage: {
      from: () => ({
        createSignedUrls: async (paths) => ({
          data: [
            { path: 'found.jpg', signedUrl: 'https://cdn/found.jpg', error: null },
            { path: 'missing.jpg', signedUrl: null, error: 'Object not found' },
            { path: null, signedUrl: 'https://cdn/corrupt.jpg' },
          ],
          error: null,
        }),
      }),
    },
  };

  const result = await resolveSignedUrls(['found.jpg', 'missing.jpg'], 'avatars', 3600, mockClient);
  assert.equal(result['found.jpg'], 'https://cdn/found.jpg');
  assert.equal(result['missing.jpg'], undefined);
  assert.equal(Object.keys(result).length, 1);
});

test('storage: resolveSignedUrls handles batch error responses and threw exceptions gracefully', async () => {
  const errorClient = {
    storage: {
      from: () => ({
        createSignedUrls: async () => ({
          data: null,
          error: { message: '500 Internal Server Error' },
        }),
      }),
    },
  };

  assert.deepEqual(
    await resolveSignedUrls(['photo.jpg'], 'post-photos', 3600, errorClient),
    {}
  );

  const throwingClient = {
    storage: {
      from: () => ({
        createSignedUrls: async () => {
          throw new Error('Network offline');
        },
      }),
    },
  };

  assert.deepEqual(
    await resolveSignedUrls(['photo.jpg'], 'post-photos', 3600, throwingClient),
    {}
  );
});

test('storage: resolveSignedUrls handles client without storage or invalid client gracefully', async () => {
  assert.deepEqual(await resolveSignedUrls(['p.jpg'], 'avatars', 3600, null), {});
  assert.deepEqual(await resolveSignedUrls(['p.jpg'], 'avatars', 3600, {}), {});
  assert.deepEqual(await resolveSignedUrls(['p.jpg'], 'avatars', 3600, { storage: null }), {});
});

test('storage: resolveSignedUrl handles non-string and malformed paths without client calls', async () => {
  const mockClient = {
    storage: {
      from: () => ({
        createSignedUrl: () => assert.fail('Client should not be called'),
      }),
    },
  };

  assert.equal(await resolveSignedUrl(null, 'avatars', 3600, mockClient), null);
  assert.equal(await resolveSignedUrl(undefined, 'avatars', 3600, mockClient), null);
  assert.equal(await resolveSignedUrl('', 'avatars', 3600, mockClient), null);
  assert.equal(await resolveSignedUrl('    ', 'avatars', 3600, mockClient), null);
  assert.equal(await resolveSignedUrl(12345, 'avatars', 3600, mockClient), null);
  assert.equal(await resolveSignedUrl({}, 'avatars', 3600, mockClient), null);
});

test('storage: resolveSignedUrl handles default parameters and trimming', async () => {
  let passedBucket;
  let passedExpires;
  let passedPath;

  const mockClient = {
    storage: {
      from: (bucket) => {
        passedBucket = bucket;
        return {
          createSignedUrl: async (path, expiresIn) => {
            passedPath = path;
            passedExpires = expiresIn;
            return { data: { signedUrl: `https://signed/${path}` }, error: null };
          },
        };
      },
    },
  };

  const url = await resolveSignedUrl('  path/to/avatar.jpg  ', undefined, undefined, mockClient);
  assert.equal(url, 'https://signed/path/to/avatar.jpg');
  assert.equal(passedBucket, DEFAULT_STORAGE_BUCKET);
  assert.equal(passedExpires, DEFAULT_SIGNED_URL_LIFETIME_SECONDS);
  assert.equal(passedPath, 'path/to/avatar.jpg');
});

test('storage: resolveSignedUrlMap returns standard Map matching entries', async () => {
  const mockClient = {
    storage: {
      from: () => ({
        createSignedUrls: async (paths) => ({
          data: paths.map((p) => ({ path: p, signedUrl: `https://cdn/${p}` })),
          error: null,
        }),
      }),
    },
  };

  const map = await resolveSignedUrlMap(['1.jpg', '2.jpg'], 'post-photos', 600, mockClient);
  assert.ok(map instanceof Map);
  assert.equal(map.size, 2);
  assert.equal(map.get('1.jpg'), 'https://cdn/1.jpg');
  assert.equal(map.get('2.jpg'), 'https://cdn/2.jpg');
  assert.equal(map.has('1.jpg'), true);
  assert.equal(map.has('nonexistent.jpg'), false);
});

// ============================================================================
// Suite 2: errors.ts Adversarial Stress-Tests
// ============================================================================

test('errors: getErrorMessage handles weird primitives and objects without crashing', () => {
  assert.equal(getErrorMessage(null), 'An unexpected error occurred.');
  assert.equal(getErrorMessage(undefined), 'An unexpected error occurred.');
  assert.equal(getErrorMessage(0), 'An unexpected error occurred.');
  assert.equal(getErrorMessage(false), 'An unexpected error occurred.');
  assert.equal(getErrorMessage(true), 'An unexpected error occurred.');
  assert.equal(getErrorMessage(NaN), 'An unexpected error occurred.');
  assert.equal(getErrorMessage(Symbol('error')), 'An unexpected error occurred.');
  assert.equal(getErrorMessage(123n), 'An unexpected error occurred.');

  // String edge cases
  assert.equal(getErrorMessage(''), 'An unexpected error occurred.');
  assert.equal(getErrorMessage('   '), 'An unexpected error occurred.');
  assert.equal(getErrorMessage('Valid message'), 'Valid message');
  assert.equal(getErrorMessage('  Padded message  '), 'Padded message');

  // Object fallback precedence
  assert.equal(getErrorMessage({ message: '  ' }, 'Custom fallback'), 'Custom fallback');
  assert.equal(getErrorMessage({ message: ' ', error_description: 'Desc' }), 'Desc');
  assert.equal(getErrorMessage({ message: ' ', error_description: ' ', error: 'Err' }), 'Err');
  assert.equal(getErrorMessage({ message: 12345 }), 'An unexpected error occurred.');
  assert.equal(getErrorMessage({}), 'An unexpected error occurred.');
});

test('errors: getErrorCode extracts codes accurately across numeric and string shapes', () => {
  assert.equal(getErrorCode({ code: '23505' }), '23505');
  assert.equal(getErrorCode({ code: 23505 }), '23505');
  assert.equal(getErrorCode({ code: 0 }), '0');
  assert.equal(getErrorCode({ code: '' }), null);
  assert.equal(getErrorCode({ code: null }), null);
  assert.equal(getErrorCode({ code: undefined }), null);
  assert.equal(getErrorCode({}), null);
  assert.equal(getErrorCode(null), null);
  assert.equal(getErrorCode(undefined), null);
  assert.equal(getErrorCode('random string'), null);
});

test('errors: getErrorDetails and getErrorHint trim and ignore empty/non-string values', () => {
  assert.equal(getErrorDetails({ details: '  Some details  ' }), 'Some details');
  assert.equal(getErrorDetails({ details: '' }), null);
  assert.equal(getErrorDetails({ details: '   ' }), null);
  assert.equal(getErrorDetails({ details: null }), null);
  assert.equal(getErrorDetails({ details: 123 }), null);
  assert.equal(getErrorDetails(null), null);

  assert.equal(getErrorHint({ hint: '  Use alternative name  ' }), 'Use alternative name');
  assert.equal(getErrorHint({ hint: '' }), null);
  assert.equal(getErrorHint({ hint: '   ' }), null);
  assert.equal(getErrorHint({ hint: null }), null);
  assert.equal(getErrorHint({ hint: 123 }), null);
  assert.equal(getErrorHint(null), null);
});

test('errors: normalizePostgrestError survives circular objects and deep shapes', () => {
  const circular = { message: 'Circular test', code: '42501' };
  circular.self = circular;

  const normalized = normalizePostgrestError(circular);
  assert.equal(normalized.message, 'Circular test');
  assert.equal(normalized.code, '42501');

  // Object with no code, details, or hint
  const minimal = normalizePostgrestError({ message: 'Minimal error' });
  assert.equal(minimal.message, 'Minimal error');
  assert.equal(minimal.code, undefined);
  assert.equal(minimal.details, undefined);
  assert.equal(minimal.hint, undefined);

  // Raw string error
  const fromString = normalizePostgrestError('Something broke');
  assert.equal(fromString.message, 'Something broke');
  assert.equal(fromString.code, undefined);
});

test('errors: AppError supports cause chaining and custom metadata', () => {
  const rootCause = new Error('Socket timeout');
  const appErr = new AppError('Service unavailable', {
    code: '503',
    details: 'Failed connecting to upstream',
    hint: 'Retry in 5 seconds',
    cause: rootCause,
  });

  assert.ok(appErr instanceof Error);
  assert.ok(appErr instanceof AppError);
  assert.equal(appErr.name, 'AppError');
  assert.equal(appErr.message, 'Service unavailable');
  assert.equal(appErr.code, '503');
  assert.equal(appErr.details, 'Failed connecting to upstream');
  assert.equal(appErr.hint, 'Retry in 5 seconds');
  assert.equal(appErr.cause, rootCause);

  const normalized = normalizePostgrestError(appErr);
  assert.equal(normalized.message, 'Service unavailable');
  assert.equal(normalized.code, '503');
  assert.equal(normalized.details, 'Failed connecting to upstream');
  assert.equal(normalized.hint, 'Retry in 5 seconds');
});

test('errors: predicates accurately differentiate error codes', () => {
  assert.equal(isUniqueViolation({ code: POSTGRES_ERROR_CODES.UNIQUE_VIOLATION }), true);
  assert.equal(isUniqueViolation({ code: 23505 }), true);
  assert.equal(isUniqueViolation({ code: '99999' }), false);
  assert.equal(isUniqueViolation(null), false);

  assert.equal(isCheckViolation({ code: POSTGRES_ERROR_CODES.CHECK_VIOLATION }), true);
  assert.equal(isCheckViolation({ code: 23514 }), true);
  assert.equal(isCheckViolation({ code: '23505' }), false);

  assert.equal(isForeignKeyViolation({ code: POSTGRES_ERROR_CODES.FOREIGN_KEY_VIOLATION }), true);
  assert.equal(isForeignKeyViolation({ code: 23503 }), true);
  assert.equal(isForeignKeyViolation({ code: '23505' }), false);

  assert.equal(isRlsOrPrivilegeViolation({ code: POSTGRES_ERROR_CODES.INSUFFICIENT_PRIVILEGE }), true);
  assert.equal(isRlsOrPrivilegeViolation({ code: 42501 }), true);
  assert.equal(isRlsOrPrivilegeViolation(new Error('no')), false);

  assert.equal(isNoRowsError({ code: POSTGREST_ERROR_CODES.NO_ROWS_RETURNED }), true);
  assert.equal(isNoRowsError({ code: 'PGRST116' }), true);
  assert.equal(isNoRowsError({ code: 'PGRST115' }), false);

  assert.equal(isPostgrestError({ name: 'PostgrestError', message: 'x' }), true);
  assert.equal(isPostgrestError({ message: 'm', code: 'c', details: 'd', hint: 'h' }), true);
  assert.equal(isPostgrestError({ message: 'only' }), false);
  assert.equal(isPostgrestError(null), false);
  assert.equal(isPostgrestError(123), false);
});

// ============================================================================
// Suite 3: format.ts Adversarial Stress-Tests
// ============================================================================

test('format: toDate handles edge dates and invalid values', () => {
  assert.equal(toDate(null), null);
  assert.equal(toDate(undefined), null);
  assert.equal(toDate(''), null);
  assert.equal(toDate('   '), null);
  assert.equal(toDate('not-a-date'), null);
  assert.equal(toDate(NaN), null);
  assert.equal(toDate(Infinity), null);
  assert.equal(toDate(-Infinity), null);

  // Epoch 0
  const epoch = toDate(0);
  assert.ok(epoch instanceof Date);
  assert.equal(epoch.getTime(), 0);

  // Negative timestamp (pre-1970)
  const preEpoch = toDate(-86400000);
  assert.ok(preEpoch instanceof Date);
  assert.equal(preEpoch.getTime(), -86400000);

  // Existing Date instance
  const d = new Date('2026-09-30T10:00:00Z');
  assert.equal(toDate(d), d);
});

test('format: formatTimeLabel 12-hour boundaries', () => {
  assert.equal(formatTimeLabel(new Date(2026, 8, 30, 0, 0)), '12:00am'); // midnight
  assert.equal(formatTimeLabel(new Date(2026, 8, 30, 0, 1)), '12:01am');
  assert.equal(formatTimeLabel(new Date(2026, 8, 30, 1, 0)), '1:00am');
  assert.equal(formatTimeLabel(new Date(2026, 8, 30, 11, 59)), '11:59am');
  assert.equal(formatTimeLabel(new Date(2026, 8, 30, 12, 0)), '12:00pm'); // noon
  assert.equal(formatTimeLabel(new Date(2026, 8, 30, 12, 1)), '12:01pm');
  assert.equal(formatTimeLabel(new Date(2026, 8, 30, 13, 0)), '1:00pm');
  assert.equal(formatTimeLabel(new Date(2026, 8, 30, 23, 59)), '11:59pm');

  assert.equal(formatTimeLabel(null), '');
  assert.equal(formatTimeLabel(undefined), '');
  assert.equal(formatTimeLabel('invalid'), '');
});

test('format: formatRelativeTime exact boundary transitions', () => {
  const now = new Date('2026-09-30T12:00:00.000Z');
  const nowMs = now.getTime();

  // Future timestamp
  assert.equal(formatRelativeTime(new Date(nowMs + 60000), now), 'Just now');
  assert.equal(formatRelativeTime(new Date(nowMs + 86400000), now), 'Just now');

  // Exact 0s
  assert.equal(formatRelativeTime(now, now), 'Just now');
  // 59 seconds ago
  assert.equal(formatRelativeTime(new Date(nowMs - 59000), now), 'Just now');
  // Exactly 60 seconds ago
  assert.equal(formatRelativeTime(new Date(nowMs - 60000), now), '1m ago');
  // 59 minutes 59 seconds ago
  assert.equal(formatRelativeTime(new Date(nowMs - (59 * 60 + 59) * 1000), now), '59m ago');
  // Exactly 60 minutes ago
  assert.equal(formatRelativeTime(new Date(nowMs - 60 * 60 * 1000), now), '1h ago');
  // 23 hours 59 minutes ago
  assert.equal(formatRelativeTime(new Date(nowMs - (23 * 3600 + 59 * 60) * 1000), now), '23h ago');
  // Exactly 24 hours ago
  assert.equal(formatRelativeTime(new Date(nowMs - 24 * 3600 * 1000), now), 'Yesterday');
  // 47 hours ago (still 1 day elapsed)
  assert.equal(formatRelativeTime(new Date(nowMs - 47 * 3600 * 1000), now), 'Yesterday');
  // Exactly 48 hours ago
  assert.equal(formatRelativeTime(new Date(nowMs - 48 * 3600 * 1000), now), '2d ago');
  // 6 days 23 hours ago
  assert.equal(formatRelativeTime(new Date(nowMs - (6 * 86400 + 23 * 3600) * 1000), now), '6d ago');
  // Exactly 7 days ago -> falls back to calendar date string
  const sevenDaysAgo = new Date(nowMs - 7 * 86400 * 1000);
  assert.ok(formatRelativeTime(sevenDaysAgo, now).length > 0);
  assert.notEqual(formatRelativeTime(sevenDaysAgo, now), '7d ago');

  // Invalid
  assert.equal(formatRelativeTime(null, now), '');
  assert.equal(formatRelativeTime('invalid', now), '');
});

test('format: formatCalendarTimestamp midnight cross and older dates', () => {
  // Midnight cross: today is 01:00, event was yesterday at 23:00 (2 hours ago)
  const todayEarly = new Date(2026, 8, 30, 1, 0, 0);
  const yesterdayLate = new Date(2026, 8, 29, 23, 0, 0);
  assert.equal(formatCalendarTimestamp(yesterdayLate, todayEarly), 'Yesterday at 11:00pm');

  // Same day earlier
  const todayNoon = new Date(2026, 8, 30, 12, 0, 0);
  const todayMorning = new Date(2026, 8, 30, 8, 30, 0);
  assert.equal(formatCalendarTimestamp(todayMorning, todayNoon), 'Today at 8:30am');

  // 10 days ago contains "at"
  const tenDaysAgo = new Date(2026, 8, 20, 15, 45, 0);
  const formattedOlder = formatCalendarTimestamp(tenDaysAgo, todayNoon);
  assert.ok(formattedOlder.includes('at 3:45pm'));

  // Invalid date
  assert.equal(formatCalendarTimestamp(null, todayNoon), '');
  assert.equal(formatCalendarTimestamp('invalid', todayNoon), '');
});

test('format: formatTimeRemaining boundary conditions', () => {
  const now = 1759233600000;

  // Past and exact current
  assert.equal(formatTimeRemaining(now - 10000, now), 'now');
  assert.equal(formatTimeRemaining(now, now), 'now');

  // Less than 1 minute
  assert.equal(formatTimeRemaining(now + 1000, now), '< 1m');
  assert.equal(formatTimeRemaining(now + 59999, now), '< 1m');

  // Exactly 60 seconds
  assert.equal(formatTimeRemaining(now + 60000, now), '1m');

  // 61 seconds (rounds up to 2m)
  assert.equal(formatTimeRemaining(now + 61000, now), '2m');

  // Exactly 1 hour
  assert.equal(formatTimeRemaining(now + 3600000, now), '1h');

  // 1 hour 1 minute
  assert.equal(formatTimeRemaining(now + 3660000, now), '1h 1m');

  // 23 hours 59 minutes
  assert.equal(formatTimeRemaining(now + (23 * 3600 + 59 * 60) * 1000, now), '23h 59m');

  // Multi-day
  assert.equal(formatTimeRemaining(now + 48 * 3600 * 1000, now), '48h');

  // Invalid
  assert.equal(formatTimeRemaining(null, now), '');
  assert.equal(formatTimeRemaining('invalid', now), '');
});

// ============================================================================
// Suite 4: unwrapSingleRelation Adversarial Stress-Tests
// ============================================================================

test('relation: unwrapSingleRelation handles deep edge cases and preserves falsy values', () => {
  // Nulls / undefined / empty
  assert.equal(unwrapSingleRelation(null), null);
  assert.equal(unwrapSingleRelation(undefined), null);
  assert.equal(unwrapSingleRelation([]), null);
  assert.equal(unwrapSingleRelation([null]), null);
  assert.equal(unwrapSingleRelation([undefined]), null);

  // Falsy primitive preservation
  assert.equal(unwrapSingleRelation(0), 0);
  assert.equal(unwrapSingleRelation([0]), 0);
  assert.equal(unwrapSingleRelation(false), false);
  assert.equal(unwrapSingleRelation([false]), false);
  assert.equal(unwrapSingleRelation(''), '');
  assert.equal(unwrapSingleRelation(['']), '');

  // Objects
  const entity = { id: 'entity-1', name: 'Test' };
  assert.deepEqual(unwrapSingleRelation(entity), entity);
  assert.deepEqual(unwrapSingleRelation([entity]), entity);
  assert.deepEqual(unwrapSingleRelation([entity, { id: 'entity-2' }]), entity);

  // Readonly arrays
  const readonlyArr = Object.freeze([{ id: 'ro' }]);
  assert.deepEqual(unwrapSingleRelation(readonlyArr), { id: 'ro' });

  // Nested structures
  const nested = [{ items: [1, 2, 3] }];
  assert.deepEqual(unwrapSingleRelation(nested), { items: [1, 2, 3] });
});

// ============================================================================
// Suite 5: constants Integrity Stress-Tests
// ============================================================================

test('constants: timing, limits, and storage constants are frozen or bounded correctly', () => {
  assert.ok(Timeouts.placeSearchEdgeFunctionMs > 0);
  assert.ok(Timeouts.deviceLocationMs > 0);
  assert.ok(Timeouts.avatarRefreshIntervalMs > 0);
  assert.ok(CacheTtl.signedUrlSeconds > 0);

  assert.ok(ImageLimits.maxProfileAvatarDimensionPx === 512);
  assert.ok(ImageLimits.maxAvatarSizeBytes === 2 * 1024 * 1024);
  assert.ok(ImageLimits.maxPostPhotos === 5);
  assert.ok(InputLimits.minUsernameLength < InputLimits.maxUsernameLength);
  assert.ok(PaginationLimits.feedPageSize > 0);
  assert.ok(PaginationLimits.notificationsPageSize > 0);

  assert.equal(StorageBuckets.avatars, 'avatars');
  assert.equal(StorageBuckets.postPhotos, 'post-photos');
  assert.equal(StorageKeys.recentPlaces('user-42'), 'outthere:recent-places:user-42');
  assert.equal(StorageKeys.discoveryAllowance('user-42'), 'outthere:discovery-allowance:user-42');
  assert.equal(DeepLinks.authCallbackUrl, 'outthere://auth/callback');
});
