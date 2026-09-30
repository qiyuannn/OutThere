import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { routes } from '@/lib/routes';
import {
  formatNotificationAction,
  formatNotificationPreview,
  formatNotificationTime,
} from '../model';
import type { AppNotification } from '../types';
import { FollowRequestActions } from './follow-request-actions';
import { NotificationAvatar } from './notification-avatar';
import { rowStyles } from './notification-styles';

export interface NotificationRowProps {
  notification: AppNotification;
  isBusyFollowing: boolean;
  isBusyRespondingFollow?: boolean;
  onPress: () => void;
  onRespondFollow?: (status: 'accepted' | 'declined') => void;
  onToggleFollow: () => void;
}

export function NotificationRow({
  notification,
  isBusyFollowing,
  isBusyRespondingFollow = false,
  onPress,
  onRespondFollow,
  onToggleFollow,
}: NotificationRowProps) {
  const actionText = formatNotificationAction(notification);
  const previewText = formatNotificationPreview(notification);
  const timeText = formatNotificationTime(notification.createdAt);

  const openProfile = () => {
    if (notification.actorId) router.push(routes.userProfile(notification.actorId));
  };

  const showFollowBtn =
    notification.type === 'follow_accepted' ||
    (notification.type === 'follow' &&
      notification.followStatus !== 'pending' &&
      notification.followStatus !== 'declined');

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        notification.type === 'follow' && Boolean(notification.followStatus) && { alignItems: 'flex-start' },
        !notification.isRead && styles.unreadRow,
        pressed && rowStyles.pressed,
      ]}
    >
      <NotificationAvatar
        avatarUrl={notification.actorAvatarUrl}
        displayName={notification.actorDisplayName}
        onPress={openProfile}
      />

      <View style={styles.contentCol}>
        <ThemedText style={styles.messageText}>
          <ThemedText onPress={openProfile} style={styles.actorName}>
            {notification.actorDisplayName}
          </ThemedText>{' '}
          <ThemedText style={styles.actionText}>{actionText}</ThemedText>
        </ThemedText>

        {previewText ? (
          <ThemedText numberOfLines={2} style={styles.previewText}>
            {previewText}
          </ThemedText>
        ) : null}

        <ThemedText style={styles.timeText}>{timeText}</ThemedText>

        {notification.type === 'follow' ? (
          <FollowRequestActions
            followStatus={notification.followStatus}
            isBusyRespondingFollow={isBusyRespondingFollow}
            onRespondFollow={onRespondFollow}
          />
        ) : null}
      </View>

      {showFollowBtn ? (
        <Pressable
          accessibilityLabel={notification.isFollowingActor ? 'Following' : 'Follow back'}
          accessibilityRole="button"
          disabled={isBusyFollowing}
          onPress={(e) => {
            e.stopPropagation();
            onToggleFollow();
          }}
          style={({ pressed }) => [
            rowStyles.followBtn,
            notification.isFollowingActor ? rowStyles.followingBtn : rowStyles.followActiveBtn,
            pressed && rowStyles.pressed,
          ]}
        >
          <ThemedText
            style={[
              rowStyles.followBtnText,
              notification.isFollowingActor ? rowStyles.followingBtnText : rowStyles.followActiveBtnText,
            ]}
          >
            {notification.isFollowingActor ? 'Following' : 'Follow'}
          </ThemedText>
        </Pressable>
      ) : notification.postPhotoUrl ? (
        <Image
          accessibilityLabel="Post preview"
          contentFit="cover"
          source={notification.postPhotoUrl}
          style={styles.postThumbnail}
        />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0, 0, 0, 0.06)',
    backgroundColor: '#FFFFFF',
  },
  unreadRow: { backgroundColor: '#F9FAFB' },
  contentCol: { flex: 1, minWidth: 0, gap: 3 },
  messageText: { fontSize: 13, lineHeight: 18, color: '#000000' },
  actorName: { fontWeight: '700', color: '#000000' },
  actionText: { fontWeight: '400', color: '#1F2937' },
  previewText: { fontSize: 12, lineHeight: 16, color: '#4B5563', fontStyle: 'italic' },
  timeText: { fontSize: 11, lineHeight: 14, color: '#9CA3AF', marginTop: 1 },
  postThumbnail: { width: 44, height: 44, borderRadius: 6, backgroundColor: '#F3F4F6', flexShrink: 0 },
});
