import { useEffect, useState } from 'react';
import { Redirect, useLocalSearchParams, router } from 'expo-router';
import { ActivityIndicator } from 'react-native';
import { Screen, Card, Button } from '@/components/foundation';
import { ThemedText } from '@/components/themed-text';
import { exchangeAuthCode } from '@/lib/auth-callback';
import { useAuth } from '@/providers/auth-provider';

export default function AuthCallback() {
  const { code, error, error_code } = useLocalSearchParams<{ code?: string; error?: string; error_code?: string }>();
  const { session, recovery } = useAuth();
  const [complete, setComplete] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    if (error || error_code || typeof code !== 'string' || !code) { setFailed(true); return; }
    Promise.resolve().then(() => exchangeAuthCode(code)).then(({ data, error: exchangeError }) => {
      if (!active) return;
      if (exchangeError || !data.session) setFailed(true);
      else setComplete(true);
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [code, error, error_code]);
  if (complete && session) return <Redirect href={recovery ? '/auth/reset-password' : '/'} />;
  return <Screen title={failed ? 'This link couldn’t be used.' : 'One moment…'}><Card>
    {failed ? <><ThemedText accessibilityRole="alert">The link may have expired, already been used, or been opened on a different device. Request a new link and open it on the same device and browser where you started.</ThemedText><Button label="Back to sign in" onPress={() => router.replace('/auth')} /></> : <ActivityIndicator accessibilityLabel="Verifying your email link" />}
  </Card></Screen>;
}
