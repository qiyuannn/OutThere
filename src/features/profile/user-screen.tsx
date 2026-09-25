import { useCallback, useEffect, useRef, useState } from 'react';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/app-header';
import { Button } from '@/components/foundation';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/providers/auth-provider';
import { Avatar } from './components/avatar';
import { VisitedPlacesMap } from './components/visited-places-map';
import type { Profile } from './model';
import {
  cancelFollowRequest,
  getFollowCounts,
  getFollowRelationship,
  loadProfile,
  loadProfileVisitSummary,
  sendFollowRequest,
  unfollowUser,
  type ProfileVisitSummary,
  type UserFollowRelationship,
} from './service';

const EMPTY_SUMMARY: ProfileVisitSummary = { averageRating: null, places: [], visitedCount: 0 };

export function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const currentUserId = session?.user.id;
  const isOwnProfile = !id || id === currentUserId;
  const targetUserId = id || currentUserId;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [summary, setSummary] = useState<ProfileVisitSummary>(EMPTY_SUMMARY);
  const [followRelationship, setFollowRelationship] = useState<UserFollowRelationship>('none');
  const [followCounts, setFollowCounts] = useState({ followers: 0, following: 0 });
  const [togglingFollow, setTogglingFollow] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestCount = useRef(0);

  const isFollowing = followRelationship === 'following';
  const canViewDetails = isOwnProfile || isFollowing;

  const loadData = useCallback(async () => {
    if (!targetUserId) {
      setLoading(false);
      setError('User not found.');
      return;
    }

    const currentReq = ++requestCount.current;
    try {
      const [fetchedProfile, fetchedRel, fetchedCounts] = await Promise.all([
        loadProfile(targetUserId),
        currentUserId && !isOwnProfile
          ? getFollowRelationship(targetUserId).catch(() => 'none' as const)
          : ('none' as const),
        getFollowCounts(targetUserId).catch(() => ({ followers: 0, following: 0 })),
      ]);

      let fetchedSummary = EMPTY_SUMMARY;
      if (isOwnProfile || fetchedRel === 'following') {
        fetchedSummary = await loadProfileVisitSummary(targetUserId).catch(() => EMPTY_SUMMARY);
      }

      if (currentReq === requestCount.current) {
        if (!fetchedProfile) {
          setError('Profile not found.');
        } else {
          setProfile(fetchedProfile);
          setSummary(fetchedSummary);
          setFollowRelationship(fetchedRel);
          setFollowCounts(fetchedCounts);
          setError(null);
        }
      }
    } catch (e) {
      if (currentReq === requestCount.current) {
        setError(e instanceof Error ? e.message : 'Could not load profile.');
      }
    } finally {
      if (currentReq === requestCount.current) {
        setLoading(false);
      }
    }
  }, [targetUserId, currentUserId, isOwnProfile]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    void loadData();
  }, [loadData]);

  const handleToggleFollow = async () => {
    if (!currentUserId || !targetUserId || isOwnProfile || togglingFollow) return;
    const prevRel = followRelationship;

    setTogglingFollow(true);
    try {
      if (prevRel === 'following') {
        // Unfollow
        setFollowRelationship('none');
        setFollowCounts((prev) => ({
          ...prev,
          followers: Math.max(0, prev.followers - 1),
        }));
        await unfollowUser(currentUserId, targetUserId);
      } else if (prevRel === 'requested') {
        // Cancel follow request
        setFollowRelationship('none');
        await cancelFollowRequest(targetUserId);
      } else {
        // Send follow request
        setFollowRelationship('requested');
        const nextRel = await sendFollowRequest(targetUserId);
        setFollowRelationship(nextRel);
        if (nextRel === 'following') {
          setFollowCounts((prev) => ({
            ...prev,
            followers: prev.followers + 1,
          }));
          const nextSummary = await loadProfileVisitSummary(targetUserId).catch(() => EMPTY_SUMMARY);
          setSummary(nextSummary);
        }
      }
    } catch {
      setFollowRelationship(prevRel);
    } finally {
      setTogglingFollow(false);
    }
  };

  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await loadData();
    } finally {
      setRefreshing(false);
    }
  }, [refreshing, loadData]);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/search' as Href));

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.safeArea}>
      <AppHeader
        description={profile?.display_name || 'Profile'}
        showBack
        onBack={goBack}
      />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#000000" />
        </View>
      ) : error || !profile ? (
        <View style={styles.centered}>
          <ThemedText accessibilityRole="alert" style={styles.errorMessage}>
            {error ?? 'Profile not found.'}
          </ThemedText>
          <Button label="Back" onPress={goBack} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              colors={['#000000']}
              onRefresh={() => void handleRefresh()}
              refreshing={refreshing}
              tintColor="#000000"
            />
          }
        >
          <View style={styles.profileDescription}>
            <Avatar name={profile.display_name} path={profile.avatar_path} size={69} />
            <View style={styles.identity}>
              <Text style={styles.name}>{profile.display_name}</Text>
              <Text style={styles.username}>@{profile.username}</Text>
              <Text style={styles.following}>
                {followCounts.followers} Followers · {followCounts.following} Following
              </Text>
              {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
            </View>
          </View>

          {isOwnProfile ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/profile/edit')}
              style={({ pressed }) => [styles.outlineButton, pressed && styles.pressed]}
            >
              <Text style={styles.buttonLabel}>Edit Profile</Text>
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                followRelationship === 'following'
                  ? 'Unfollow'
                  : followRelationship === 'requested'
                    ? 'Requested'
                    : 'Follow'
              }
              disabled={togglingFollow || !currentUserId}
              onPress={handleToggleFollow}
              style={({ pressed }) => [
                styles.followButton,
                followRelationship === 'following'
                  ? styles.unfollowButton
                  : followRelationship === 'requested'
                    ? styles.requestedButton
                    : styles.followActionButton,
                pressed && styles.pressed,
              ]}
            >
              {togglingFollow ? (
                <ActivityIndicator
                  size="small"
                  color={followRelationship === 'none' ? '#FFFFFF' : '#000000'}
                />
              ) : (
                <Text
                  style={[
                    styles.buttonLabel,
                    followRelationship === 'following'
                      ? styles.unfollowButtonLabel
                      : followRelationship === 'requested'
                        ? styles.requestedButtonLabel
                        : styles.followActionButtonLabel,
                  ]}
                >
                  {followRelationship === 'following'
                    ? 'Unfollow'
                    : followRelationship === 'requested'
                      ? 'Requested'
                      : 'Follow'}
                </Text>
              )}
            </Pressable>
          )}

          {canViewDetails ? (
            <>
              <View style={styles.statistics}>
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>Places Visited:</Text>
                  <Text style={styles.statValue}>{summary.visitedCount}</Text>
                </View>
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>Average Rating:</Text>
                  <Text style={styles.statValue}>
                    {summary.averageRating === null ? '—' : summary.averageRating.toFixed(1)}
                  </Text>
                </View>
              </View>

              <View style={styles.actions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    if (isOwnProfile) {
                      router.push('/profile/statistics');
                    } else {
                      router.push({
                        pathname: '/search/profile/statistics',
                        params: {
                          userId: targetUserId,
                          userName: profile.display_name,
                        },
                      });
                    }
                  }}
                  style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
                >
                  <Text style={styles.buttonLabel}>View Statistics</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    if (isOwnProfile) {
                      router.push('/profile/activities');
                    } else {
                      router.push({
                        pathname: '/search/profile/activities',
                        params: {
                          userId: targetUserId,
                          userName: profile.display_name,
                        },
                      });
                    }
                  }}
                  style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
                >
                  <Text style={styles.buttonLabel}>View Past Activities</Text>
                </Pressable>
              </View>

              <View style={styles.mapSection}>
                <Text style={styles.mapHeading}>Map</Text>
                {summary.places.length > 0 ? (
                  <VisitedPlacesMap places={summary.places} />
                ) : (
                  <View style={styles.mapEmpty}>
                    <ThemedText style={styles.emptyMapText}>No visited places recorded yet.</ThemedText>
                  </View>
                )}
              </View>
            </>
          ) : (
            <View style={styles.privateAccountSection}>
              <View style={styles.lockIconContainer}>
                <ThemedText style={styles.lockIcon}>🔒</ThemedText>
              </View>
              <ThemedText style={styles.privateTitle}>This account is private</ThemedText>
              <ThemedText style={styles.privateDescription}>
                Follow {profile.display_name} to see their visited places, average rating, and map.
              </ThemedText>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 16,
  },
  errorMessage: {
    color: '#000000',
    fontSize: 15,
    textAlign: 'center',
  },
  content: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    padding: 10,
    gap: 10,
    backgroundColor: '#FFFFFF',
  },
  profileDescription: {
    minHeight: 101,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  identity: {
    flex: 1,
    minHeight: 81,
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 2,
  },
  name: {
    color: '#000000',
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '700',
  },
  username: {
    color: '#637068',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '500',
  },
  following: {
    color: '#000000',
    fontSize: 10,
    lineHeight: 15,
    fontWeight: '300',
    letterSpacing: 0.25,
  },
  bio: {
    color: '#14221D',
    fontSize: 13,
    lineHeight: 17,
    marginTop: 4,
  },
  outlineButton: {
    minHeight: 37,
    borderWidth: 1,
    borderColor: '#000000',
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followButton: {
    minHeight: 38,
    borderWidth: 1,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followActionButton: {
    backgroundColor: '#14221D',
    borderColor: '#14221D',
  },
  followActionButtonLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  unfollowButton: {
    backgroundColor: '#FFFFFF',
    borderColor: '#000000',
  },
  unfollowButtonLabel: {
    color: '#000000',
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  requestedButton: {
    backgroundColor: '#F3F4F6',
    borderColor: '#D1D5DB',
  },
  requestedButtonLabel: {
    color: '#4B5563',
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  pressed: { opacity: 0.55 },
  buttonLabel: {
    color: '#000000',
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  statistics: { padding: 10, gap: 10 },
  statRow: { flexDirection: 'row', gap: 10 },
  statLabel: { flex: 1, color: '#000000', fontSize: 12, lineHeight: 15, fontWeight: '600' },
  statValue: { flex: 1, color: '#000000', fontSize: 12, lineHeight: 15, fontWeight: '400' },
  actions: { minHeight: 37, flexDirection: 'row', gap: 10 },
  actionButton: {
    flex: 1,
    minHeight: 37,
    borderWidth: 1,
    borderColor: '#000000',
    paddingHorizontal: 10,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapSection: { padding: 10, gap: 10 },
  mapHeading: { color: '#000000', fontSize: 16, lineHeight: 19, fontWeight: '600' },
  mapEmpty: {
    width: '100%',
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  emptyMapText: {
    color: '#637068',
    fontSize: 13,
  },
  privateAccountSection: {
    width: '100%',
    paddingVertical: 40,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F2ED',
  },
  lockIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F3F6F1',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DFE5D9',
    marginBottom: 4,
  },
  lockIcon: {
    fontSize: 28,
  },
  privateTitle: {
    color: '#14221D',
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  privateDescription: {
    color: '#637068',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    maxWidth: 280,
  },
});

export default UserProfileScreen;
