import { formatCalendarTimestamp, formatTimeLabel } from '../../lib/format.ts';
import { InputLimits } from '../../constants/limits.ts';

export { formatCalendarTimestamp as formatFeedTimestamp, formatTimeLabel };

const PRICE_LEVELS: Record<string, number> = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

export function formatPlaceCategory(priceLevel: string | null, category: string | null): string {
  const price = priceLevel == null ? '' : '$'.repeat(PRICE_LEVELS[priceLevel] ?? 0);
  return [price, category?.trim()].filter(Boolean).join(' ');
}

export function formatLikeCount(count: number): string {
  if (count <= 0) return 'Be the first to like this';
  if (count === 1) return '1 person liked this';
  return `${count} others liked this`;
}

export function formatCommentCount(count: number): string {
  if (count <= 0) return '0 comments';
  if (count === 1) return '1 comment';
  return `${count} comments`;
}

export function validateCommentBody(text: string): { valid: boolean; error?: string } {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: 'Comment cannot be empty.' };
  }
  if (trimmed.length > InputLimits.maxCommentLength) {
    return { valid: false, error: 'Comment must be 1,000 characters or less.' };
  }
  return { valid: true };
}


export function labelForFeedScope(scope: 'explore' | 'following'): string {
  return scope === 'explore' ? 'Explore' : 'Following';
}

export function getFeedEmptyState(scope: 'explore' | 'following', error: string | null): { title: string; body: string } {
  if (error) {
    return {
      title: 'Couldn’t load the feed',
      body: 'Check your connection and try again.',
    };
  }
  if (scope === 'following') {
    return {
      title: 'No posts yet',
      body: 'Posts from profiles you follow will appear here.',
    };
  }
  return {
    title: 'No posts yet',
    body: 'Public posts from the community will appear here.',
  };
}

