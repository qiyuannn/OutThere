import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/app-header';
import { SectionHeading } from '@/components/ui-system';
import { Avatar } from '@/features/profile/components/avatar';
import { VisitedPlacesMap } from '@/features/profile/components/visited-places-map';
import type { VisitedPlace } from '@/features/profile/service';
import {
  SocialError,
  SocialPostCard,
  SocialState,
  usePostPlaces,
} from './components';
import { useSocialList, useSocialMutation, useSocialQuery } from './hooks';
import type { SocialPost, SocialProfile } from './types';

export default function SocialProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const profile = useSocialQuery<SocialProfile>('profile', { user_id: id }, !!id);
  const feed = useSocialList<SocialPost>('feed', { user_id: id }, !!profile.data);
  const places = usePostPlaces(feed.items);
  const mutation = useSocialMutation();

  const [activeTab, setActiveTab] = useState<'ratings' | 'activity' | 'map'>('ratings');
  const [menuVisible, setMenuVisible] = useState(false);

  const person = profile.data?.person;
  const relationship = profile.data?.relationship;
  const displayName = person?.name || person?.username || 'this user';

  const run = async (action: 'request' | 'accept' | 'decline' | 'cancel') => {
    if (await mutation.run(action, { user_id: id })) await profile.refresh();
  };

  const handleRemoveFriend = () => {
    Alert.alert(
      'Remove friend?',
      `Are you sure you want to remove ${displayName} from your friends?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            void mutation.run('remove_friend', { user_id: id }).then((ok) => {
              if (ok) void profile.refresh();
            });
          },
        },
      ]
    );
  };

  const handleBlockPerson = () => {
    Alert.alert(
      'Block person?',
      `Are you sure you want to block ${displayName}? You will no longer find each other or see shared activity.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: () => {
            void mutation.run('block', { user_id: id }).then((ok) => {
              if (ok) {
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.replace('/feed/people');
                }
              }
            });
          },
        },
      ]
    );
  };

  const handleReportUser = () => {
    Alert.alert(
      'Report user?',
      `Are you sure you want to report this profile for inappropriate content or conduct?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Report',
          style: 'destructive',
          onPress: () => {
            router.push({
              pathname: '/feed/report',
              params: { target: 'user', id },
            });
          },
        },
      ]
    );
  };

  // Visited places and statistics calculated from the person's shared posts
  const { avgRatingStr, visitedCountStr, visitedPlaces } = useMemo(() => {
    const list: VisitedPlace[] = [];
    let ratingTotal = 0;
    let ratingCount = 0;
    const seenPlaces = new Set<string>();

    for (const post of feed.items) {
      const score = Number(post.score);
      if (Number.isFinite(score)) {
        ratingTotal += score;
        ratingCount += 1;
      }

      if (!seenPlaces.has(post.google_place_id)) {
        seenPlaces.add(post.google_place_id);
        const pl = places[post.google_place_id];
        if (pl && typeof pl.latitude === 'number' && typeof pl.longitude === 'number') {
          list.push({
            googlePlaceId: post.google_place_id,
            latitude: pl.latitude,
            longitude: pl.longitude,
            name: pl.name || 'Visited place',
            rating: Number.isFinite(score) ? score : 0,
          });
        }
      }
    }

    return {
      avgRatingStr: ratingCount > 0 ? (ratingTotal / ratingCount).toFixed(1) : '—',
      visitedCountStr: seenPlaces.size > 0 ? String(seenPlaces.size) : feed.loading ? '—' : '0',
      visitedPlaces: list,
    };
  }, [feed.items, feed.loading, places]);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/feed/people');
    }
  };

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.safeArea}>
      <AppHeader
        description="Profile"
        showBack
        onBack={handleBack}
        onMore={relationship && relationship !== 'self' ? () => setMenuVisible(true) : undefined}
      />

      <ScrollView contentContainerStyle={styles.content}>
        {profile.loading && !person ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color="#000000" size="large" />
          </View>
        ) : null}

        {profile.error ? (
          <View style={styles.errorContainer}>
            <SocialError message={profile.error} />
            <Pressable
              accessibilityRole="button"
              style={styles.retryButton}
              onPress={() => void profile.refresh()}
            >
              <Text style={styles.buttonLabel}>Try again</Text>
            </Pressable>
          </View>
        ) : null}

        {person ? (
          <>
            <View style={styles.profileDescription}>
              <Avatar name={person.name} path={person.avatar_path} size={84} />
              <View style={styles.identity}>
                <Text style={styles.name}>{person.name}</Text>
                <Text style={styles.username}>@{person.username}</Text>
                {person.bio ? (
                  <Text numberOfLines={3} style={styles.bio}>
                    {person.bio}
                  </Text>
                ) : null}
              </View>
            </View>

            <View style={styles.stats}>
              <StatButton
                label="Friends"
                value={relationship === 'friends' ? '1' : '—'}
                onPress={() => {}}
              />
              <View style={styles.statDivider} />
              <StatButton
                label="Visited"
                value={visitedCountStr}
                onPress={() => setActiveTab('ratings')}
              />
              <View style={styles.statDivider} />
              <StatButton
                label="Avg rating"
                value={avgRatingStr}
                onPress={() => setActiveTab('ratings')}
              />
            </View>

            {/* If not friends yet, show relevant friend status / action button */}
            {relationship === 'none' ? (
              <View style={styles.actions}>
                <ProfileButton
                  disabled={mutation.busy}
                  label="Send friend request"
                  onPress={() => void run('request')}
                />
              </View>
            ) : relationship === 'incoming' ? (
              <View style={styles.actions}>
                <ProfileButton
                  disabled={mutation.busy}
                  label="Accept request"
                  onPress={() => void run('accept')}
                />
                <ProfileButton
                  disabled={mutation.busy}
                  label="Decline request"
                  onPress={() => void run('decline')}
                />
              </View>
            ) : relationship === 'outgoing' ? (
              <View style={styles.actions}>
                <ProfileButton
                  disabled={mutation.busy}
                  label="Cancel request"
                  onPress={() => void run('cancel')}
                />
              </View>
            ) : null}

            {mutation.error ? <SocialError message={mutation.error} /> : null}

            <View accessibilityRole="tablist" style={styles.profileTabs}>
              <ProfileTab
                active={activeTab === 'ratings'}
                label="Ratings"
                symbol="★"
                onPress={() => setActiveTab('ratings')}
              />
              <ProfileTab
                active={activeTab === 'activity'}
                label="Activity"
                symbol="▦"
                onPress={() => setActiveTab('activity')}
              />
              <ProfileTab
                active={activeTab === 'map'}
                label="Map"
                symbol="⌖"
                onPress={() => setActiveTab('map')}
              />
            </View>

            {activeTab === 'map' ? (
              <View style={styles.mapSection}>
                <SectionHeading eyebrow="Their footprint" title="Places they’ve been" />
                {feed.loading && !feed.items.length ? (
                  <View style={styles.mapLoading}>
                    <ActivityIndicator color="#000000" />
                  </View>
                ) : (
                  <VisitedPlacesMap places={visitedPlaces} />
                )}
              </View>
            ) : (
              <View style={styles.feedSection}>
                {feed.items.map((post) => (
                  <SocialPostCard
                    key={post.id}
                    post={post}
                    place={places[post.google_place_id]}
                  />
                ))}

                <SocialState
                  loading={feed.loading}
                  error={feed.error}
                  offline={feed.offline}
                  empty={!feed.items.length}
                  emptyTitle="No shared ratings"
                  emptyMessage="Ratings this person shares with friends will appear here."
                  onRetry={feed.refresh}
                  hasMore={feed.hasMore}
                  loadingMore={feed.loadingMore}
                  onMore={feed.loadMore}
                />
              </View>
            )}
          </>
        ) : null}
      </ScrollView>

      {/* 3-Dots Options Menu Modal */}
      <Modal
        animationType="fade"
        transparent
        visible={menuVisible}
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setMenuVisible(false)}>
          <View style={styles.menuContainer}>
            <View style={styles.menuHeader}>
              <View style={styles.menuHandle} />
            </View>

            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
              onPress={() => {
                setMenuVisible(false);
                setTimeout(() => handleRemoveFriend(), 300);
              }}
            >
              <Text style={styles.menuItemDestructive}>Remove friend</Text>
            </Pressable>

            <View style={styles.menuDivider} />

            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
              onPress={() => {
                setMenuVisible(false);
                setTimeout(() => handleBlockPerson(), 300);
              }}
            >
              <Text style={styles.menuItemDestructive}>Block person</Text>
            </Pressable>

            <View style={styles.menuDivider} />

            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
              onPress={() => {
                setMenuVisible(false);
                setTimeout(() => handleReportUser(), 300);
              }}
            >
              <Text style={styles.menuItemDestructive}>Report user</Text>
            </Pressable>

            <View style={styles.menuDividerThick} />

            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.menuItem,
                styles.cancelItem,
                pressed && styles.menuItemPressed,
              ]}
              onPress={() => setMenuVisible(false)}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function StatButton({
  label,
  onPress,
  value,
}: {
  label: string;
  onPress: () => void;
  value: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.statButton, pressed && styles.pressed]}
    >
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Pressable>
  );
}

function ProfileButton({
  disabled = false,
  label,
  onPress,
}: {
  disabled?: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        disabled && styles.disabledButton,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text style={styles.buttonLabel}>{label}</Text>
    </Pressable>
  );
}

function ProfileTab({
  active = false,
  label,
  onPress,
  symbol,
}: {
  active?: boolean;
  label: string;
  onPress: () => void;
  symbol: string;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      onPress={onPress}
      style={({ pressed }) => [
        styles.profileTab,
        active && styles.activeProfileTab,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.tabSymbol, active && styles.activeTabSymbol]}>{symbol}</Text>
      <Text style={[styles.tabLabel, active && styles.activeTabLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  content: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 120,
    gap: 18,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
  },
  profileDescription: {
    minHeight: 104,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  identity: { flex: 1, justifyContent: 'center', gap: 3 },
  name: {
    color: '#000000',
    fontSize: 25,
    lineHeight: 30,
    fontWeight: '700',
    letterSpacing: -0.35,
  },
  username: {
    color: '#637068',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
  },
  bio: { color: '#000000', fontSize: 14, lineHeight: 19, marginTop: 3 },
  pressed: { opacity: 0.68, transform: [{ scale: 0.98 }] },
  buttonLabel: {
    color: '#000000',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  stats: {
    minHeight: 76,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  statButton: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  statValue: { color: '#000000', fontSize: 19, lineHeight: 23, fontWeight: '700' },
  statLabel: { color: '#637068', fontSize: 12, lineHeight: 16, fontWeight: '500' },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    height: 34,
    backgroundColor: '#C9CECB',
  },
  actions: { minHeight: 44, flexDirection: 'row', gap: 10 },
  actionButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  disabledButton: { opacity: 0.5 },
  profileTabs: {
    minHeight: 62,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#D8DDDA',
    flexDirection: 'row',
  },
  profileTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 8,
  },
  activeProfileTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
  },
  tabSymbol: { color: '#637068', fontSize: 20, lineHeight: 22 },
  activeTabSymbol: { color: '#000000' },
  tabLabel: { color: '#637068', fontSize: 11, lineHeight: 14, fontWeight: '600' },
  activeTabLabel: { color: '#000000', fontWeight: '700' },
  mapSection: { gap: 12 },
  mapLoading: {
    width: '100%',
    height: 330,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    overflow: 'hidden',
  },
  feedSection: { gap: 16 },

  // Options Menu Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  menuContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingBottom: 36,
    paddingHorizontal: 20,
    gap: 4,
  },
  menuHeader: {
    alignItems: 'center',
    paddingBottom: 8,
  },
  menuHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
  },
  menuItem: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  menuItemPressed: {
    backgroundColor: '#F3F4F6',
  },
  menuItemDestructive: {
    color: '#DC2626',
    fontSize: 16,
    fontWeight: '600',
  },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E7EB',
  },
  menuDividerThick: {
    height: 8,
    backgroundColor: 'transparent',
  },
  cancelItem: {
    backgroundColor: '#F3F4F6',
  },
  cancelText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '600',
  },
});
