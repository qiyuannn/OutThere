import { router } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { routes } from '@/lib/routes';
import { formatNotificationTime } from '../model';
import type { AppNotification } from '../types';
import { NotificationAvatar } from './notification-avatar';
import { rowStyles } from './notification-styles';

export interface InviteRowProps {
  invite: AppNotification;
  isBusy: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onPress: () => void;
}

export function InviteRow({ invite, isBusy, onAccept, onDecline, onPress }: InviteRowProps) {
  const timeText = formatNotificationTime(invite.createdAt);
  const openProfile = () => {
    if (invite.actorId) router.push(routes.userProfile(invite.actorId));
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
        pressed && rowStyles.pressed,
      ]}
    >
      <NotificationAvatar
        avatarUrl={invite.actorAvatarUrl}
        displayName={invite.actorDisplayName}
        onPress={openProfile}
      />

      <View style={styles.inviteContentCol}>
        <ThemedText style={styles.messageText}>
          <ThemedText onPress={openProfile} style={styles.actorName}>
            {invite.actorDisplayName}
          </ThemedText>{' '}
          <ThemedText style={styles.actionText}>invited you to visit </ThemedText>
          <ThemedText style={styles.placeHighlight}>
            {invite.placeName || 'this place'}
          </ThemedText>
        </ThemedText>

        <ThemedText style={styles.timeText}>{timeText}</ThemedText>

        {isPending ? (
          <View style={rowStyles.inviteActionsRow}>
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
                  style={({ pressed }) => [rowStyles.acceptBtn, pressed && rowStyles.pressed]}
                >
                  <ThemedText style={rowStyles.acceptBtnText}>Accept</ThemedText>
                </Pressable>
                <Pressable
                  accessibilityLabel="Decline invite"
                  accessibilityRole="button"
                  onPress={(e) => {
                    e.stopPropagation();
                    onDecline();
                  }}
                  style={({ pressed }) => [rowStyles.declineBtn, pressed && rowStyles.pressed]}
                >
                  <ThemedText style={rowStyles.declineBtnText}>Decline</ThemedText>
                </Pressable>
              </>
            )}
          </View>
        ) : isAccepted ? (
          <View style={rowStyles.acceptedBadge}>
            <ThemedText style={rowStyles.acceptedBadgeText}>Accepted ✓</ThemedText>
          </View>
        ) : isDeclined ? (
          <View style={rowStyles.declinedBadge}>
            <ThemedText style={rowStyles.declinedBadgeText}>Declined</ThemedText>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
  unreadInviteCard: { backgroundColor: '#F0FDF4' },
  inviteContentCol: { flex: 1, minWidth: 0, gap: 4 },
  placeHighlight: { fontWeight: '700', color: '#000000' },
  messageText: { fontSize: 13, lineHeight: 18, color: '#000000' },
  actorName: { fontWeight: '700', color: '#000000' },
  actionText: { fontWeight: '400', color: '#1F2937' },
  timeText: { fontSize: 11, lineHeight: 14, color: '#9CA3AF', marginTop: 1 },
});
