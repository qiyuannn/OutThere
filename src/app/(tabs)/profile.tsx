import { useState } from 'react';
import { Button, Card, EmptyState, Screen } from '@/components/foundation';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/providers/auth-provider';
import { supabase } from '@/lib/supabase';
import { authErrorMessage } from '@/lib/auth-validation';

export default function ProfileScreen() {
  const { session } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function signOut() {
    if (!supabase || busy) return;
    setBusy(true); setError('');
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) throw error;
    } catch (error) { setError(authErrorMessage(error)); }
    finally { setBusy(false); }
  }
  return <Screen title="A story only you can tell." eyebrow="PROFILE">
    <Card><ThemedText type="smallBold">SIGNED IN AS</ThemedText><ThemedText selectable>{session?.user.email}</ThemedText>
      {!!error && <ThemedText accessibilityRole="alert">{error}</ThemedText>}
      <Button label={busy ? 'Signing out…' : 'Sign out'} onPress={signOut} disabled={busy} />
    </Card>
    <EmptyState title="Your explorer profile" description="Your interests, XP, and memories will live here as your adventures begin. Profile setup is coming next." />
  </Screen>;
}
