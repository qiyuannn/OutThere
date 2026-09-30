import { router } from 'expo-router';
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { routes } from '@/lib/routes';
import type { MutualFollowerSavedPlace } from '../service';
import { InviteFriendRow } from './invite-friend-row';

interface InviteFriendsModalProps {
  visible: boolean;
  onClose: () => void;
  mutualFollowers: MutualFollowerSavedPlace[];
  invitedUserIds: Set<string>;
  onInviteSingle: (friend: MutualFollowerSavedPlace) => void;
  onInviteAll: () => void;
}

export function InviteFriendsModal({
  visible,
  onClose,
  mutualFollowers,
  invitedUserIds,
  onInviteSingle,
  onInviteAll,
}: InviteFriendsModalProps) {
  const openProfile = (id: string) => {
    onClose();
    router.push(routes.userProfile(id));
  };

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <Pressable accessibilityLabel="Close overlay" onPress={onClose} style={styles.modalBackdrop}>
        <Pressable onPress={(e) => e.stopPropagation()} style={styles.modalCard}>
          <View style={styles.modalHeaderRow}>
            <View style={styles.modalHeaderTextContainer}>
              <ThemedText style={styles.modalTitle}>Reach out to them</ThemedText>
              <ThemedText style={styles.modalSubtitle}>
                Plan an outing together with your friends
              </ThemedText>
            </View>

            <Pressable
              accessibilityLabel="Close popup"
              accessibilityRole="button"
              hitSlop={12}
              onPress={onClose}
              style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
            >
              <ThemedText style={styles.closeBtnText}>✕</ThemedText>
            </Pressable>
          </View>

          <View style={styles.modalDivider} />

          <FlatList
            data={mutualFollowers}
            keyExtractor={(item) => item.userId}
            renderItem={({ item }) => (
              <InviteFriendRow
                isInvited={invitedUserIds.has(item.userId)}
                item={item}
                onInvite={onInviteSingle}
                onOpenProfile={openProfile}
              />
            )}
            showsVerticalScrollIndicator={false}
            style={styles.modalList}
          />

          <Pressable
            accessibilityLabel="Invite all friends"
            accessibilityRole="button"
            onPress={onInviteAll}
            style={({ pressed }) => [
              styles.inviteAllBtn,
              pressed && styles.inviteAllBtnPressed,
            ]}
          >
            <ThemedText style={styles.inviteAllBtnText}>Invite all</ThemedText>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingTop: 18,
    paddingBottom: 18,
    paddingHorizontal: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 6,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  modalHeaderTextContainer: { flex: 1 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#000000' },
  modalSubtitle: { fontSize: 12, color: '#6B7280', marginTop: 3 },
  closeBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
  },
  closeBtnPressed: { opacity: 0.6 },
  closeBtnText: { fontSize: 13, color: '#6B7280', fontWeight: '600' },
  modalDivider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 12 },
  modalList: { maxHeight: 280 },
  inviteAllBtn: {
    marginTop: 14,
    width: '100%',
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteAllBtnPressed: { backgroundColor: '#F3F4F6' },
  inviteAllBtnText: { fontSize: 13, fontWeight: '600', color: '#000000' },
});
