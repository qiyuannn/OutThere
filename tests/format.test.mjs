import test from 'node:test';
import assert from 'node:assert/strict';

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

test('toDate handles Date, string, number, null, undefined, invalid', () => {
  const d = new Date('2026-09-20T12:00:00.000Z');
  assert.equal(toDate(d), d);
  assert.equal(toDate(d.toISOString())?.getTime(), d.getTime());
  assert.equal(toDate(d.getTime())?.getTime(), d.getTime());
  assert.equal(toDate(null), null);
  assert.equal(toDate(undefined), null);
  assert.equal(toDate('invalid date string'), null);
});

test('formatTimeLabel formats 12-hour am/pm time correctly', () => {
  assert.equal(formatTimeLabel(new Date(2026, 8, 20, 22, 30)), '10:30pm');
  assert.equal(formatTimeLabel(new Date(2026, 8, 20, 9, 5)), '9:05am');
  assert.equal(formatTimeLabel(new Date(2026, 8, 20, 0, 0)), '12:00am');
  assert.equal(formatTimeLabel(new Date(2026, 8, 20, 12, 0)), '12:00pm');
  assert.equal(formatTimeLabel(null), '');
});

test('formatFeedTimestamp / formatCalendarTimestamp passes feed expectations', () => {
  const now = new Date(2026, 8, 20, 12, 0);
  assert.equal(formatFeedTimestamp(new Date(2026, 8, 20, 22, 30).toISOString(), now), 'Today at 10:30pm');
  assert.equal(formatFeedTimestamp(new Date(2026, 8, 19, 9, 5).toISOString(), now), 'Yesterday at 9:05am');
  assert.equal(formatFeedTimestamp(null, now), '');
  assert.equal(formatFeedTimestamp('invalid', now), '');
});

test('formatRelativeTime / formatNotificationTime passes notification time expectations', () => {
  const now = new Date(2026, 8, 26, 12, 0, 0);

  // 30 seconds ago
  const thirtySecsAgo = new Date(now.getTime() - 30 * 1000).toISOString();
  assert.equal(formatNotificationTime(thirtySecsAgo, now), 'Just now');

  // 15 minutes ago
  const fifteenMinsAgo = new Date(now.getTime() - 15 * 60 * 1000).toISOString();
  assert.equal(formatNotificationTime(fifteenMinsAgo, now), '15m ago');

  // 3 hours ago
  const threeHoursAgo = new Date(now.getTime() - 3 * 3600 * 1000).toISOString();
  assert.equal(formatNotificationTime(threeHoursAgo, now), '3h ago');

  // 1 day ago
  const oneDayAgo = new Date(now.getTime() - 25 * 3600 * 1000).toISOString();
  assert.equal(formatNotificationTime(oneDayAgo, now), 'Yesterday');

  // 4 days ago
  const fourDaysAgo = new Date(now.getTime() - 4 * 24 * 3600 * 1000).toISOString();
  assert.equal(formatNotificationTime(fourDaysAgo, now), '4d ago');

  // Future timestamp
  const future = new Date(now.getTime() + 10 * 1000).toISOString();
  assert.equal(formatNotificationTime(future, now), 'Just now');

  // Invalid / null
  assert.equal(formatNotificationTime(null, now), '');
  assert.equal(formatNotificationTime('invalid', now), '');
});

test('formatDisplayDate formats localized dates', () => {
  const d = new Date(2026, 8, 20); // Sep 20 2026
  assert.equal(formatDisplayDate(d), '20 Sept 2026'); // en-GB format check
  assert.equal(formatDisplayDate(null), '');
  assert.equal(formatDisplayDate('invalid'), '');
});

test('formatTimeRemaining formats countdowns correctly', () => {
  const now = new Date('2026-09-20T12:00:00.000Z').getTime();
  assert.equal(formatTimeRemaining(null, now), '');
  const t1 = new Date(now + 23 * 3600 * 1000 + 45 * 60 * 1000);
  assert.equal(formatTimeRemaining(t1, now), '23h 45m');
  const t2 = new Date(now + 2 * 3600 * 1000);
  assert.equal(formatTimeRemaining(t2, now), '2h');
  const t3 = new Date(now + 35 * 60 * 1000);
  assert.equal(formatTimeRemaining(t3, now), '35m');
  const t4 = new Date(now + 30 * 1000);
  assert.equal(formatTimeRemaining(t4, now), '< 1m');
  const t5 = new Date(now - 1000);
  assert.equal(formatTimeRemaining(t5, now), 'now');
});

test('formatResetTime formats time string', () => {
  const d = new Date('2026-09-20T12:00:00.000Z');
  assert.ok(formatResetTime(d).length > 0);
  assert.equal(formatResetTime(null), '');
});
