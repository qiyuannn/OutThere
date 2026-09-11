import { useRef, useState } from 'react';
import { Redirect } from 'expo-router';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { Screen, Card, Button } from '@/components/foundation';
import { AuthField } from '@/components/auth-field';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/providers/auth-provider';
import { supabase } from '@/lib/supabase';
import { authErrorMessage, validateNewPassword } from '@/lib/auth-validation';

export default function ResetPassword() {
  const { session, recovery, finishRecovery } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [success, setSuccess] = useState(false);
  if (!session) return <Redirect href="/auth" />;
  if (!recovery) return <Redirect href="/" />;
  async function update() {
    if (submitting.current || !supabase) return;
    const invalid = validateNewPassword(password, confirmation);
    if (invalid) { setMessage(invalid); return; }
    submitting.current = true; setBusy(true); setMessage('');
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setPassword(''); setConfirmation(''); setSuccess(true);
    } catch (error) { setMessage(authErrorMessage(error)); }
    finally { submitting.current = false; setBusy(false); }
  }
  async function cancel() {
    if (submitting.current || !supabase) return;
    submitting.current = true; setBusy(true);
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) throw error;
      finishRecovery();
    } catch (error) { setMessage(authErrorMessage(error)); }
    finally { submitting.current = false; setBusy(false); }
  }
  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><Screen title={success ? 'You’re ready to go.' : 'Choose a new password.'}><Card>
    {success ? <><ThemedText>Your password has been updated.</ThemedText><Button label="Continue to OutThere" onPress={finishRecovery} /></> : <>
      <ThemedText themeColor="textSecondary">Use at least 8 characters. Make it something you haven’t used before.</ThemedText>
      <AuthField label="New password" password value={password} onChangeText={setPassword} autoComplete="new-password" textContentType="newPassword" editable={!busy} />
      <AuthField label="Confirm new password" password value={confirmation} onChangeText={setConfirmation} autoComplete="new-password" textContentType="newPassword" editable={!busy} />
      {!!message && <ThemedText accessibilityRole="alert">{message}</ThemedText>}
      <Button label={busy ? 'Please wait…' : 'Update password'} onPress={update} disabled={busy} />
      <Button label="Cancel and sign out" onPress={cancel} disabled={busy} />
    </>}
  </Card></Screen></KeyboardAvoidingView>;
}
