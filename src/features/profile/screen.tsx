import { useCallback, useState } from 'react';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/app-header';
import { SubscriptionCard } from '@/features/subscriptions/profile-card';
import { readSocialSummary } from '@/features/social/api';
import { useNetworkStatus } from '@/features/social/hooks';
import type { SocialSummary } from '@/features/social/types';
import { useAuth } from '@/providers/auth-provider';
import { useProfile } from '@/providers/profile-provider';
import { Avatar } from './components/avatar';
import { SignOutButton } from './components/sign-out';
import { VisitedPlacesMap } from './components/visited-places-map';
import { loadProfileVisitSummary, type ProfileVisitSummary } from './service';

const EMPTY_SUMMARY: ProfileVisitSummary = { averageRating: null, places: [], visitedCount: 0 };
const EMPTY_SOCIAL: SocialSummary = { enabled: false, friends: 0, incoming: 0, outgoing: 0, unread: 0 };

export default function ProfileScreen() {
  const { session } = useAuth();
  const { profile } = useProfile();
  const { updated } = useLocalSearchParams<{ updated?: string }>();
  const [summary, setSummary] = useState<ProfileVisitSummary>(EMPTY_SUMMARY);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [social, setSocial] = useState<SocialSummary>(EMPTY_SOCIAL);
  const [socialLoading, setSocialLoading] = useState(true);
  const [socialError, setSocialError] = useState(false);
  const { offline } = useNetworkStatus();

  useFocusEffect(useCallback(() => {
    let active = true;
    const userId = session?.user.id;
    if (!userId) {
      setLoadingSummary(false);
      return () => { active = false; };
    }
    setLoadingSummary(true);
    void loadProfileVisitSummary(userId)
      .then((next) => { if (active) setSummary(next); })
      .catch(() => { if (active) setSummary(EMPTY_SUMMARY); })
      .finally(() => { if (active) setLoadingSummary(false); });
    return () => { active = false; };
  }, [session?.user.id]));

  const loadSocial = useCallback(() => {
    let active = true;
    if (!session?.user.id || offline) { setSocialLoading(false); return () => { active = false; }; }
    setSocialLoading(true); setSocialError(false);
    void readSocialSummary()
      .then((next) => { if (active) setSocial(next); })
      .catch(() => { if (active) setSocialError(true); })
      .finally(() => { if (active) setSocialLoading(false); });
    return () => { active = false; };
  }, [offline, session?.user.id]);

  useFocusEffect(loadSocial);

  if (!profile) return null;

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.safeArea}>
      <AppHeader brandLeading description="My Profile" />
      <ScrollView contentContainerStyle={styles.content}>
        {updated === '1' ? <Text accessibilityRole="alert" style={styles.savedMessage}>Your profile is saved.</Text> : null}

        <View style={styles.profileDescription}>
          <Avatar name={profile.display_name} path={profile.avatar_path} size={69} />
          <View style={styles.identity}>
            <Text style={styles.name}>{profile.display_name}</Text>
            <Text style={styles.username}>@{profile.username}</Text>
            {socialLoading ? <Text style={styles.socialCounts}>Loading social counts…</Text>
              : offline ? <Text accessibilityRole="alert" style={styles.socialCounts}>Offline · counts may be outdated</Text>
                : socialError ? <Pressable accessibilityRole="button" onPress={() => { loadSocial(); }}><Text style={styles.socialError}>Couldn’t load counts · Try again</Text></Pressable>
                  : <Text style={styles.socialCounts}>{social.friends} {social.friends === 1 ? 'friend' : 'friends'} · {social.incoming} incoming</Text>}
          </View>
        </View>

        <Pressable accessibilityRole="button" onPress={() => router.push('/profile/edit')}
          style={({ pressed }) => [styles.outlineButton, pressed && styles.pressed]}>
          <Text style={styles.buttonLabel}>Edit Profile</Text>
        </Pressable>

        <Pressable accessibilityRole="button" onPress={() => router.push('/rankings')}
          style={({ pressed }) => [styles.outlineButton, pressed && styles.pressed]}>
          <Text style={styles.buttonLabel}>My Rankings</Text>
        </Pressable>

        <View style={styles.actions}>
          <Pressable accessibilityRole="button" onPress={() => router.push('/feed/people')}
            style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}>
            <Text style={styles.buttonLabel}>Friends{social.incoming ? ` (${social.incoming})` : ''}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => router.push('/feed/privacy')}
            style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}>
            <Text style={styles.buttonLabel}>Privacy & Sharing</Text>
          </Pressable>
        </View>

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

        <SubscriptionCard />
        <Pressable accessibilityRole="button" onPress={() => router.push('/profile/account')}
          style={({ pressed }) => [styles.outlineButton, pressed && styles.pressed]}>
          <Text style={styles.buttonLabel}>Account & Privacy</Text>
        </Pressable>
        <SignOutButton />
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
  name: { color: '#000000', fontSize: 20, lineHeight: 24, fontWeight: '700' },
  username: { color: '#000000', fontSize: 10, lineHeight: 15, fontWeight: '300', letterSpacing: 0.25 },
  socialCounts: { color: '#000000', fontSize: 10, lineHeight: 15, fontWeight: '500', letterSpacing: 0.25 },
  socialError: { color: '#9A3412', fontSize: 10, lineHeight: 15, fontWeight: '600', letterSpacing: 0.25 },
  outlineButton: { minHeight: 37, borderWidth: 1, borderColor: '#000000', padding: 10, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.55 },
  buttonLabel: { color: '#000000', fontSize: 12, lineHeight: 15, fontWeight: '600', textAlign: 'center' },
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
