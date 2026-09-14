import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getScoreTier,
  getBracketBounds,
  stepComparison,
  computeFinalScore,
  recalibrateTierScores,
  calculateListRecalibration,
  inferVibeFromRating,
  VIBE_CONFIGS,
} from '../src/features/rankings/comparison.ts';

test('getScoreTier classifies scores into authentic Beli color tiers', () => {
  // 9.0 - 10.0: Deep Emerald
  const t10 = getScoreTier(10.0);
  assert.equal(t10.label, 'Exceptional');
  assert.equal(t10.color, '#059669');

  const t92 = getScoreTier(9.2);
  assert.equal(t92.label, 'Exceptional');

  // 8.0 - 8.9: Vibrant Green
  const t85 = getScoreTier(8.5);
  assert.equal(t85.label, 'Great');
  assert.equal(t85.color, '#16A34A');

  // 7.0 - 7.9: Lime
  const t74 = getScoreTier(7.4);
  assert.equal(t74.label, 'Good');
  assert.equal(t74.color, '#65A30D');

  // 6.0 - 6.9: Amber/Orange
  const t65 = getScoreTier(6.5);
  assert.equal(t65.label, 'Average');
  assert.equal(t65.color, '#EA580C');

  // < 6.0: Red
  const t42 = getScoreTier(4.2);
  assert.equal(t42.label, 'Disappointing');
  assert.equal(t42.color, '#DC2626');
});

test('getBracketBounds isolates correct search range in sorted rankings', () => {
  const existing = [
    { rating: 9.6 }, // 0
    { rating: 9.1 }, // 1
    { rating: 8.7 }, // 2
    { rating: 8.2 }, // 3
    { rating: 7.5 }, // 4
    { rating: 6.0 }, // 5
    { rating: 4.5 }, // 6
  ];

  // 'loved': range 8.5 to 10.0 -> indices 0 to 2
  const lovedBounds = getBracketBounds(existing, 'loved');
  assert.equal(lovedBounds.low, 0);
  assert.equal(lovedBounds.high, 2);

  // 'liked': range 7.0 to 8.4 -> indices 3 to 4
  const likedBounds = getBracketBounds(existing, 'liked');
  assert.equal(likedBounds.low, 3);
  assert.equal(likedBounds.high, 4);

  // 'fine': range 5.0 to 6.9 -> index 5
  const fineBounds = getBracketBounds(existing, 'fine');
  assert.equal(fineBounds.low, 5);
  assert.equal(fineBounds.high, 5);

  // 'disliked': range 0.0 to 4.9 -> index 6
  const dislikedBounds = getBracketBounds(existing, 'disliked');
  assert.equal(dislikedBounds.low, 6);
  assert.equal(dislikedBounds.high, 6);

  // Empty list returns invalid bounds low > high
  const emptyBounds = getBracketBounds([], 'loved');
  assert.ok(emptyBounds.low > emptyBounds.high);
});

test('stepComparison executes binary search convergence accurately', () => {
  // Search range: low = 0, high = 2 (mid = 1)
  const step1 = stepComparison('new_better', 1, 0, 2);
  assert.equal(step1.isDone, false);
  assert.equal(step1.nextLow, 0);
  assert.equal(step1.nextHigh, 0);
  assert.equal(step1.nextMid, 0);

  // Step 2: compares with 0; user says existing is better
  const step2 = stepComparison('existing_better', 0, 0, 0);
  assert.equal(step2.isDone, true);
  assert.equal(step2.insertionIndex, 1); // inserted at index 1 (between 0 and 1)

  // Test tie / equal choice terminates immediately
  const tieStep = stepComparison('equal', 3, 0, 6);
  assert.equal(tieStep.isDone, true);
  assert.equal(tieStep.insertionIndex, 4);
});

test('recalibrateTierScores produces strictly monotonic and bounded scores', () => {
  // Empty tier -> []
  assert.deepEqual(recalibrateTierScores(0, 'liked'), []);

  // 1 item -> baseline
  assert.deepEqual(recalibrateTierScores(1, 'loved'), [9.2]);
  assert.deepEqual(recalibrateTierScores(1, 'liked'), [7.8]);
  assert.deepEqual(recalibrateTierScores(1, 'fine'), [6.0]);
  assert.deepEqual(recalibrateTierScores(1, 'disliked'), [3.8]);

  // Multiple items in liked tier (7.0 - 8.4)
  const liked5 = recalibrateTierScores(5, 'liked');
  assert.equal(liked5.length, 5);
  for (let i = 0; i < liked5.length; i++) {
    assert.ok(liked5[i] >= 7.0 && liked5[i] <= 8.4, `Score ${liked5[i]} within bounds`);
    if (i > 0) {
      assert.ok(liked5[i - 1] > liked5[i], `Strict monotonicity: ${liked5[i - 1]} > ${liked5[i]}`);
    }
  }

  // Check loved tier (8.5 - 10.0)
  const loved3 = recalibrateTierScores(3, 'loved');
  assert.equal(loved3.length, 3);
  assert.ok(loved3[0] > loved3[1] && loved3[1] > loved3[2]);
  assert.ok(loved3[0] <= 10.0 && loved3[2] >= 8.5);
});

test('calculateListRecalibration dynamically compresses scores upon insertion', () => {
  const existing = [
    { google_place_id: 'place_a', rating: 8.0, vibe: 'liked' },
    { google_place_id: 'place_b', rating: 7.4, vibe: 'liked' },
  ];

  // Insert place_new between place_a and place_b (index 1)
  const result = calculateListRecalibration('place_new', 1, existing, 'liked');

  // Check new score is between top and bottom of liked tier
  assert.ok(result.newScore >= 7.0 && result.newScore <= 8.4);

  // Total places should now be 3
  assert.equal(result.allRankedPlaces.length, 3);
  const [first, second, third] = result.allRankedPlaces;
  assert.equal(first.google_place_id, 'place_a');
  assert.equal(second.google_place_id, 'place_new');
  assert.equal(third.google_place_id, 'place_b');

  // Verify strict monotonicity across list
  assert.ok(first.rating > second.rating, `Rank 1 (${first.rating}) > Rank 2 (${second.rating})`);
  assert.ok(second.rating > third.rating, `Rank 2 (${second.rating}) > Rank 3 (${third.rating})`);

  // Existing places should be marked in updatedPlaces if their score adjusted
  assert.ok(result.updatedPlaces.length > 0);
});

test('computeFinalScore calculates calibrated scores for empty and existing lists', () => {
  // Empty list -> returns baseline
  assert.equal(computeFinalScore(0, [], 'loved'), VIBE_CONFIGS.loved.baseline);
  assert.equal(computeFinalScore(0, [], 'liked'), VIBE_CONFIGS.liked.baseline);

  const existing = [
    { google_place_id: 'p1', rating: 9.4, vibe: 'loved' },
    { google_place_id: 'p2', rating: 8.8, vibe: 'loved' },
    { google_place_id: 'p3', rating: 8.2, vibe: 'liked' },
    { google_place_id: 'p4', rating: 7.0, vibe: 'liked' },
  ];

  // New #1 in loved tier -> top score
  const newTop = computeFinalScore(0, existing, 'loved');
  assert.ok(newTop >= 9.5 && newTop <= 10.0);

  // Inserted between loved spots
  const betweenTop = computeFinalScore(1, existing, 'loved');
  assert.ok(betweenTop >= 8.5 && betweenTop <= 9.5);

  // Inserted in liked tier at bottom
  const bottom = computeFinalScore(4, existing, 'liked');
  assert.ok(bottom >= VIBE_CONFIGS.liked.min && bottom <= 7.5);
});
