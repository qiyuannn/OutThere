import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatNotificationAction,
  formatNotificationPreview,
  formatNotificationTime,
  partitionNotifications,
  sortNotificationsWithInvitesFirst,
} from '../src/features/notifications/model.ts';


test('formats notification actions correctly for follow, like, and comment', () => {
  assert.equal(
    formatNotificationAction({ type: 'follow', followStatus: 'pending', placeName: null }),
    'requested to follow you'
  );

  assert.equal(
    formatNotificationAction({ type: 'follow', followStatus: 'accepted', placeName: null }),
    'started following you'
  );

  assert.equal(
    formatNotificationAction({ type: 'follow', placeName: null }),
    'started following you'
  );

  assert.equal(
    formatNotificationAction({ type: 'follow_accepted', placeName: null }),
    'accepted your follow request'
  );

  assert.equal(
    formatNotificationAction({ type: 'like', placeName: 'Tartine Bakery' }),
    'liked your review of Tartine Bakery'
  );

  assert.equal(
    formatNotificationAction({ type: 'like', placeName: null }),
    'liked your post'
  );

  assert.equal(
    formatNotificationAction({ type: 'comment', placeName: 'Blue Bottle Coffee' }),
    'commented on your review of Blue Bottle Coffee'
  );

  assert.equal(
    formatNotificationAction({ type: 'comment', placeName: null }),
    'commented on your post'
  );
});

test('formats notification body previews and truncates long text', () => {
  assert.equal(
    formatNotificationPreview({ type: 'follow', commentBody: null, postBody: null }),
    null
  );

  assert.equal(
    formatNotificationPreview({
      type: 'comment',
      commentBody: 'Loved this recommendation so much!',
      postBody: null,
    }),
    'Loved this recommendation so much!'
  );

  const longComment = 'A'.repeat(100);
  assert.equal(
    formatNotificationPreview({
      type: 'comment',
      commentBody: longComment,
      postBody: null,
    }),
    `${'A'.repeat(80)}…`
  );

  assert.equal(
    formatNotificationPreview({
      type: 'like',
      commentBody: null,
      postBody: 'Short post body review',
    }),
    'Short post body review'
  );
});

test('formats relative notification timestamps', () => {
  const now = new Date(2026, 8, 26, 12, 0, 0);

  // 30 seconds ago
  const thirtySecsAgo = new Date(now.getTime() - 30 * 1000).toISOString();
  assert.equal(formatNotificationTime(thirtySecsAgo, now), 'Just now');

  // 15 minutes ago
  const fifteenMinsAgo = new Date(now.getTime() - 15 * 60 * 1000).toISOString();
  assert.equal(formatNotificationTime(fifteenMinsAgo, now), '15m ago');

  // 3 hours ago
  const threeHoursAgo = new Date(now.getTime() - 3 * 3600 * 1000).toISOString();
  assert.equal(formatNotificationTime(threeHoursAgo, now), '3h ago');

  // 1 day ago
  const oneDayAgo = new Date(now.getTime() - 25 * 3600 * 1000).toISOString();
  assert.equal(formatNotificationTime(oneDayAgo, now), 'Yesterday');

  // 4 days ago
  const fourDaysAgo = new Date(now.getTime() - 4 * 24 * 3600 * 1000).toISOString();
  assert.equal(formatNotificationTime(fourDaysAgo, now), '4d ago');
});

test('formats invite notification actions correctly', () => {
  assert.equal(
    formatNotificationAction({ type: 'invite', placeName: 'Kinoya' }),
    'invited you to visit Kinoya'
  );

  assert.equal(
    formatNotificationAction({ type: 'invite', placeName: null }),
    'invited you to plan an outing'
  );

  assert.equal(
    formatNotificationAction({ type: 'invite_accepted', placeName: 'Kinoya' }),
    'accepted your invite to visit Kinoya'
  );

  assert.equal(
    formatNotificationAction({ type: 'invite_accepted', placeName: null }),
    'accepted your invite'
  );

  assert.equal(
    formatNotificationAction({ type: 'invite_declined', placeName: 'Kinoya' }),
    'declined your invite to visit Kinoya'
  );

  assert.equal(
    formatNotificationAction({ type: 'invite_declined', placeName: null }),
    'declined your invite'
  );
});


test('sortNotificationsWithInvitesFirst and partitionNotifications place invites at the top', () => {
  const followNotification = {
    id: 1,
    type: 'follow',
    createdAt: '2026-09-26T03:00:00Z',
  };
  const likeNotification = {
    id: 2,
    type: 'like',
    createdAt: '2026-09-26T03:10:00Z',
  };
  const inviteNotification = {
    id: 3,
    type: 'invite',
    createdAt: '2026-09-26T02:00:00Z',
  };

  const list = [followNotification, likeNotification, inviteNotification];
  const sorted = sortNotificationsWithInvitesFirst(list);

  // Invite is first, even though its timestamp is earlier
  assert.equal(sorted[0].id, 3);
  assert.equal(sorted[1].id, 2);
  assert.equal(sorted[2].id, 1);

  const { invites, regular } = partitionNotifications(list);
  assert.equal(invites.length, 1);
  assert.equal(invites[0].id, 3);
  assert.equal(regular.length, 2);
});

