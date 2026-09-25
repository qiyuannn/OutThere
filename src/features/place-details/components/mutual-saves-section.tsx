import { useCallback, useEffect, useState } from 'react';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { getSentPlaceInvites, sendPlaceInvite } from '@/features/notifications/service';
import {
  formatMutualSavesText,
  getMutualFollowersSavedPlace,
  type MutualFollowerSavedPlace,
} from '../service';

interface MutualSavesSectionProps {
  placeId?: string;
  placeName?: string;
}

export function MutualSavesSection({ placeId, placeName }: MutualSavesSectionProps) {
  const [mutualFollowers, setMutualFollowers] = useState<MutualFollowerSavedPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [invitedUserIds, setInvitedUserIds] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    if (!placeId) {
      setMutualFollowers([]);
      setInvitedUserIds(new Set());
      setLoading(false);
      return;
    }

    try {
      const [items, alreadyInvited] = await Promise.all([
        getMutualFollowersSavedPlace(placeId),
        getSentPlaceInvites(placeId).catch(() => new Set<string>()),
      ]);
      setMutualFollowers(items);
      setInvitedUserIds(alreadyInvited);
    } catch {
      setMutualFollowers([]);
      setInvitedUserIds(new Set());
    } finally {
      setLoading(false);
    }
  }, [placeId]);

  useEffect(() => {
    setLoading(true);
    void loadData();
  }, [loadData]);

  if (loading || mutualFollowers.length === 0) {
    // Does not appear if there is no user to display
    return null;
  }

  const savedText = formatMutualSavesText(mutualFollowers);
  const displayAvatars = mutualFollowers.slice(0, 4);

  const openProfile = (id: string) => {
    setModalVisible(false);
    router.push({
      pathname: '/search/profile/[id]',
      params: { id },
    });
  };

  const handleInviteSingle = async (friend: MutualFollowerSavedPlace) => {
    if (!placeId) return;
    setInvitedUserIds((prev) => new Set(prev).add(friend.userId));
    try {
      await sendPlaceInvite(friend.userId, placeId, placeName);
    } catch {
      setInvitedUserIds((prev) => {
        const next = new Set(prev);
        next.delete(friend.userId);
        return next;
      });
    }
  };

  const handleInviteAll = async () => {
    if (!placeId) return;
    const uninvited = mutualFollowers.filter((u) => !invitedUserIds.has(u.userId));
    setInvitedUserIds((prev) => new Set([...prev, ...mutualFollowers.map((u) => u.userId)]));
    try {
      await Promise.all(
        uninvited.map((friend) => sendPlaceInvite(friend.userId, placeId, placeName))
      );
    } catch {
      // Ignored
    }
  };

  return (
    <>
      <View style={styles.card}>
        {/* Top row: Overlapping icons followed by "have this on their saved list too!" */}
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

        {/* Button below: "Invite them" */}
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

      {/* Modal: Figma Node 256-1102 "Reach out to them" */}
      <Modal
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
        transparent
        visible={modalVisible}
      >
        <Pressable
          accessibilityLabel="Close overlay"
          onPress={() => setModalVisible(false)}
          style={styles.modalBackdrop}
        >
          <Pressable onPress={(e) => e.stopPropagation()} style={styles.modalCard}>
            {/* Header: Title + Subtitle and Close button */}
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
                onPress={() => setModalVisible(false)}
                style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
              >
                <ThemedText style={styles.closeBtnText}>✕</ThemedText>
              </Pressable>
            </View>

            <View style={styles.modalDivider} />

            {/* List of mutual followers */}
            <FlatList
              data={mutualFollowers}
              keyExtractor={(item) => item.userId}
              renderItem={({ item }) => {
                const isInvited = invitedUserIds.has(item.userId);
                return (
                  <View style={styles.userRow}>
                    <Pressable
                      accessibilityLabel={`View ${item.displayName}'s profile`}
                      accessibilityRole="button"
                      onPress={() => openProfile(item.userId)}
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
                      onPress={() => void handleInviteSingle(item)}
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
              }}
              showsVerticalScrollIndicator={false}
              style={styles.modalList}
            />

            {/* Bottom button: "Invite all" */}
            <Pressable
              accessibilityLabel="Invite all friends"
              accessibilityRole="button"
              onPress={() => void handleInviteAll()}
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
    </>
  );
}

function AvatarBubble({
  avatarUrl,
  displayName,
  overlap = false,
  size = 26,
  zIndex = 1,
}: {
  avatarUrl: string | null;
  displayName: string;
  overlap?: boolean;
  size?: number;
  zIndex?: number;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <View
      style={[
        styles.avatarWrapper,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          zIndex,
        },
        overlap && styles.avatarOverlap,
      ]}
    >
      {avatarUrl && !failed ? (
        <Image
          accessibilityLabel={`${displayName}'s avatar`}
          contentFit="cover"
          onError={() => setFailed(true)}
          source={avatarUrl}
          style={{ width: size, height: size }}
        />
      ) : (
        <ThemedText style={[styles.avatarInitials, { fontSize: Math.max(9, size * 0.38) }]}>
          {displayName.trim().slice(0, 2).toUpperCase() || 'OT'}
        </ThemedText>
      )}
    </View>
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
  avatarWrapper: {
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: '#E7EDDE',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarOverlap: {
    marginLeft: -8,
  },
  avatarInitials: {
    fontWeight: '700',
    color: '#24331B',
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
  modalHeaderTextContainer: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000000',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 3,
  },
  closeBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
  },
  closeBtnPressed: {
    opacity: 0.6,
  },
  closeBtnText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '600',
  },
  modalDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 12,
  },
  modalList: {
    maxHeight: 280,
  },
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
  userTextContainer: {
    flex: 1,
    minWidth: 0,
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  userHandle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 1,
  },
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
  rowActionBtnPressed: {
    opacity: 0.75,
  },
  rowActionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  rowActionBtnTextInvited: {
    color: '#15803D',
  },
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
  inviteAllBtnPressed: {
    backgroundColor: '#F3F4F6',
  },
  inviteAllBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000000',
  },
});

