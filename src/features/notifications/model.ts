import type { AppNotification } from './types';

export function formatNotificationAction(
  notification: Pick<AppNotification, 'type' | 'placeName'>
): string {
  switch (notification.type) {
    case 'follow':
      return 'started following you';
    case 'like':
      return notification.placeName
        ? `liked your review of ${notification.placeName}`
        : 'liked your post';
    case 'comment':
      return notification.placeName
        ? `commented on your review of ${notification.placeName}`
        : 'commented on your post';
    case 'invite':
      return notification.placeName
        ? `invited you to visit ${notification.placeName}`
        : 'invited you to plan an outing';
    case 'invite_accepted':
      return notification.placeName
        ? `accepted your invite to visit ${notification.placeName}`
        : 'accepted your invite';
    case 'invite_declined':
      return notification.placeName
        ? `declined your invite to visit ${notification.placeName}`
        : 'declined your invite';
  }
}



export function formatNotificationPreview(
  notification: Pick<AppNotification, 'type' | 'commentBody' | 'postBody'>
): string | null {
  if (notification.type === 'comment' && notification.commentBody?.trim()) {
    const trimmed = notification.commentBody.trim();
    return trimmed.length > 80 ? `${trimmed.slice(0, 80)}…` : trimmed;
  }
  if (notification.type === 'like' && notification.postBody?.trim()) {
    const trimmed = notification.postBody.trim();
    return trimmed.length > 80 ? `${trimmed.slice(0, 80)}…` : trimmed;
  }
  return null;
}

export function formatNotificationTime(isoDate: string, now = new Date()): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '';

  const diffMs = now.getTime() - date.getTime();
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

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function sortNotificationsWithInvitesFirst(
  notifications: AppNotification[]
): AppNotification[] {
  return [...notifications].sort((a, b) => {
    const aIsInvite = a.type === 'invite' ? 1 : 0;
    const bIsInvite = b.type === 'invite' ? 1 : 0;
    if (aIsInvite !== bIsInvite) {
      return bIsInvite - aIsInvite; // invites first
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export function partitionNotifications(notifications: AppNotification[]): {
  invites: AppNotification[];
  regular: AppNotification[];
} {
  const invites: AppNotification[] = [];
  const regular: AppNotification[] = [];

  for (const item of notifications) {
    if (item.type === 'invite') {
      invites.push(item);
    } else {
      regular.push(item);
    }
  }

  return { invites, regular };
}

