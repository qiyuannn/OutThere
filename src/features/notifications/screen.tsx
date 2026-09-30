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
import { InviteRow } from './components/invite-row';
import { NotificationRow } from './components/notification-row';
import { useNotificationsScreen } from './use-notifications-screen';

export default function NotificationsScreen() {
  const {
    notifications,
    loading,
    refreshing,
    error,
    sections,
    invitesCount,
    inviteProcessing,
    followProcessing,
    followRespondProcessing,
    loadNotifications,
    handleRefresh,
    handleToggleFollow,
    handleRespondInvite,
    handleRespondFollow,
    handlePressNotification,
  } = useNotificationsScreen();

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
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <ThemedText style={styles.emptyTitle}>No notifications yet</ThemedText>
              <ThemedText style={styles.emptyBody}>
                When someone invites you, follows you, likes, or comments on your posts, you’ll see it here.
              </ThemedText>
            </View>
          }
          ListHeaderComponent={
            invitesCount === 0 ? (
              <View style={styles.headerTitleRow}>
                <ThemedText style={styles.headerTitle}>Notifications</ThemedText>
              </View>
            ) : null
          }
          refreshControl={
            <RefreshControl
              onRefresh={() => void handleRefresh()}
              refreshing={refreshing}
              tintColor="#000000"
            />
          }
          renderItem={({ item, section }) =>
            section.isInvites ? (
              <InviteRow
                invite={item}
                isBusy={inviteProcessing.has(item.id)}
                onAccept={() => void handleRespondInvite(item.id, 'accepted')}
                onDecline={() => void handleRespondInvite(item.id, 'declined')}
                onPress={() => handlePressNotification(item)}
              />
            ) : (
              <NotificationRow
                isBusyFollowing={followProcessing.has(item.actorId)}
                isBusyRespondingFollow={followRespondProcessing.has(item.id)}
                notification={item}
                onPress={() => handlePressNotification(item)}
                onRespondFollow={(status) => void handleRespondFollow(item.id, status)}
                onToggleFollow={() => void handleToggleFollow(item.actorId, item.isFollowingActor)}
              />
            )
          }
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  list: { flex: 1, width: '100%', maxWidth: 402, alignSelf: 'center' },
  listContent: { paddingBottom: 24 },
  headerTitleRow: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8 },
  headerTitle: { fontSize: 14, fontWeight: '700', color: '#000000', lineHeight: 18 },
  sectionHeaderRow: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 6, backgroundColor: '#FFFFFF' },
  sectionHeaderTitle: { fontSize: 13, fontWeight: '700', color: '#111827', textTransform: 'uppercase', letterSpacing: 0.5 },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  stateTitle: { fontSize: 16, fontWeight: '600', color: '#000000', textAlign: 'center' },
  stateBody: { fontSize: 13, color: '#6B7280', textAlign: 'center' },
  retryBtn: { marginTop: 8, paddingHorizontal: 20, height: 38, borderWidth: 1, borderColor: '#000000', alignItems: 'center', justifyContent: 'center' },
  retryLabel: { fontSize: 12, fontWeight: '600', color: '#000000' },
  emptyContainer: { padding: 40, alignItems: 'center', justifyContent: 'center', gap: 6 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#000000', textAlign: 'center' },
  emptyBody: { fontSize: 13, color: '#6B7280', textAlign: 'center', maxWidth: 260, lineHeight: 18 },
  pressed: { opacity: 0.6 },
});
