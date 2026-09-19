import test from 'node:test';
import assert from 'node:assert/strict';

import { formatFeedTimestamp, formatLikeCount, formatPlaceCategory } from '../src/features/posts/feed-model.ts';

test('formats feed timestamps relative to the current local day', () => {
  const now = new Date(2026, 8, 20, 12, 0);
  assert.equal(formatFeedTimestamp(new Date(2026, 8, 20, 22, 30).toISOString(), now), 'Today at 10:30pm');
  assert.equal(formatFeedTimestamp(new Date(2026, 8, 19, 9, 5).toISOString(), now), 'Yesterday at 9:05am');
});

test('formats place and like metadata used by feed cards', () => {
  assert.equal(formatPlaceCategory('PRICE_LEVEL_MODERATE', 'American Restaurant'), '$$ American Restaurant');
  assert.equal(formatPlaceCategory(null, 'Museum'), 'Museum');
  assert.equal(formatLikeCount(0), 'Be the first to like this');
  assert.equal(formatLikeCount(1), '1 person liked this');
  assert.equal(formatLikeCount(4), '4 others liked this');
});
