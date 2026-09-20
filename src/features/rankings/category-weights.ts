import { CATEGORY_GROUPS_BY_MODE, getCategoryKeysForPlace } from '../categories/catalog.ts';
import type { RankingMode } from './types';

export interface CategoryRating {
  rating: number;
  primaryType?: string | null;
}

export function calculateCategoryWeights(
  mode: RankingMode,
  ratings: readonly CategoryRating[],
): Record<string, number> {
  const scoresByCategory = new Map<string, number[]>();
  for (const group of CATEGORY_GROUPS_BY_MODE[mode]) scoresByCategory.set(group.key, []);

  for (const rating of ratings) {
    if (!Number.isFinite(rating.rating)) continue;
    for (const key of getCategoryKeysForPlace(mode, rating.primaryType)) {
      scoresByCategory.get(key)?.push(rating.rating);
    }
  }

  const weights: Record<string, number> = {};
  for (const [key, scores] of scoresByCategory) {
    if (!scores.length) continue;
    const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    weights[key] = Math.max(0, Math.min(1, Math.round((average / 10) * 100) / 100));
  }
  return weights;
}
