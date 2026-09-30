import type { AppNotification } from './types';

export function formatNotificationAction(
  notification: Pick<AppNotification, 'type' | 'placeName'> & { followStatus?: AppNotification['followStatus'] }
): string {
  switch (notification.type) {
    case 'follow':
      return notification.followStatus === 'pending'
        ? 'requested to follow you'
        : 'started following you';
    case 'follow_accepted':
      return 'accepted your follow request';
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

export { formatRelativeTime as formatNotificationTime } from '../../lib/format.ts';


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

