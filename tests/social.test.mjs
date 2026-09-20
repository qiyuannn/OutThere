import test from 'node:test';
import assert from 'node:assert/strict';

import {
  hasNextSocialPage,
  mergeSocialPage,
  normalizeSocialSummary,
  notificationMessage,
  socialPagePayload,
  socialError,
  validReportTarget,
  visiblePage,
} from '../src/features/social/model.ts';

test('social pagination requests one extra row and removes it from the visible page', () => {
  const rows = Array.from({ length: 21 }, (_, index) => ({ id: String(index) }));
  assert.equal(hasNextSocialPage(rows), true);
  assert.equal(visiblePage(rows).length, 20);
  assert.equal(hasNextSocialPage(rows.slice(0, 20)), false);
});

test('social pagination does not duplicate rows after a refresh or overlapping cursor page', () => {
  const merged = mergeSocialPage([{ id: 'a' }, { id: 'b' }], [{ id: 'b' }, { id: 'c' }]);
  assert.deepEqual(merged.map(({ id }) => id), ['a', 'b', 'c']);
});

test('friends use offset pagination while notifications and comments use stable cursors', () => {
  const current = [{ id: 'last-id', created_at: '2026-09-21T00:00:00Z' }];
  assert.deepEqual(socialPagePayload({ mode: 'friends' }, current, true, true), { mode: 'friends', offset: 1 });
  assert.deepEqual(socialPagePayload({ post_id: 'post-1' }, current, true, false), {
    post_id: 'post-1', before: current[0].created_at, before_id: 'last-id',
  });
});

test('social summary accepts Postgres JSON counts and guards malformed values', () => {
  assert.deepEqual(normalizeSocialSummary({ enabled: true, friends: '4', incoming: 2 }), {
    enabled: true, friends: 4, incoming: 2, outgoing: 0, unread: 0,
  });
  assert.equal(normalizeSocialSummary({ unread: -2 }).unread, 0);
  assert.equal(normalizeSocialSummary({ friends: 'not-a-number' }).friends, 0);
});

test('each supported notification has user-facing copy', () => {
  assert.equal(notificationMessage('request'), 'sent you a friend request');
  assert.equal(notificationMessage('accepted'), 'accepted your friend request');
  assert.equal(notificationMessage('like'), 'liked your rating');
  assert.equal(notificationMessage('comment'), 'commented on your rating');
});

test('social errors preserve deliberate validation but hide database details', () => {
  assert.equal(socialError({ code: 'P0001', message: 'Comments must be 1–1000 characters.' }), 'Comments must be 1–1000 characters.');
  assert.match(socialError({ code: '42501', message: 'internal policy details' }), /no longer available/);
  assert.match(socialError(new Error('fetch failed')), /connection/);
  assert.doesNotMatch(socialError({ code: 'P0001', message: 'private table social_private.settings failed' }), /social_private/);
});

test('report routes accept only supported social target types', () => {
  assert.equal(validReportTarget('user'), true);
  assert.equal(validReportTarget('post'), true);
  assert.equal(validReportTarget('comment'), true);
  assert.equal(validReportTarget('message'), false);
});
