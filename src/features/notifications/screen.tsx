import { useCallback, useEffect, useRef, useState } from 'react';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/app-header';
import { ThemedText } from '@/components/themed-text';
import { followUser, unfollowUser } from '@/features/profile/service';
import { useAuth } from '@/providers/auth-provider';
import { useNotifications } from '@/providers/notifications-provider';
import {
  formatNotificationAction,
  formatNotificationPreview,
  formatNotificationTime,
  partitionNotifications,
} from './model';
import {
  getUserNotifications,
  respondToFollowRequest,
  respondToPlaceInvite,
} from './service';
import type { AppNotification } from './types';

export default function NotificationsScreen() {
  const { session } = useAuth();
  const currentUserId = session?.user.id;
  const { markAllRead } = useNotifications();

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [followProcessing, setFollowProcessing] = useState<Set<string>>(new Set());
  const [inviteProcessing, setInviteProcessing] = useState<Set<number>>(new Set());
  const [followRespondProcessing, setFollowRespondProcessing] = useState<Set<number>>(new Set());

  const requestCount = useRef(0);

  const loadNotifications = useCallback(async () => {
    if (!currentUserId) {
      setLoading(false);
      return;
    }
    const reqId = ++requestCount.current;
    setError(null);
    try {
      const items = await getUserNotifications(50, 0);
      if (reqId === requestCount.current) {
        setNotifications(items);
        void markAllRead();
      }
    } catch (err) {
      if (reqId === requestCount.current) {
        setError(err instanceof Error ? err.message : 'Could not load notifications.');
      }
    } finally {
      if (reqId === requestCount.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [currentUserId, markAllRead]);

  useEffect(() => {
    void loadNotifications();
    return () => {
      requestCount.current += 1;
    };
  }, [loadNotifications]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadNotifications();
  }, [loadNotifications]);

  const handleToggleFollow = async (targetUserId: string, currentlyFollowing: boolean) => {
    if (!currentUserId || followProcessing.has(targetUserId)) return;

    setFollowProcessing((prev) => new Set(prev).add(targetUserId));
    const nextFollowing = !currentlyFollowing;

    // Optimistic update
    setNotifications((prev) =>
      prev.map((item) =>
        item.actorId === targetUserId
          ? { ...item, isFollowingActor: nextFollowing }
          : item
      )
    );

    try {
      if (nextFollowing) {
        await followUser(currentUserId, targetUserId);
      } else {
        await unfollowUser(currentUserId, targetUserId);
      }
    } catch {
      // Revert on error
      setNotifications((prev) =>
        prev.map((item) =>
          item.actorId === targetUserId
            ? { ...item, isFollowingActor: currentlyFollowing }
            : item
        )
      );
    } finally {
      setFollowProcessing((prev) => {
        const next = new Set(prev);
        next.delete(targetUserId);
        return next;
      });
    }
  };

  const handleRespondInvite = async (notificationId: number, status: 'accepted' | 'declined') => {
    if (inviteProcessing.has(notificationId)) return;

    setInviteProcessing((prev) => new Set(prev).add(notificationId));

    // Optimistic update
    setNotifications((prev) =>
      prev.map((item) =>
        item.id === notificationId ? { ...item, inviteStatus: status } : item
      )
    );

    try {
      await respondToPlaceInvite(notificationId, status);
    } catch {
      // Revert on error
      setNotifications((prev) =>
        prev.map((item) =>
          item.id === notificationId ? { ...item, inviteStatus: 'pending' } : item
        )
      );
    } finally {
      setInviteProcessing((prev) => {
        const next = new Set(prev);
        next.delete(notificationId);
        return next;
      });
    }
  };

  const handleRespondFollow = async (notificationId: number, status: 'accepted' | 'declined') => {
    if (followRespondProcessing.has(notificationId)) return;

    setFollowRespondProcessing((prev) => new Set(prev).add(notificationId));

    // Optimistic update
    setNotifications((prev) =>
      prev.map((item) =>
        item.id === notificationId ? { ...item, followStatus: status } : item
      )
    );

    try {
      await respondToFollowRequest(notificationId, status);
    } catch {
      // Revert on error
      setNotifications((prev) =>
        prev.map((item) =>
          item.id === notificationId ? { ...item, followStatus: 'pending' } : item
        )
      );
    } finally {
      setFollowRespondProcessing((prev) => {
        const next = new Set(prev);
        next.delete(notificationId);
        return next;
      });
    }
  };

  const handlePressNotification = (item: AppNotification) => {
    if (item.type === 'follow' || item.type === 'follow_accepted') {
      if (item.actorId) {
        router.push({
          pathname: '/search/profile/[id]',
          params: { id: item.actorId },
        });
      }
    } else if (
      item.type === 'invite' ||
      item.type === 'invite_accepted' ||
      item.type === 'invite_declined'
    ) {
      if (item.googlePlaceId) {
        router.push({
          pathname: '/search/[id]',
          params: { id: item.googlePlaceId },
        });
      } else if (item.actorId) {
        router.push({
          pathname: '/search/profile/[id]',
          params: { id: item.actorId },
        });
      }
    } else if (item.postId) {

      router.push({
        pathname: '/rankings/comments',
        params: { postId: String(item.postId) },
      });
    }
  };

  const { invites, regular } = partitionNotifications(notifications);

  const sections = [
    ...(invites.length > 0 ? [{ title: 'Invites', data: invites, isInvites: true }] : []),
    ...(regular.length > 0 || invites.length === 0
      ? [{ title: invites.length > 0 ? 'Notifications' : '', data: regular, isInvites: false }]
      : []),
  ];

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.screen}>
      <AppHeader description="Notifications" onBack={() => router.back()} showBack />

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator accessibilityLabel="Loading notifications" color="#000000" />
        </View>
      ) : error && notifications.length === 0 ? (
        <View style={styles.centerState}>
          <ThemedText style={styles.stateTitle}>Couldn’t load notifications</ThemedText>
          <ThemedText style={styles.stateBody}>{error}</ThemedText>
          <Pressable
            accessibilityRole="button"
            onPress={() => void loadNotifications()}
            style={({ pressed }) => [styles.retryBtn, pressed && styles.pressed]}
          >
            <ThemedText style={styles.retryLabel}>Try again</ThemedText>
          </Pressable>
        </View>
      ) : (
        <SectionList
          contentContainerStyle={styles.listContent}
          keyExtractor={(item) => String(item.id)}
          sections={sections}

          ListEmptyComponent={(
            <View style={styles.emptyContainer}>
              <ThemedText style={styles.emptyTitle}>No notifications yet</ThemedText>
              <ThemedText style={styles.emptyBody}>
                When someone invites you, follows you, likes, or comments on your posts, you’ll see it here.
              </ThemedText>
            </View>
          )}
          ListHeaderComponent={
            invites.length === 0 ? (
              <View style={styles.headerTitleRow}>
                <ThemedText style={styles.headerTitle}>Notifications</ThemedText>
              </View>
            ) : null
          }
          refreshControl={(
            <RefreshControl
              onRefresh={() => void handleRefresh()}
              refreshing={refreshing}
              tintColor="#000000"
            />
          )}
          renderItem={({ item, section }) => {
            if (section.isInvites) {
              return (
                <InviteRow
                  invite={item}
                  isBusy={inviteProcessing.has(item.id)}
                  onAccept={() => void handleRespondInvite(item.id, 'accepted')}
                  onDecline={() => void handleRespondInvite(item.id, 'declined')}
                  onPress={() => handlePressNotification(item)}
                />
              );
            }
            return (
              <NotificationRow
                isBusyFollowing={followProcessing.has(item.actorId)}
                isBusyRespondingFollow={followRespondProcessing.has(item.id)}
                notification={item}
                onPress={() => handlePressNotification(item)}
                onRespondFollow={(status) => void handleRespondFollow(item.id, status)}
                onToggleFollow={() => handleToggleFollow(item.actorId, item.isFollowingActor)}
              />
            );
          }}
          renderSectionHeader={({ section }) =>
            section.title ? (
              <View style={styles.sectionHeaderRow}>
                <ThemedText style={styles.sectionHeaderTitle}>{section.title}</ThemedText>
              </View>
            ) : null
          }
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
          style={styles.list}
        />
      )}
    </SafeAreaView>
  );
}

function InviteRow({
  invite,
  isBusy,
  onAccept,
  onDecline,
  onPress,
}: {
  invite: AppNotification;
  isBusy: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onPress: () => void;
}) {
  const [avatarFailed, setAvatarFailed] = useState(false);
  const timeText = formatNotificationTime(invite.createdAt);

  const openProfile = () => {
    if (invite.actorId) {
      router.push({
        pathname: '/search/profile/[id]',
        params: { id: invite.actorId },
      });
    }
  };

  const isPending = !invite.inviteStatus || invite.inviteStatus === 'pending';
  const isAccepted = invite.inviteStatus === 'accepted';
  const isDeclined = invite.inviteStatus === 'declined';

  return (
    <Pressable
      accessibilityLabel={`${invite.actorDisplayName} invited you to visit ${invite.placeName || 'this place'}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.inviteCard,
        !invite.isRead && styles.unreadInviteCard,
        pressed && styles.pressed,
      ]}
    >
      <Pressable accessibilityRole="button" onPress={openProfile} style={styles.avatarContainer}>
        {invite.actorAvatarUrl && !avatarFailed ? (
          <Image
            accessibilityLabel={`${invite.actorDisplayName}'s avatar`}
            contentFit="cover"
            onError={() => setAvatarFailed(true)}
            source={invite.actorAvatarUrl}
            style={styles.avatarImg}
          />
        ) : (
          <ThemedText style={styles.avatarInitials}>
            {invite.actorDisplayName.trim().slice(0, 2).toUpperCase() || 'OT'}
          </ThemedText>
        )}
      </Pressable>

      <View style={styles.inviteContentCol}>
        <ThemedText style={styles.messageText}>
          <ThemedText onPress={openProfile} style={styles.actorName}>
            {invite.actorDisplayName}
          </ThemedText>{' '}
          <ThemedText style={styles.actionText}>
            invited you to visit{' '}
          </ThemedText>
          <ThemedText style={styles.placeHighlight}>
            {invite.placeName || 'this place'}
          </ThemedText>
        </ThemedText>

        <ThemedText style={styles.timeText}>{timeText}</ThemedText>

        {/* Accept / Decline action buttons */}
        {isPending ? (
          <View style={styles.inviteActionsRow}>
            {isBusy ? (
              <ActivityIndicator color="#000000" size="small" />
            ) : (
              <>
                <Pressable
                  accessibilityLabel="Accept invite"
                  accessibilityRole="button"
                  onPress={(e) => {
                    e.stopPropagation();
                    onAccept();
                  }}
                  style={({ pressed }) => [styles.acceptBtn, pressed && styles.pressed]}
                >
                  <ThemedText style={styles.acceptBtnText}>Accept</ThemedText>
                </Pressable>

                <Pressable
                  accessibilityLabel="Decline invite"
                  accessibilityRole="button"
                  onPress={(e) => {
                    e.stopPropagation();
                    onDecline();
                  }}
                  style={({ pressed }) => [styles.declineBtn, pressed && styles.pressed]}
                >
                  <ThemedText style={styles.declineBtnText}>Decline</ThemedText>
                </Pressable>
              </>
            )}
          </View>
        ) : isAccepted ? (
          <View style={styles.acceptedBadge}>
            <ThemedText style={styles.acceptedBadgeText}>Accepted ✓</ThemedText>
          </View>
        ) : isDeclined ? (
          <View style={styles.declinedBadge}>
            <ThemedText style={styles.declinedBadgeText}>Declined</ThemedText>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

function NotificationRow({
  notification,
  isBusyFollowing,
  isBusyRespondingFollow = false,
  onPress,
  onRespondFollow,
  onToggleFollow,
}: {
  notification: AppNotification;
  isBusyFollowing: boolean;
  isBusyRespondingFollow?: boolean;
  onPress: () => void;
  onRespondFollow?: (status: 'accepted' | 'declined') => void;
  onToggleFollow: () => void;
}) {
  const [avatarFailed, setAvatarFailed] = useState(false);
  const actionText = formatNotificationAction(notification);
  const previewText = formatNotificationPreview(notification);
  const timeText = formatNotificationTime(notification.createdAt);

  const openProfile = () => {
    if (notification.actorId) {
      router.push({
        pathname: '/search/profile/[id]',
        params: { id: notification.actorId },
      });
    }
  };

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        notification.type === 'follow' &&
          Boolean(notification.followStatus) && { alignItems: 'flex-start' },
        !notification.isRead && styles.unreadRow,
        pressed && styles.pressed,
      ]}
    >
      <Pressable accessibilityRole="button" onPress={openProfile} style={styles.avatarContainer}>
        {notification.actorAvatarUrl && !avatarFailed ? (
          <Image
            accessibilityLabel={`${notification.actorDisplayName}'s avatar`}
            contentFit="cover"
            onError={() => setAvatarFailed(true)}
            source={notification.actorAvatarUrl}
            style={styles.avatarImg}
          />
        ) : (
          <ThemedText style={styles.avatarInitials}>
            {notification.actorDisplayName.trim().slice(0, 2).toUpperCase() || 'OT'}
          </ThemedText>
        )}
      </Pressable>

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

        {/* Accept / Decline actions or status badges for follow requests */}
        {notification.type === 'follow' && notification.followStatus === 'pending' ? (
          <View style={styles.inviteActionsRow}>
            {isBusyRespondingFollow ? (
              <ActivityIndicator color="#000000" size="small" />
            ) : (
              <>
                <Pressable
                  accessibilityLabel="Accept follow request"
                  accessibilityRole="button"
                  onPress={(e) => {
                    e.stopPropagation();
                    onRespondFollow?.('accepted');
                  }}
                  style={({ pressed }) => [styles.acceptBtn, pressed && styles.pressed]}
                >
                  <ThemedText style={styles.acceptBtnText}>Accept</ThemedText>
                </Pressable>

                <Pressable
                  accessibilityLabel="Decline follow request"
                  accessibilityRole="button"
                  onPress={(e) => {
                    e.stopPropagation();
                    onRespondFollow?.('declined');
                  }}
                  style={({ pressed }) => [styles.declineBtn, pressed && styles.pressed]}
                >
                  <ThemedText style={styles.declineBtnText}>Decline</ThemedText>
                </Pressable>
              </>
            )}
          </View>
        ) : notification.type === 'follow' && notification.followStatus === 'accepted' ? (
          <View style={styles.acceptedBadge}>
            <ThemedText style={styles.acceptedBadgeText}>Accepted ✓</ThemedText>
          </View>
        ) : notification.type === 'follow' && notification.followStatus === 'declined' ? (
          <View style={styles.declinedBadge}>
            <ThemedText style={styles.declinedBadgeText}>Declined</ThemedText>
          </View>
        ) : null}
      </View>

      {notification.type === 'follow_accepted' ||
      (notification.type === 'follow' &&
        notification.followStatus !== 'pending' &&
        notification.followStatus !== 'declined') ? (
        <Pressable
          accessibilityLabel={notification.isFollowingActor ? 'Following' : 'Follow back'}
          accessibilityRole="button"
          disabled={isBusyFollowing}
          onPress={(e) => {
            e.stopPropagation();
            onToggleFollow();
          }}
          style={({ pressed }) => [
            styles.followBtn,
            notification.isFollowingActor ? styles.followingBtn : styles.followActiveBtn,
            pressed && styles.pressed,
          ]}
        >
          <ThemedText
            style={[
              styles.followBtnText,
              notification.isFollowingActor ? styles.followingBtnText : styles.followActiveBtnText,
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
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  list: {
    flex: 1,
    width: '100%',
    maxWidth: 402,
    alignSelf: 'center',
  },
  listContent: {
    paddingBottom: 24,
  },
  headerTitleRow: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
    lineHeight: 18,
  },
  sectionHeaderRow: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 6,
    backgroundColor: '#FFFFFF',
  },
  sectionHeaderTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inviteCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0, 0, 0, 0.06)',
    backgroundColor: '#F9FAFB',
  },
  unreadInviteCard: {
    backgroundColor: '#F0FDF4',
  },
  inviteContentCol: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  placeHighlight: {
    fontWeight: '700',
    color: '#000000',
  },
  inviteActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  acceptBtn: {
    backgroundColor: '#000000',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  declineBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineBtnText: {
    color: '#4B5563',
    fontSize: 12,
    fontWeight: '600',
  },
  acceptedBadge: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  acceptedBadgeText: {
    color: '#15803D',
    fontSize: 12,
    fontWeight: '600',
  },
  declinedBadge: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  declinedBadgeText: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '600',
  },
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
  unreadRow: {
    backgroundColor: '#F9FAFB',
  },
  avatarContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E7EDDE',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  avatarImg: {
    width: 44,
    height: 44,
  },
  avatarInitials: {
    color: '#24331B',
    fontSize: 14,
    fontWeight: '700',
  },
  contentCol: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  messageText: {
    fontSize: 13,
    lineHeight: 18,
    color: '#000000',
  },
  actorName: {
    fontWeight: '700',
    color: '#000000',
  },
  actionText: {
    fontWeight: '400',
    color: '#1F2937',
  },
  previewText: {
    fontSize: 12,
    lineHeight: 16,
    color: '#4B5563',
    fontStyle: 'italic',
  },
  timeText: {
    fontSize: 11,
    lineHeight: 14,
    color: '#9CA3AF',
    marginTop: 1,
  },
  followBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 70,
  },
  followActiveBtn: {
    backgroundColor: '#000000',
  },
  followingBtn: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  followBtnText: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 15,
  },
  followActiveBtnText: {
    color: '#FFFFFF',
  },
  followingBtnText: {
    color: '#374151',
  },
  postThumbnail: {
    width: 44,
    height: 44,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
    flexShrink: 0,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 8,
  },
  stateTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    textAlign: 'center',
  },
  stateBody: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 8,
    paddingHorizontal: 20,
    height: 38,
    borderWidth: 1,
    borderColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000000',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.6,
  },
});

