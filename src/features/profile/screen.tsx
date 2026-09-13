import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Card, Screen } from '@/components/foundation';
import { ThemedText } from '@/components/themed-text';
import { SubscriptionCard } from '@/features/subscriptions/profile-card';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers/auth-provider';
import { useProfile } from '@/providers/profile-provider';
import { Avatar } from './components/avatar';
import { CategoryWeightsCard } from './components/category-weights-card';
import { SignOutButton } from './components/sign-out';
import { BUDGETS, EXPLORATION, INTERESTS } from './model';
import type { ProfileMode } from './types';
import { useProfileCategories } from './use-profile-categories';

export default function ProfileScreen() {
  const { session } = useAuth();
  const { profile } = useProfile();
  const { updated } = useLocalSearchParams<{ updated?: string }>();
  const theme = useTheme();
  const [profileMode, setProfileMode] = useState<ProfileMode>('food');

  const categories = useProfileCategories(session?.user.id, profileMode);

  if (!profile) return null;

  return (
    <Screen title="A story only you can tell." eyebrow="PROFILE">
      {updated === '1' && (
        <ThemedText accessibilityRole="alert" themeColor="primary">
          Your profile is saved.
        </ThemedText>
      )}

      {/* User Account Info */}
      <Card>
        <View style={{ alignItems: 'center', gap: 12 }}>
          <Avatar name={profile.display_name} path={profile.avatar_path} />
          <ThemedText type="subtitle">{profile.display_name}</ThemedText>
          <ThemedText themeColor="textSecondary">@{profile.username}</ThemedText>
          <ThemedText themeColor="primary">{profile.city}</ThemedText>
        </View>
        {!!profile.bio && <ThemedText>{profile.bio}</ThemedText>}
        <Button label="Edit profile" onPress={() => router.push('/profile/edit')} />
      </Card>

      {/* Dual Profiles Segmented Mode Switcher */}
      <View accessibilityRole="tablist" style={[styles.tabs, { backgroundColor: theme.backgroundSelected }]}>
        {(['food', 'activities'] as const).map((mode) => (
          <Pressable
            key={mode}
            accessibilityRole="tab"
            accessibilityState={{ selected: profileMode === mode }}
            onPress={() => setProfileMode(mode)}
            style={({ pressed }) => [
              styles.tab,
              {
                backgroundColor: profileMode === mode ? theme.accent : 'transparent',
                opacity: pressed ? 0.75 : 1,
              },
            ]}
          >
            <ThemedText
              type="smallBold"
              style={{ color: profileMode === mode ? theme.onAccent : theme.textSecondary }}
            >
              {mode === 'food' ? '🍕 Food Profile' : '🎯 Activities Profile'}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      {/* Category Preferences Distribution & Radar Chart */}
      <CategoryWeightsCard
        mode={profileMode}
        weights={categories.weights}
        stats={categories.stats}
        loading={categories.loading}
        error={categories.error}
      />

      <Card>
        <ThemedText type="subtitle" style={{ fontSize: 24 }}>Things that draw me out</ThemedText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {INTERESTS.filter(([id]) => profile.interests.includes(id)).map(([id, label, icon]) => (
            <View key={id} style={{ padding: 12, borderRadius: 14, backgroundColor: theme.accent }}>
              <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
                {icon} {label}
              </ThemedText>
            </View>
          ))}
        </View>
      </Card>

      <Card>
        <ThemedText type="subtitle" style={{ fontSize: 24 }}>My kind of adventure</ThemedText>
        <ThemedText>Budget · {BUDGETS.find(([id]) => id === profile.budget)?.[1]}</ThemedText>
        <ThemedText>Discovery range · {profile.travel_radius_meters / 1000} km</ThemedText>
        <ThemedText>Exploration style · {EXPLORATION.find(([id]) => id === profile.exploration_style)?.[1]}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Your range sets the starting distance in Discover. Your other preferences are saved for future personalised recommendations.
        </ThemedText>
      </Card>

      <SubscriptionCard />

      <Card>
        <ThemedText type="smallBold">SIGNED IN AS</ThemedText>
        <ThemedText selectable>{session?.user.email}</ThemedText>
        <SignOutButton />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', padding: 4, gap: 4, borderRadius: 28 },
  tab: { flex: 1, minHeight: 44, padding: 10, alignItems: 'center', justifyContent: 'center', borderRadius: 24 },
});
