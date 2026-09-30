/**
 * Centralized timestamp, relative date, calendar, and countdown formatters.
 * Consolidates duplicated formatting logic across feed (posts), notifications,
 * discover allowance, subscriptions, and profile.
 *
 * Pure TypeScript, zero external runtime dependencies.
 */

/**
 * Safely parses any date representation into a JavaScript Date object.
 * Returns null if the value is null, undefined, or an invalid date.
 */
export function toDate(value: string | Date | number | null | undefined): Date | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Formats a date into a 12-hour clock label (e.g. "10:30pm", "9:05am").
 * Returns an empty string if date is null or invalid.
 */
export function formatTimeLabel(date: string | Date | number | null | undefined): string {
  const d = toDate(date);
  if (!d) return '';

  const hours = d.getHours();
  const hour = hours % 12 || 12;
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hour}:${minutes}${hours >= 12 ? 'pm' : 'am'}`;
}

/**
 * Formats a timestamp into a calendar-relative string with time of day:
 * - Today at 10:30pm
 * - Yesterday at 9:05am
 * - 20 Sep at 10:30pm
 *
 * Used by feed posts, post cards, and comment threads.
 */
export function formatCalendarTimestamp(
  date: string | Date | number | null | undefined,
  now: Date | number = new Date()
): string {
  const d = toDate(date);
  if (!d) return '';

  const n = toDate(now) ?? new Date();
  const dateStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const nowStart = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
  const dayDifference = Math.round((nowStart - dateStart) / 86_400_000);
  const time = formatTimeLabel(d);

  if (dayDifference === 0) return `Today at ${time}`;
  if (dayDifference === 1) return `Yesterday at ${time}`;
  return `${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} at ${time}`;
}

/**
 * Alias for formatCalendarTimestamp for backward compatibility with feed-model.
 */
export const formatFeedTimestamp = formatCalendarTimestamp;

/**
 * Formats a timestamp into a concise elapsed relative time:
 * - < 1 min: "Just now"
 * - < 1 hour: "15m ago"
 * - < 24 hours: "3h ago"
 * - 1 day: "Yesterday"
 * - < 7 days: "4d ago"
 * - >= 7 days: "Sep 20"
 *
 * Used by notification list items and activity feeds.
 */
export function formatRelativeTime(
  date: string | Date | number | null | undefined,
  now: Date | number = new Date()
): string {
  const d = toDate(date);
  if (!d) return '';

  const n = toDate(now) ?? new Date();
  const diffMs = n.getTime() - d.getTime();
  if (diffMs < 0) return 'Just now';

  const diffSeconds = Math.floor(diffMs / 1000);
  if (diffSeconds < 60) return 'Just now';

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * Alias for formatRelativeTime for backward compatibility with notifications model.
 */
export const formatNotificationTime = formatRelativeTime;

/**
 * Formats a date into a localized calendar display date.
 * Default format: "20 Sep 2026" (en-GB day month year).
 *
 * Used for subscription renewal dates, member joined dates, etc.
 */
export function formatDisplayDate(
  date: string | Date | number | null | undefined,
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' },
  locale = 'en-GB'
): string {
  const d = toDate(date);
  if (!d) return '';
  return d.toLocaleDateString(locale, options);
}

/**
 * Formats remaining duration until a future target date (countdown):
 * - <= 0: "now"
 * - < 1m: "< 1m"
 * - "23h 45m"
 * - "2h"
 * - "35m"
 *
 * Used for discovery swipe allowance reset countdowns.
 */
export function formatTimeRemaining(
  resetsAt: string | Date | number | null | undefined,
  now: Date | number = Date.now()
): string {
  const target = toDate(resetsAt);
  if (!target) return '';

  const nowMs = typeof now === 'number' ? now : (toDate(now)?.getTime() ?? Date.now());
  const diffMs = target.getTime() - nowMs;
  if (diffMs <= 0) return 'now';
  if (diffMs < 60 * 1000) return '< 1m';

  const totalMinutes = Math.ceil(diffMs / (60 * 1000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return '< 1m';
}

/**
 * Formats the reset time of day (e.g. "12:00 PM" or "12:00").
 * Used for discovery swipe allowance daily reset time display.
 */
export function formatResetTime(
  resetsAt: string | Date | number | null | undefined,
  locale?: string
): string {
  const target = toDate(resetsAt);
  if (!target) return '';
  return target.toLocaleTimeString(locale ?? [], { hour: 'numeric', minute: '2-digit' });
}
