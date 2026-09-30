import { Redirect, router } from 'expo-router';
import { useAuth } from '@/providers/auth-provider';
import { useProfile } from '@/providers/profile-provider';
import { ProfileForm } from './components/profile-form';
import { ProfileStatus } from './components/profile-status';

export default function OnboardingScreen() {
  const { session, signOut } = useAuth();
  const { profile, loading, error } = useProfile();
  async function handleSignOut() {
    const { error: signOutError } = await signOut({ scope: 'local' });
    if (signOutError) throw signOutError;
  }
  if (!session) return <Redirect href="/auth" />;
  if (loading || error) return <ProfileStatus />;
  if (profile?.onboarding_completed) return <Redirect href="/" />;
  return <ProfileForm onboarding onDone={() => router.replace('/')} onCancel={handleSignOut} />;
}
