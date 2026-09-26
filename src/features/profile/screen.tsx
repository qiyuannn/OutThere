import { useCallback, useEffect, useRef, useState } from 'react';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/app-header';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';
import { useProfile } from '@/providers/profile-provider';
import { Avatar } from './components/avatar';
import { VisitedPlacesMap } from './components/visited-places-map';
import { getFollowCounts, loadProfileVisitSummary, type ProfileVisitSummary } from './service';

const EMPTY_SUMMARY: ProfileVisitSummary = { averageRating: null, places: [], visitedCount: 0 };

export default function ProfileScreen() {
  const { session } = useAuth();
  const { profile, reload } = useProfile();
  const { updated } = useLocalSearchParams<{ updated?: string }>();
  const [summary, setSummary] = useState<ProfileVisitSummary>(EMPTY_SUMMARY);
  const [followCounts, setFollowCounts] = useState({ followers: 0, following: 0 });
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const summaryRequest = useRef(0);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const handleLogout = useCallback(async () => {
    if (!supabase || loggingOut) return;
    setLoggingOut(true);
    try {
      const result = await supabase.auth.signOut({ scope: 'local' });
      if (result.error) throw result.error;
    } catch {
      // Allow retry if sign out failed
    } finally {
      if (isMounted.current) {
        setLoggingOut(false);
      }
    }
  }, [loggingOut]);

  const reloadSummary = useCallback(async () => {
    const id = ++summaryRequest.current;
    const userId = session?.user.id;
    if (!userId) {
      setLoadingSummary(false);
      return;
    }

    try {
      const [next, counts] = await Promise.all([
        loadProfileVisitSummary(userId),
        getFollowCounts(userId).catch(() => ({ followers: 0, following: 0 })),
      ]);
      if (id === summaryRequest.current) {
        setSummary(next);
        setFollowCounts(counts);
      }
    } catch {
      if (id === summaryRequest.current) setSummary(EMPTY_SUMMARY);
    } finally {
      if (id === summaryRequest.current) setLoadingSummary(false);
    }
  }, [session?.user.id]);

  useFocusEffect(useCallback(() => {
    setLoadingSummary(true);
    void reloadSummary();
    return () => { summaryRequest.current += 1; };
  }, [reloadSummary]));

  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await Promise.all([reload({ background: true }), reloadSummary()]);
    } finally {
      setRefreshing(false);
    }
  }, [refreshing, reload, reloadSummary]);

  if (!profile) return null;

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.safeArea}>
      <AppHeader brandLeading description="My Profile" />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={(
          <RefreshControl
            colors={['#000000']}
            onRefresh={() => void handleRefresh()}
            refreshing={refreshing}
            tintColor="#000000"
          />
        )}
      >
        {updated === '1' ? <Text accessibilityRole="alert" style={styles.savedMessage}>Your profile is saved.</Text> : null}

        <View style={styles.profileDescription}>
          <Avatar name={profile.display_name} path={profile.avatar_path} size={69} />
          <View style={styles.identity}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>{profile.display_name}</Text>
              {profile.is_private ? (
                <View style={styles.privateBadge}>
                  <Text style={styles.privateBadgeText}>🔒 Private</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.following}>
              {followCounts.followers} Followers · {followCounts.following} Following
            </Text>
          </View>
        </View>

        <Pressable accessibilityRole="button" onPress={() => router.push('/profile/edit')}
          style={({ pressed }) => [styles.outlineButton, pressed && styles.pressed]}>
          <Text style={styles.buttonLabel}>Edit Profile</Text>
        </Pressable>

        <View style={styles.statistics}>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Places Visited:</Text>
            <Text style={styles.statValue}>{loadingSummary ? '—' : summary.visitedCount}</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Average Rating:</Text>
            <Text style={styles.statValue}>{loadingSummary || summary.averageRating === null ? '—' : summary.averageRating.toFixed(1)}</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable accessibilityRole="button" onPress={() => router.push('/profile/statistics')}
            style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}>
            <Text style={styles.buttonLabel}>View Statistics</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => router.push('/profile/activities')}
            style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}>
            <Text style={styles.buttonLabel}>View Past Activities</Text>
          </Pressable>
        </View>

        <View style={styles.mapSection}>
          <Text style={styles.mapHeading}>Map</Text>
          {loadingSummary ? <View style={styles.mapLoading}><ActivityIndicator color="#000000" /></View>
            : <VisitedPlacesMap places={summary.places} />}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: loggingOut }}
          disabled={loggingOut}
          onPress={() => void handleLogout()}
          style={({ pressed }) => [
            styles.logoutButton,
            pressed && styles.pressed,
            loggingOut && styles.disabled,
          ]}
        >
          {loggingOut ? (
            <ActivityIndicator color="#DC2626" size="small" />
          ) : (
            <Text style={styles.logoutButtonLabel}>Log Out</Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: 10, gap: 10, backgroundColor: '#FFFFFF' },
  savedMessage: { color: '#000000', fontSize: 12, lineHeight: 15, textAlign: 'center' },
  profileDescription: { minHeight: 101, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  identity: { flex: 1, minHeight: 81, justifyContent: 'center', paddingVertical: 16 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  privateBadge: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  privateBadgeText: { color: '#4B5563', fontSize: 11, fontWeight: '600' },
  name: { color: '#000000', fontSize: 20, lineHeight: 24, fontWeight: '700' },
  following: { color: '#000000', fontSize: 10, lineHeight: 15, fontWeight: '300', letterSpacing: 0.25 },
  outlineButton: { minHeight: 37, borderWidth: 1, borderColor: '#000000', padding: 10, alignItems: 'center', justifyContent: 'center' },
  logoutButton: { minHeight: 37, borderWidth: 1, borderColor: '#DC2626', padding: 10, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.55 },
  disabled: { opacity: 0.45 },
  buttonLabel: { color: '#000000', fontSize: 12, lineHeight: 15, fontWeight: '600', textAlign: 'center' },
  logoutButtonLabel: { color: '#DC2626', fontSize: 12, lineHeight: 15, fontWeight: '600', textAlign: 'center' },
  statistics: { padding: 10, gap: 10 },
  statRow: { flexDirection: 'row', gap: 10 },
  statLabel: { flex: 1, color: '#000000', fontSize: 12, lineHeight: 15, fontWeight: '600' },
  statValue: { flex: 1, color: '#000000', fontSize: 12, lineHeight: 15, fontWeight: '400' },
  actions: { minHeight: 37, flexDirection: 'row', gap: 10 },
  actionButton: { flex: 1, minHeight: 37, borderWidth: 1, borderColor: '#000000', paddingHorizontal: 10, paddingVertical: 7, alignItems: 'center', justifyContent: 'center' },
  mapSection: { padding: 10, gap: 10 },
  mapHeading: { color: '#000000', fontSize: 16, lineHeight: 19, fontWeight: '600' },
  mapLoading: { width: '100%', height: 330, alignItems: 'center', justifyContent: 'center', backgroundColor: '#D9D9D9' },
});
