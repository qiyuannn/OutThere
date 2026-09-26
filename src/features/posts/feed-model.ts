const PRICE_LEVELS: Record<string, number> = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

function timeLabel(date: Date) {
  const hours = date.getHours();
  const hour = hours % 12 || 12;
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hour}:${minutes}${hours >= 12 ? 'pm' : 'am'}`;
}

export function formatFeedTimestamp(value: string, now = new Date()): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const nowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dayDifference = Math.round((nowStart - dateStart) / 86_400_000);
  if (dayDifference === 0) return `Today at ${timeLabel(date)}`;
  if (dayDifference === 1) return `Yesterday at ${timeLabel(date)}`;
  return `${date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} at ${timeLabel(date)}`;
}

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
  if (trimmed.length > 1000) {
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

