import { useRef, useState } from 'react';
import { Redirect } from 'expo-router';
import { KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { Screen, Card, Button } from '@/components/foundation';
import { ThemedText } from '@/components/themed-text';
import { AuthField } from '@/features/auth/components/auth-field';
import { supabase } from '@/lib/supabase';
import { authErrorMessage, validateCredentials } from '@/lib/auth-validation';
import { authRedirectUrl } from '@/lib/auth-redirect';
import { useAuth } from '@/providers/auth-provider';

type Mode = 'login' | 'signup' | 'forgot';
export default function AuthScreen() {
  const { session, recovery } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [canResend, setCanResend] = useState(false);

  if (session) return <Redirect href={recovery ? '/auth/reset-password' : '/'} />;
  function switchMode(next: Mode) {
    setMode(next); setPassword(''); setConfirmation(''); setMessage(''); setCanResend(false);
  }
  async function submit(resend = false) {
    if (submitting.current) return;
    const invalid = validateCredentials(email, mode === 'forgot' || resend ? undefined : password, mode === 'signup' && !resend ? confirmation : undefined);
    if (invalid) { setIsError(true); setMessage(invalid); return; }
    if (!supabase) { setIsError(true); setMessage('Sign-in isn’t available yet. Please try again later.'); return; }
    submitting.current = true; setBusy(true); setMessage(''); setIsError(false);
    try {
      const address = email.trim();
      if (resend) {
        const { error } = await supabase.auth.resend({ type: 'signup', email: address, options: { emailRedirectTo: authRedirectUrl() } });
        if (error) throw error;
        setMessage('If your account needs confirmation, a new link is on its way. Check your inbox and spam folder.');
      } else if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: address, password });
        if (error) throw error;
        setPassword('');
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email: address, password, options: { emailRedirectTo: authRedirectUrl() } });
        if (error) throw error;
        setPassword(''); setConfirmation('');
        if (!data.session) { setCanResend(true); setMessage('Check your email to confirm your account. Open the link on this device, then return here to sign in. If you already have an account, try signing in.'); }
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(address, { redirectTo: authRedirectUrl() });
        if (error) throw error;
        setMessage('If an account exists for this email, you’ll receive a password-reset link. Open it on the same device and browser where you requested it.');
      }
    } catch (error) {
      setIsError(true); setMessage(authErrorMessage(error));
      if (typeof error === 'object' && error && 'code' in error && error.code === 'email_not_confirmed') setCanResend(true);
    } finally { submitting.current = false; setBusy(false); }
  }
  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <Screen title={mode === 'signup' ? 'Your next adventure starts here.' : mode === 'forgot' ? 'Let’s get you back out there.' : 'Good to see you again.'}>
      <Card><ThemedText type="subtitle" style={{ fontSize: 26 }}>{mode === 'signup' ? 'Create your account' : mode === 'forgot' ? 'Reset your password' : 'Welcome to OutThere'}</ThemedText>
        <ThemedText themeColor="textSecondary">{mode === 'forgot' ? 'Enter your email and we’ll send you a reset link.' : 'A little curiosity can take you a long way.'}</ThemedText>
        {!supabase && <ThemedText accessibilityRole="alert">Sign-in is not available yet. Please try again later.</ThemedText>}
        <AuthField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" textContentType="emailAddress" placeholder="you@example.com" editable={!busy} />
        {mode !== 'forgot' && <AuthField label="Password" password value={password} onChangeText={setPassword} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} textContentType={mode === 'signup' ? 'newPassword' : 'password'} editable={!busy} />}
        {mode === 'signup' && <><ThemedText type="small" themeColor="textSecondary">Use at least 8 characters.</ThemedText><AuthField label="Confirm password" password value={confirmation} onChangeText={setConfirmation} autoComplete="new-password" textContentType="newPassword" editable={!busy} /></>}
        {!!message && <ThemedText accessibilityRole={isError ? 'alert' : undefined} accessibilityLiveRegion="polite">{message}</ThemedText>}
        <Button disabled={busy || !supabase} label={busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : mode === 'forgot' ? 'Send reset link' : 'Sign in'} onPress={() => submit()} />
        {canResend && <Button disabled={busy || !supabase} label="Resend confirmation email" onPress={() => submit(true)} />}
        {mode === 'login' && <Pressable accessibilityRole="button" disabled={busy} onPress={() => switchMode('forgot')} style={{ padding: 14, minHeight: 48 }}><ThemedText themeColor="primary">Forgot password?</ThemedText></Pressable>}
      </Card>
      <Button disabled={busy} label={mode === 'login' ? 'New here? Create an account' : 'Back to sign in'} onPress={() => switchMode(mode === 'login' ? 'signup' : 'login')} />
    </Screen>
  </KeyboardAvoidingView>;
}
