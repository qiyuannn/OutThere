export type Vibe = 'loved' | 'liked' | 'fine' | 'disliked';

export interface VibeConfig {
  key: Vibe;
  label: string;
  icon: string;
  min: number;
  max: number;
  baseline: number;
  description: string;
}

export const VIBE_CONFIGS: Record<Vibe, VibeConfig> = {
  loved: {
    key: 'loved',
    label: 'Loved it!',
    icon: '🤩',
    min: 8.5,
    max: 10.0,
    baseline: 9.2,
    description: 'A standout favorite you’d rush back to',
  },
  liked: {
    key: 'liked',
    label: 'I liked it!',
    icon: '😊',
    min: 7.0,
    max: 8.4,
    baseline: 7.8,
    description: 'Solid, delicious, and would recommend',
  },
  fine: {
    key: 'fine',
    label: 'It was fine',
    icon: '😐',
    min: 5.0,
    max: 6.9,
    baseline: 6.0,
    description: 'Okay, but wouldn’t go out of your way',
  },
  disliked: {
    key: 'disliked',
    label: 'Didn’t like it',
    icon: '😕',
    min: 0.0,
    max: 4.9,
    baseline: 3.8,
    description: 'Disappointing or would not return',
  },
};

export interface ScoreTier {
  color: string;
  backgroundColor: string;
  textColor: string;
  label: string;
}

export function getScoreTier(score: number): ScoreTier {
  const s = Math.max(0.0, Math.min(10.0, Math.round(score * 10) / 10));
  if (s >= 9.0) {
    return {
      color: '#059669',
      backgroundColor: '#D1FAE5',
      textColor: '#065F46',
      label: 'Exceptional',
    };
  }
  if (s >= 8.0) {
    return {
      color: '#16A34A',
      backgroundColor: '#DCFCE7',
      textColor: '#166534',
      label: 'Great',
    };
  }
  if (s >= 7.0) {
    return {
      color: '#65A30D',
      backgroundColor: '#ECFCCB',
      textColor: '#3F6212',
      label: 'Good',
    };
  }
  if (s >= 6.0) {
    return {
      color: '#EA580C',
      backgroundColor: '#FFEDD5',
      textColor: '#9A3412',
      label: 'Average',
    };
  }
  return {
    color: '#DC2626',
    backgroundColor: '#FEE2E2',
    textColor: '#991B1B',
    label: 'Disappointing',
  };
}

export interface ComparisonItem {
  google_place_id: string;
  display_name: string;
  rating: number;
  photo_url?: string | null;
  category?: string | null;
}

/**
 * Initializes the binary search bounds for the given vibe bracket.
 * existingPlaces MUST be sorted descending by rating.
 */
export function getBracketBounds(
  existingPlaces: readonly { rating: number }[],
  vibe: Vibe,
): { low: number; high: number } {
  const config = VIBE_CONFIGS[vibe];
  if (existingPlaces.length === 0) {
    return { low: 0, high: -1 };
  }

  // Find the first index where rating <= config.max
  let low = 0;
  while (low < existingPlaces.length && existingPlaces[low].rating > config.max) {
    low++;
  }

  // Find the last index where rating >= config.min
  let high = existingPlaces.length - 1;
  while (high >= 0 && existingPlaces[high].rating < config.min) {
    high--;
  }

  return { low, high };
}

/**
 * Executes a single step of the binary search showdown.
 * @param choice 'new_better' | 'existing_better' | 'equal'
 */
export function stepComparison(
  choice: 'new_better' | 'existing_better' | 'equal',
  currentMid: number,
  low: number,
  high: number,
): {
  isDone: boolean;
  insertionIndex: number;
  nextMid: number | null;
  nextLow: number;
  nextHigh: number;
} {
  if (choice === 'equal') {
    // Places tie; insert right adjacent to currentMid
    return {
      isDone: true,
      insertionIndex: currentMid + 1,
      nextMid: null,
      nextLow: low,
      nextHigh: high,
    };
  }

  let nextLow = low;
  let nextHigh = high;

  if (choice === 'new_better') {
    // New place ranks above existing mid (closer to index 0)
    nextHigh = currentMid - 1;
  } else {
    // Existing place ranks above new place (closer to higher index)
    nextLow = currentMid + 1;
  }

  if (nextLow > nextHigh) {
    // Binary search has terminated!
    return {
      isDone: true,
      insertionIndex: nextLow,
      nextMid: null,
      nextLow,
      nextHigh,
    };
  }

  const nextMid = Math.floor((nextLow + nextHigh) / 2);
  return {
    isDone: false,
    insertionIndex: nextLow,
    nextMid,
    nextLow,
    nextHigh,
  };
}

export function inferVibeFromRating(rating: number): Vibe {
  const r = Math.max(0.0, Math.min(10.0, rating));
  if (r >= 8.5) return 'loved';
  if (r >= 7.0) return 'liked';
  if (r >= 5.0) return 'fine';
  return 'disliked';
}

export interface RecalibratedPlace {
  google_place_id: string;
  rating: number;
  vibe: Vibe;
}

export interface ListRecalibrationResult {
  newScore: number;
  updatedPlaces: RecalibratedPlace[];
  allRankedPlaces: Array<{ google_place_id: string; rating: number; vibe: Vibe }>;
}

/**
 * Distributes M items across a vibe tier [Vmin, Vmax] using continuous percentile mapping.
 * Ensures strict monotonicity and smooth spacing across the tier.
 */
export function recalibrateTierScores(count: number, vibe: Vibe): number[] {
  if (count <= 0) return [];
  const config = VIBE_CONFIGS[vibe];
  if (count === 1) {
    return [config.baseline];
  }

  const range = config.max - config.min;
  const maxDistinctSteps = Math.round(range * 10); // e.g. 1.4 -> 14 steps

  const scores: number[] = [];
  for (let i = 0; i < count; i++) {
    // Centered percentile rank: p_i in (0, 1)
    const percentile = (count - i - 0.5) / count;
    const rawScore = config.min + percentile * range;
    const rounded = Math.round(rawScore * 10) / 10;
    scores.push(Math.max(config.min, Math.min(config.max, rounded)));
  }

  // If count allows strictly distinct scores (0.1 increments), enforce strict inequality
  if (count <= maxDistinctSteps + 1) {
    // Backward pass to enforce scores[i] >= scores[i+1] + 0.1 where feasible
    for (let i = count - 2; i >= 0; i--) {
      if (scores[i] <= scores[i + 1]) {
        scores[i] = Math.min(config.max, Math.round((scores[i + 1] + 0.1) * 10) / 10);
      }
    }
    // Forward pass if clamped at max
    for (let i = 1; i < count; i++) {
      if (scores[i] >= scores[i - 1]) {
        scores[i] = Math.max(config.min, Math.round((scores[i - 1] - 0.1) * 10) / 10);
      }
    }
  } else {
    // Non-increasing monotonicity
    for (let i = 1; i < count; i++) {
      if (scores[i] > scores[i - 1]) {
        scores[i] = scores[i - 1];
      }
    }
  }

  return scores;
}

/**
 * Recalibrates the user's entire leaderboard when inserting a new place.
 * Dynamically compresses lower-ranked items and computes the new place's score.
 */
export function calculateListRecalibration(
  newPlaceId: string,
  insertionIndex: number,
  existingPlaces: readonly { google_place_id: string; rating: number; vibe?: Vibe }[],
  vibe: Vibe,
): ListRecalibrationResult {
  // 1. Build combined ordered list with new entry inserted at insertionIndex
  const safeIndex = Math.max(0, Math.min(existingPlaces.length, insertionIndex));
  const combined: Array<{ google_place_id: string; originalRating?: number; vibe: Vibe; rating: number }> = [];

  for (let i = 0; i < existingPlaces.length; i++) {
    if (i === safeIndex) {
      combined.push({
        google_place_id: newPlaceId,
        vibe,
        rating: 0,
      });
    }
    const p = existingPlaces[i];
    combined.push({
      google_place_id: p.google_place_id,
      originalRating: p.rating,
      vibe: p.vibe ?? inferVibeFromRating(p.rating),
      rating: p.rating,
    });
  }

  if (safeIndex >= existingPlaces.length) {
    combined.push({
      google_place_id: newPlaceId,
      vibe,
      rating: 0,
    });
  }

  // 2. Group by vibe tier preserving order
  const tierIndices: Record<Vibe, number[]> = {
    loved: [],
    liked: [],
    fine: [],
    disliked: [],
  };

  for (let i = 0; i < combined.length; i++) {
    tierIndices[combined[i].vibe].push(i);
  }

  // 3. Recalibrate each tier's scores
  const allVibes: Vibe[] = ['loved', 'liked', 'fine', 'disliked'];
  for (const v of allVibes) {
    const indices = tierIndices[v];
    if (indices.length === 0) continue;
    const tierScores = recalibrateTierScores(indices.length, v);
    for (let k = 0; k < indices.length; k++) {
      combined[indices[k]].rating = tierScores[k];
    }
  }

  // 4. Extract new place's score
  const newItem = combined.find((p) => p.google_place_id === newPlaceId);
  const newScore = newItem?.rating ?? VIBE_CONFIGS[vibe].baseline;

  // 5. Extract updated existing places
  const updatedPlaces: RecalibratedPlace[] = [];
  for (const p of combined) {
    if (p.google_place_id === newPlaceId) continue;
    if (p.originalRating !== undefined && Math.abs(p.rating - p.originalRating) >= 0.05) {
      updatedPlaces.push({
        google_place_id: p.google_place_id,
        rating: p.rating,
        vibe: p.vibe,
      });
    }
  }

  return {
    newScore,
    updatedPlaces,
    allRankedPlaces: combined.map((p) => ({
      google_place_id: p.google_place_id,
      rating: p.rating,
      vibe: p.vibe,
    })),
  };
}

/**
 * Computes the final numeric score (0.0 to 10.0) from the insertion index.
 */
export function computeFinalScore(
  insertionIndex: number,
  existingPlaces: readonly { rating: number; google_place_id?: string; vibe?: Vibe }[],
  vibe: Vibe,
): number {
  const normalizedPlaces = existingPlaces.map((p, idx) => ({
    google_place_id: p.google_place_id ?? `existing_${idx}`,
    rating: p.rating,
    vibe: p.vibe,
  }));
  const result = calculateListRecalibration('temp_new_place', insertionIndex, normalizedPlaces, vibe);
  return result.newScore;
}
