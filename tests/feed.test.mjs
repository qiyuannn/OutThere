import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatCommentCount,
  formatFeedTimestamp,
  formatLikeCount,
  formatPlaceCategory,
  getFeedEmptyState,
  labelForFeedScope,
  validateCommentBody,
} from '../src/features/posts/feed-model.ts';

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

test('formats comment counts and validates comment bodies', () => {
  assert.equal(formatCommentCount(0), '0 comments');
  assert.equal(formatCommentCount(1), '1 comment');
  assert.equal(formatCommentCount(5), '5 comments');

  assert.deepEqual(validateCommentBody(''), { valid: false, error: 'Comment cannot be empty.' });
  assert.deepEqual(validateCommentBody('   '), { valid: false, error: 'Comment cannot be empty.' });
  assert.deepEqual(validateCommentBody('Great place!'), { valid: true });
  assert.deepEqual(validateCommentBody('a'.repeat(1001)), {
    valid: false,
    error: 'Comment must be 1,000 characters or less.',
  });
});

test('provides correct feed scope labels and empty states for explore and following', () => {
  assert.equal(labelForFeedScope('explore'), 'Explore');
  assert.equal(labelForFeedScope('following'), 'Following');

  assert.deepEqual(getFeedEmptyState('explore', null), {
    title: 'No posts yet',
    body: 'Public posts from the community will appear here.',
  });

  assert.deepEqual(getFeedEmptyState('following', null), {
    title: 'No posts yet',
    body: 'Posts from profiles you follow will appear here.',
  });

  assert.deepEqual(getFeedEmptyState('explore', 'Network timeout'), {
    title: 'Couldn’t load the feed',
    body: 'Check your connection and try again.',
  });

  assert.deepEqual(getFeedEmptyState('following', 'Network timeout'), {
    title: 'Couldn’t load the feed',
    body: 'Check your connection and try again.',
  });
});

