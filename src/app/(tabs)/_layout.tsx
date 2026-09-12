import { Redirect } from 'expo-router';
import { useProfile } from '@/providers/profile-provider';
import { ProfileStatus } from '@/features/profile/components/profile-status';
import AppTabs from '@/components/app-tabs';
import { useAuth } from '@/providers/auth-provider';
export default function TabsLayout() {
  const { profile, loading, error } = useProfile();
  const { recovery } = useAuth();
  if (recovery) return <Redirect href="/auth/reset-password" />;
  if (loading || error) return <ProfileStatus />;
  if (!profile?.onboarding_completed) return <Redirect href="/onboarding" />;
  return <AppTabs />;
}
