import { VIBE_CONFIGS, type Vibe } from './vibe-config.ts';

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
