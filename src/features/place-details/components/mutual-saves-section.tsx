import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { formatMutualSavesText } from '../service';
import { useMutualSaves } from '../hooks/use-mutual-saves';
import { AvatarBubble } from './avatar-bubble';
import { InviteFriendsModal } from './invite-friends-modal';

interface MutualSavesSectionProps {
  placeId?: string;
  placeName?: string;
}

export function MutualSavesSection({ placeId, placeName }: MutualSavesSectionProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const {
    mutualFollowers,
    loading,
    invitedUserIds,
    handleInviteSingle,
    handleInviteAll,
  } = useMutualSaves({ placeId, placeName });

  if (loading || mutualFollowers.length === 0) {
    return null;
  }

  const savedText = formatMutualSavesText(mutualFollowers);
  const displayAvatars = mutualFollowers.slice(0, 4);

  return (
    <>
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <View style={styles.avatarGroup}>
            {displayAvatars.map((user, index) => (
              <AvatarBubble
                avatarUrl={user.avatarUrl}
                displayName={user.displayName}
                key={user.userId}
                overlap={index > 0}
                size={28}
                zIndex={displayAvatars.length - index}
              />
            ))}
          </View>

          <ThemedText numberOfLines={2} style={styles.savedText}>
            {savedText}
          </ThemedText>
        </View>

        <Pressable
          accessibilityHint="Opens friend invite popup"
          accessibilityLabel="Invite them"
          accessibilityRole="button"
          onPress={() => setModalVisible(true)}
          style={({ pressed }) => [styles.inviteBtn, pressed && styles.inviteBtnPressed]}
        >
          <ThemedText style={styles.inviteBtnText}>Invite them</ThemedText>
        </Pressable>
      </View>

      <InviteFriendsModal
        invitedUserIds={invitedUserIds}
        mutualFollowers={mutualFollowers}
        onClose={() => setModalVisible(false)}
        onInviteAll={() => void handleInviteAll()}
        onInviteSingle={(friend) => void handleInviteSingle(friend)}
        visible={modalVisible}
      />
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginVertical: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  savedText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: '#1F2937',
    lineHeight: 18,
  },
  inviteBtn: {
    marginTop: 10,
    width: '100%',
    height: 38,
    backgroundColor: '#000000',
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteBtnPressed: {
    opacity: 0.75,
  },
  inviteBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
});
