import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import type { MutualFollowerSavedPlace } from '../service';
import { AvatarBubble } from './avatar-bubble';

interface InviteFriendRowProps {
  item: MutualFollowerSavedPlace;
  isInvited: boolean;
  onOpenProfile: (id: string) => void;
  onInvite: (friend: MutualFollowerSavedPlace) => void;
}

export function InviteFriendRow({
  item,
  isInvited,
  onOpenProfile,
  onInvite,
}: InviteFriendRowProps) {
  return (
    <View style={styles.userRow}>
      <Pressable
        accessibilityLabel={`View ${item.displayName}'s profile`}
        accessibilityRole="button"
        onPress={() => onOpenProfile(item.userId)}
        style={styles.userInfo}
      >
        <AvatarBubble
          avatarUrl={item.avatarUrl}
          displayName={item.displayName}
          overlap={false}
          size={40}
        />
        <View style={styles.userTextContainer}>
          <ThemedText numberOfLines={1} style={styles.userName}>
            {item.displayName}
          </ThemedText>
          {item.username ? (
            <ThemedText numberOfLines={1} style={styles.userHandle}>
              @{item.username}
            </ThemedText>
          ) : null}
        </View>
      </Pressable>

      <Pressable
        accessibilityLabel={
          isInvited
            ? `Already invited ${item.displayName}`
            : `Invite ${item.displayName}`
        }
        accessibilityRole="button"
        onPress={() => onInvite(item)}
        style={({ pressed }) => [
          styles.rowActionBtn,
          isInvited && styles.rowActionBtnInvited,
          pressed && styles.rowActionBtnPressed,
        ]}
      >
        <ThemedText
          style={[
            styles.rowActionBtnText,
            isInvited && styles.rowActionBtnTextInvited,
          ]}
        >
          {isInvited ? 'Invited ✓' : 'Invite'}
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    gap: 12,
  },
  userInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  userTextContainer: { flex: 1, minWidth: 0 },
  userName: { fontSize: 14, fontWeight: '600', color: '#000000' },
  userHandle: { fontSize: 12, color: '#6B7280', marginTop: 1 },
  rowActionBtn: {
    minWidth: 68,
    height: 32,
    paddingHorizontal: 14,
    backgroundColor: '#000000',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowActionBtnInvited: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  rowActionBtnPressed: { opacity: 0.75 },
  rowActionBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  rowActionBtnTextInvited: { color: '#15803D' },
});
