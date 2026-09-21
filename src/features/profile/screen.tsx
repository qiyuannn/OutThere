import { useCallback, useState } from 'react';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/app-header';
import { readSocialSummary } from '@/features/social/api';
import { useNetworkStatus } from '@/features/social/hooks';
import type { SocialSummary } from '@/features/social/types';
import { useAuth } from '@/providers/auth-provider';
import { useProfile } from '@/providers/profile-provider';
import { Avatar } from './components/avatar';
import { VisitedPlacesMap } from './components/visited-places-map';
import { loadProfileVisitSummary, type ProfileVisitSummary } from './service';
import { SectionHeading, StatusBanner } from '@/components/ui-system';

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
        {updated === '1' ? <StatusBanner>Your profile is saved.</StatusBanner> : null}

        <View style={styles.profileDescription}>
          <Avatar name={profile.display_name} path={profile.avatar_path} size={84} />
          <View style={styles.identity}>
            <Text style={styles.name}>{profile.display_name}</Text>
            <Text style={styles.username}>@{profile.username}</Text>
            {profile.bio ? <Text numberOfLines={3} style={styles.bio}>{profile.bio}</Text> : null}
          </View>
        </View>

        <View style={styles.stats}>
          <StatButton label="Friends" value={socialLoading ? '—' : String(social.friends)} onPress={() => router.push('/feed/people')} />
          <View style={styles.statDivider} />
          <StatButton label="Visited" value={loadingSummary ? '—' : String(summary.visitedCount)} onPress={() => router.push('/profile/activities')} />
          <View style={styles.statDivider} />
          <StatButton label="Avg rating" value={loadingSummary || summary.averageRating === null ? '—' : summary.averageRating.toFixed(1)} onPress={() => router.push('/profile/statistics')} />
        </View>

        {offline ? <StatusBanner>Offline · social counts may be outdated</StatusBanner>
          : socialError ? <Pressable accessibilityRole="button" onPress={() => { loadSocial(); }}><StatusBanner tone="error">Couldn’t load social counts · Tap to retry</StatusBanner></Pressable>
            : social.incoming > 0 ? <Pressable accessibilityRole="button" onPress={() => router.push('/feed/people')}><StatusBanner>{social.incoming} pending friend {social.incoming === 1 ? 'request' : 'requests'}</StatusBanner></Pressable> : null}

        <View style={styles.actions}>
          <ProfileButton label="Edit profile" onPress={() => router.push('/profile/edit')} />
          <ProfileButton label="Settings" onPress={() => router.push('/profile/account')} />
        </View>

        <View accessibilityRole="tablist" style={styles.profileTabs}>
          <ProfileTab label="Ratings" symbol="★" onPress={() => router.push('/rankings')} />
          <ProfileTab label="Activity" symbol="▦" onPress={() => router.push('/profile/activities')} />
          <ProfileTab label="Map" symbol="⌖" onPress={() => router.push('/profile/statistics')} />
        </View>

        <View style={styles.mapSection}>
          <SectionHeading eyebrow="Your footprint" title="Places you’ve been" />
          {loadingSummary ? <View style={styles.mapLoading}><ActivityIndicator color="#000000" /></View>
            : <VisitedPlacesMap places={summary.places} />}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatButton({ label, onPress, value }: { label: string; onPress: () => void; value: string }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.statButton, pressed && styles.pressed]}>
    <Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text>
  </Pressable>;
}

function ProfileButton({ label, onPress }: { label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}>
    <Text style={styles.buttonLabel}>{label}</Text>
  </Pressable>;
}

function ProfileTab({ label, onPress, symbol }: { label: string; onPress: () => void; symbol: string }) {
  return <Pressable accessibilityRole="tab" onPress={onPress} style={({ pressed }) => [styles.profileTab, pressed && styles.pressed]}>
    <Text style={styles.tabSymbol}>{symbol}</Text><Text style={styles.tabLabel}>{label}</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: 18, paddingTop: 20, paddingBottom: 120, gap: 18, backgroundColor: '#FFFFFF' },
  savedMessage: { color: '#000000', fontSize: 12, lineHeight: 15, textAlign: 'center' },
  profileDescription: { minHeight: 104, flexDirection: 'row', alignItems: 'center', gap: 16 },
  identity: { flex: 1, justifyContent: 'center', gap: 3 },
  name: { color: '#000000', fontSize: 25, lineHeight: 30, fontWeight: '700', letterSpacing: -0.35 },
  username: { color: '#637068', fontSize: 13, lineHeight: 18, fontWeight: '400' },
  bio: { color: '#000000', fontSize: 14, lineHeight: 19, marginTop: 3 },
  socialCounts: { color: '#000000', fontSize: 10, lineHeight: 15, fontWeight: '500', letterSpacing: 0.25 },
  socialError: { color: '#9A3412', fontSize: 10, lineHeight: 15, fontWeight: '600', letterSpacing: 0.25 },
  pressed: { opacity: 0.68, transform: [{ scale: 0.98 }] },
  buttonLabel: { color: '#000000', fontSize: 13, lineHeight: 17, fontWeight: '700', textAlign: 'center' },
  stats: { minHeight: 76, borderRadius: 24, backgroundColor: '#F3F4F6', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
  statButton: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  statValue: { color: '#000000', fontSize: 19, lineHeight: 23, fontWeight: '700' },
  statLabel: { color: '#637068', fontSize: 12, lineHeight: 16, fontWeight: '500' },
  statDivider: { width: StyleSheet.hairlineWidth, height: 34, backgroundColor: '#C9CECB' },
  actions: { minHeight: 44, flexDirection: 'row', gap: 10 },
  actionButton: { flex: 1, minHeight: 44, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F4F6' },
  profileTabs: { minHeight: 62, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#D8DDDA', flexDirection: 'row' },
  profileTab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  tabSymbol: { color: '#000000', fontSize: 20, lineHeight: 22 },
  tabLabel: { color: '#637068', fontSize: 11, lineHeight: 14, fontWeight: '600' },
  mapSection: { gap: 12 },
  mapLoading: { width: '100%', height: 330, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F4F6', overflow: 'hidden' },
});
