import { Redirect, router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';
import { useProfile } from '@/providers/profile-provider';
import { ProfileForm } from './components/profile-form';
import { ProfileStatus } from './components/profile-status';

export default function OnboardingScreen() {
  const { session } = useAuth();
  const { profile, loading, error } = useProfile();
  async function signOut() {
    if (!supabase) throw new Error('Not configured');
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) throw error;
  }
  if (!session) return <Redirect href="/auth" />;
  if (loading || error) return <ProfileStatus />;
  if (profile?.onboarding_completed) return <Redirect href="/" />;
  return <ProfileForm onboarding onDone={() => router.replace('/')} onCancel={signOut} />;
}
