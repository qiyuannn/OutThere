import { useState } from 'react';
import { Button } from '@/components/foundation';
import { ThemedText } from '@/components/themed-text';
import { supabase } from '@/lib/supabase';
import { authErrorMessage } from '@/lib/auth-validation';

export function SignOutButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function signOut() {
    if (!supabase || busy) return;
    setBusy(true); setError('');
    try {
      const result = await supabase.auth.signOut({ scope: 'local' });
      if (result.error) throw result.error;
    } catch (reason) { setError(authErrorMessage(reason)); }
    finally { setBusy(false); }
  }
  return <>{!!error && <ThemedText accessibilityRole="alert">{error}</ThemedText>}<Button label={busy ? 'Signing out…' : 'Sign out'} onPress={signOut} disabled={busy} /></>;
}
