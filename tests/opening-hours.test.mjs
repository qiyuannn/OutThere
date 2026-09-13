import test from 'node:test';
import assert from 'node:assert/strict';
import { computeIsOpenNow } from '../src/lib/opening-hours.ts';

test('returns null when opening hours are empty, null or undefined', () => {
  assert.equal(computeIsOpenNow(null), null);
  assert.equal(computeIsOpenNow(undefined), null);
  assert.equal(computeIsOpenNow([]), null);
});

test('handles standard daytime business hours', () => {
  const schedule = [
    'Monday: 9:00 AM – 5:00 PM',
    'Tuesday: 9:00 AM – 5:00 PM',
    'Wednesday: 9:00 AM – 5:00 PM',
    'Thursday: 9:00 AM – 5:00 PM',
    'Friday: 9:00 AM – 5:00 PM',
    'Saturday: 10:00 AM – 4:00 PM',
    'Sunday: Closed',
  ];

  // Monday 8:59 AM -> closed
  assert.equal(computeIsOpenNow(schedule, new Date('2026-09-14T08:59:00')), false); // Sept 14, 2026 is Monday
  // Monday 9:00 AM -> open
  assert.equal(computeIsOpenNow(schedule, new Date('2026-09-14T09:00:00')), true);
  // Monday 12:30 PM -> open
  assert.equal(computeIsOpenNow(schedule, new Date('2026-09-14T12:30:00')), true);
  // Monday 4:59 PM -> open
  assert.equal(computeIsOpenNow(schedule, new Date('2026-09-14T16:59:00')), true);
  // Monday 5:00 PM -> closed
  assert.equal(computeIsOpenNow(schedule, new Date('2026-09-14T17:00:00')), false);
  // Sunday 2:00 PM -> closed
  assert.equal(computeIsOpenNow(schedule, new Date('2026-09-13T14:00:00')), false); // Sept 13, 2026 is Sunday
});

test('handles 24 hours places', () => {
  const schedule = [
    'Monday: Open 24 hours',
    'Tuesday: Open 24 hours',
    'Wednesday: Open 24 hours',
    'Thursday: Open 24 hours',
    'Friday: Open 24 hours',
    'Saturday: Open 24 hours',
    'Sunday: Open 24 hours',
  ];

  assert.equal(computeIsOpenNow(schedule, new Date('2026-09-14T03:00:00')), true);
  assert.equal(computeIsOpenNow(schedule, new Date('2026-09-14T23:59:00')), true);
});

test('handles split shifts (lunch and dinner)', () => {
  const schedule = [
    'Monday: 11:30 AM – 2:30 PM, 5:30 PM – 10:00 PM',
  ];

  // Monday 11:00 AM -> closed
  assert.equal(computeIsOpenNow(schedule, new Date('2026-09-14T11:00:00')), false);
  // Monday 12:00 PM -> open
  assert.equal(computeIsOpenNow(schedule, new Date('2026-09-14T12:00:00')), true);
  // Monday 3:30 PM -> closed
  assert.equal(computeIsOpenNow(schedule, new Date('2026-09-14T15:30:00')), false);
  // Monday 6:00 PM -> open
  assert.equal(computeIsOpenNow(schedule, new Date('2026-09-14T18:00:00')), true);
  // Monday 10:30 PM -> closed
  assert.equal(computeIsOpenNow(schedule, new Date('2026-09-14T22:30:00')), false);
});

test('handles overnight hours crossing midnight', () => {
  const schedule = [
    'Friday: 6:00 PM – 2:00 AM',
    'Saturday: 12:00 PM – 11:00 PM',
    'Sunday: Closed',
  ];

  // Friday 7:00 PM -> open (Friday schedule)
  assert.equal(computeIsOpenNow(schedule, new Date('2026-09-18T19:00:00')), true); // Sept 18 is Friday
  // Friday 11:59 PM -> open
  assert.equal(computeIsOpenNow(schedule, new Date('2026-09-18T23:59:00')), true);
  // Saturday 1:30 AM -> open (spillover from Friday)
  assert.equal(computeIsOpenNow(schedule, new Date('2026-09-19T01:30:00')), true); // Sept 19 is Saturday
  // Saturday 2:00 AM -> closed
  assert.equal(computeIsOpenNow(schedule, new Date('2026-09-19T02:00:00')), false);
  // Saturday 10:00 AM -> closed
  assert.equal(computeIsOpenNow(schedule, new Date('2026-09-19T10:00:00')), false);
  // Saturday 1:00 PM -> open (Saturday schedule)
  assert.equal(computeIsOpenNow(schedule, new Date('2026-09-19T13:00:00')), true);
});
