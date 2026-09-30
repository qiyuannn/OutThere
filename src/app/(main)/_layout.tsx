import { Redirect, Stack } from 'expo-router';
import { useProfile } from '@/providers/profile-provider';
import { ProfileStatus } from '@/features/profile/components/profile-status';
import { useAuth } from '@/providers/auth-provider';
export default function MainLayout() {
  const { profile, loading, error } = useProfile();
  const { recovery } = useAuth();
  if (recovery) return <Redirect href="/auth/reset-password" />;
  if (loading || error) return <ProfileStatus />;
  if (!profile?.onboarding_completed) return <Redirect href="/onboarding" />;
  // Keep shared subpages in one stack so Back restores their actual opener.
  return <Stack initialRouteName="(tabs)" screenOptions={{ headerShown: false }} />;
}
