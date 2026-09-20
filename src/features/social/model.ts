import type { SocialNotification, SocialSummary } from './types';

export const SOCIAL_PAGE_SIZE = 20;

export function visiblePage<T>(items: T[]): T[] {
  return items.slice(0, SOCIAL_PAGE_SIZE);
}

export function hasNextSocialPage(items: unknown[]): boolean {
  return items.length > SOCIAL_PAGE_SIZE;
}

export function mergeSocialPage<T extends { id: string }>(current: T[], next: T[]): T[] {
  const ids = new Set(current.map((item) => item.id));
  return [...current, ...next.filter((item) => !ids.has(item.id))];
}

export function normalizeSocialSummary(value: Partial<SocialSummary> | null): SocialSummary {
  return {
    enabled: value?.enabled === true,
    friends: Math.max(0, Number(value?.friends) || 0),
    incoming: Math.max(0, Number(value?.incoming) || 0),
    outgoing: Math.max(0, Number(value?.outgoing) || 0),
    unread: Math.max(0, Number(value?.unread) || 0),
  };
}

export function notificationMessage(kind: SocialNotification['kind']): string {
  return {
    request: 'sent you a friend request',
    accepted: 'accepted your friend request',
    like: 'liked your rating',
    comment: 'commented on your rating',
  }[kind];
}

export function socialError(error: unknown): string {
  const value = error && typeof error === 'object' ? error as { code?: unknown; message?: unknown } : null;
  const code = typeof value?.code === 'string' ? value.code : '';
  const message = error instanceof Error ? error.message : typeof value?.message === 'string' ? value.message : '';
  if (code === '42501' || /profile unavailable|private|permission/i.test(message)) return 'This profile or post is no longer available.';
  if (/network|fetch|timeout/i.test(message)) return 'Check your connection and try again.';
  if (code === 'PGRST202') return 'Social features are not available on this server yet.';
  const safeValidation = [
    /^Choose (another person|a valid audience|valid privacy settings|an available person)\.?$/,
    /^Complete your profile first\.$/,
    /^Enable your social profile[^.]*\.$/,
    /^Connection unavailable\.$/,
    /^Request is no longer available\.$/,
    /^Comments must be 1–1000 characters\.$/,
    /^Please wait before posting more comments\.$/,
  ];
  if (code === 'P0001' && safeValidation.some((pattern) => pattern.test(message))) return message;
  return 'Could not update social activity. Try again.';
}
