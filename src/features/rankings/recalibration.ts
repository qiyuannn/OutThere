import { inferVibeFromRating, VIBE_CONFIGS, type Vibe } from './vibe-config.ts';
import { recalibrateTierScores } from './tier-scoring.ts';

export interface RecalibratedPlace {
  google_place_id: string;
  rating: number;
  vibe: Vibe;
}

export interface ListRecalibrationResult {
  newScore: number;
  updatedPlaces: RecalibratedPlace[];
  allRankedPlaces: { google_place_id: string; rating: number; vibe: Vibe }[];
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
  const safeIndex = Math.max(0, Math.min(existingPlaces.length, insertionIndex));
  const combined: { google_place_id: string; originalRating?: number; vibe: Vibe; rating: number }[] = [];

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

  const tierIndices: Record<Vibe, number[]> = {
    loved: [],
    liked: [],
    fine: [],
    disliked: [],
  };

  for (let i = 0; i < combined.length; i++) {
    tierIndices[combined[i].vibe].push(i);
  }

  const allVibes: Vibe[] = ['loved', 'liked', 'fine', 'disliked'];
  for (const v of allVibes) {
    const indices = tierIndices[v];
    if (indices.length === 0) continue;
    const tierScores = recalibrateTierScores(indices.length, v);
    for (let k = 0; k < indices.length; k++) {
      combined[indices[k]].rating = tierScores[k];
    }
  }

  const newItem = combined.find((p) => p.google_place_id === newPlaceId);
  const newScore = newItem?.rating ?? VIBE_CONFIGS[vibe].baseline;

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
