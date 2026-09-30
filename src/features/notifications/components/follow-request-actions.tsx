import { ActivityIndicator, Pressable, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { rowStyles } from './notification-styles';

interface FollowRequestActionsProps {
  followStatus?: 'pending' | 'accepted' | 'declined' | null;
  isBusyRespondingFollow: boolean;
  onRespondFollow?: (status: 'accepted' | 'declined') => void;
}

export function FollowRequestActions({
  followStatus,
  isBusyRespondingFollow,
  onRespondFollow,
}: FollowRequestActionsProps) {
  if (followStatus === 'pending') {
    if (isBusyRespondingFollow) {
      return <ActivityIndicator color="#000000" size="small" />;
    }
    return (
      <View style={rowStyles.inviteActionsRow}>
        <Pressable
          accessibilityLabel="Accept follow request"
          accessibilityRole="button"
          onPress={(e) => {
            e.stopPropagation();
            onRespondFollow?.('accepted');
          }}
          style={({ pressed }) => [rowStyles.acceptBtn, pressed && rowStyles.pressed]}
        >
          <ThemedText style={rowStyles.acceptBtnText}>Accept</ThemedText>
        </Pressable>
        <Pressable
          accessibilityLabel="Decline follow request"
          accessibilityRole="button"
          onPress={(e) => {
            e.stopPropagation();
            onRespondFollow?.('declined');
          }}
          style={({ pressed }) => [rowStyles.declineBtn, pressed && rowStyles.pressed]}
        >
          <ThemedText style={rowStyles.declineBtnText}>Decline</ThemedText>
        </Pressable>
      </View>
    );
  }

  if (followStatus === 'accepted') {
    return (
      <View style={rowStyles.acceptedBadge}>
        <ThemedText style={rowStyles.acceptedBadgeText}>Accepted ✓</ThemedText>
      </View>
    );
  }

  if (followStatus === 'declined') {
    return (
      <View style={rowStyles.declinedBadge}>
        <ThemedText style={rowStyles.declinedBadgeText}>Declined</ThemedText>
      </View>
    );
  }

  return null;
}
