import { SubscriptionCard } from '@/features/subscriptions/profile-card';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Card, Screen } from '@/components/foundation';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/providers/auth-provider';
import { useProfile } from '@/providers/profile-provider';
import { useTheme } from '@/hooks/use-theme';
import { Avatar } from './components/avatar';
import { SignOutButton } from './components/sign-out';
import { BUDGETS, EXPLORATION, INTERESTS } from './model';

export default function ProfileScreen() {
  const { session } = useAuth();
  const { profile } = useProfile();
  const { updated } = useLocalSearchParams<{ updated?: string }>();
  const theme = useTheme();
  if (!profile) return null;
  return <Screen title="A story only you can tell." eyebrow="PROFILE">
    {updated === '1' && <ThemedText accessibilityRole="alert" themeColor="primary">Your profile is saved.</ThemedText>}
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
    <Card>
      <ThemedText type="subtitle" style={{ fontSize: 24 }}>Things that draw me out</ThemedText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{INTERESTS.filter(([id]) => profile.interests.includes(id)).map(([id, label, icon]) => <View key={id} style={{ padding: 12, borderRadius: 14, backgroundColor: theme.accent }}><ThemedText type="smallBold" style={{ color: theme.onAccent }}>{icon} {label}</ThemedText></View>)}</View>
    </Card>
    <Card>
      <ThemedText type="subtitle" style={{ fontSize: 24 }}>My kind of adventure</ThemedText>
      <ThemedText>Budget · {BUDGETS.find(([id]) => id === profile.budget)?.[1]}</ThemedText>
      <ThemedText>Discovery range · {profile.travel_radius_meters / 1000} km</ThemedText>
      <ThemedText>Exploration style · {EXPLORATION.find(([id]) => id === profile.exploration_style)?.[1]}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">Your range sets the starting distance in Discover. Your other preferences are saved for future personalised recommendations.</ThemedText>
    </Card>
    <SubscriptionCard />
    <Card><ThemedText type="smallBold">SIGNED IN AS</ThemedText><ThemedText selectable>{session?.user.email}</ThemedText><SignOutButton /></Card>
  </Screen>;
}
