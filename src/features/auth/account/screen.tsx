import { useEffect, useRef, useState } from 'react';
import { Redirect } from 'expo-router';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Fonts } from '@/constants/theme';
import { handleAuthCallbackUrl } from '@/lib/auth-callback';
import { authRedirectUrl } from '@/lib/auth-redirect';
import { authErrorMessage, validateCredentials } from '@/lib/auth-validation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

WebBrowser.maybeCompleteAuthSession();

const backIcon = require('../../../../assets/images/navigation/back.svg');

type Mode = 'welcome' | 'login' | 'signup' | 'forgot';

type OutlineButtonProps = {
  disabled?: boolean;
  label: string;
  onPress: () => void;
};

function OutlineButton({ disabled = false, label, onPress }: OutlineButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.outlineButton,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={styles.buttonLabel}>{label}</Text>
    </Pressable>
  );
}

function Wordmark() {
  return (
    <View accessibilityRole="header" style={styles.wordmark}>
      <Text style={styles.wordmarkIntro}>Are you ready to discover</Text>
      <View style={styles.wordmarkRow}>
        <Text style={styles.wordmarkPrefix}>what’s</Text>
        <Text style={styles.wordmarkName}>OutThere</Text>
      </View>
    </View>
  );
}

function AuthHeader({ description, onPress }: { description: string; onPress: () => void }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={10}
          onPress={onPress}
          style={({ pressed }) => [styles.headerBackButton, pressed && styles.pressed]}
        >
          <Image source={backIcon} style={styles.headerBackIcon} contentFit="contain" />
        </Pressable>
        <Text style={styles.headerBrand}>OutThere</Text>
      </View>
      <Text style={styles.headerDescription}>{description}</Text>
    </View>
  );
}

type AuthInputProps = {
  autoComplete: 'email' | 'current-password' | 'new-password';
  editable: boolean;
  keyboardType?: 'email-address';
  label: string;
  onChangeText: (value: string) => void;
  password?: boolean;
  textContentType: 'emailAddress' | 'password' | 'newPassword';
  value: string;
};

function AuthInput({ label, password = false, ...props }: AuthInputProps) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        {...props}
        accessibilityLabel={label}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry={password}
        selectionColor="#000000"
        style={styles.field}
      />
    </View>
  );
}

export default function AuthScreen() {
  const { session, recovery } = useAuth();
  const [mode, setMode] = useState<Mode>('welcome');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const isMounted = useRef(true);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [canResend, setCanResend] = useState(false);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  if (session) return <Redirect href={recovery ? '/auth/reset-password' : '/'} />;

  function switchMode(next: Mode) {
    setMode(next);
    setPassword('');
    setConfirmation('');
    setMessage('');
    setCanResend(false);
    setIsError(false);
  }

  async function submit(resend = false) {
    if (submitting.current) return;
    const invalid = validateCredentials(
      email,
      mode === 'forgot' || resend ? undefined : password,
      mode === 'signup' && !resend ? confirmation : undefined
    );
    if (invalid) {
      setIsError(true);
      setMessage(invalid);
      return;
    }
    if (!supabase) {
      setIsError(true);
      setMessage('Sign-in isn’t available yet. Please try again later.');
      return;
    }

    submitting.current = true;
    setBusy(true);
    setMessage('');
    setIsError(false);

    try {
      const address = email.trim();
      if (resend) {
        const { error } = await supabase.auth.resend({
          type: 'signup',
          email: address,
          options: { emailRedirectTo: authRedirectUrl() },
        });
        if (error) throw error;
        if (isMounted.current) {
          setMessage('If your account needs confirmation, a new link is on its way. Check your inbox and spam folder.');
        }
      } else if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: address, password });
        if (error) throw error;
        if (isMounted.current) setPassword('');
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: address,
          password,
          options: { emailRedirectTo: authRedirectUrl() },
        });
        if (error) throw error;
        if (isMounted.current) {
          setPassword('');
          setConfirmation('');
          if (!data.session) {
            setCanResend(true);
            setMessage('Check your email to confirm your account. Open the link on this device, then return here to sign in. If you already have an account, try signing in.');
          }
        }
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(address, {
          redirectTo: authRedirectUrl(),
        });
        if (error) throw error;
        if (isMounted.current) {
          setMessage('If an account exists for this email, you’ll receive a password-reset link. Open it on the same device and browser where you requested it.');
        }
      }
    } catch (error: any) {
      if (isMounted.current) {
        setIsError(true);
        setMessage(authErrorMessage(error));
        if (typeof error === 'object' && error && 'code' in error && error.code === 'email_not_confirmed') {
          setCanResend(true);
        }
      }
    } finally {
      submitting.current = false;
      if (isMounted.current) setBusy(false);
    }
  }

  async function signInWithGoogle() {
    if (submitting.current || !supabase) return;
    submitting.current = true;
    setBusy(true);
    setMessage('');
    setIsError(false);

    try {
      const redirectTo = authRedirectUrl();
      const { data, error: oAuthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });

      if (oAuthError) throw oAuthError;
      if (!data?.url) throw new Error('No authentication URL was returned.');

      if (Platform.OS === 'web') {
        let result;
        try {
          result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
        } catch (popupError: any) {
          if (typeof window !== 'undefined') {
            window.location.assign(data.url);
            return;
          }
          throw popupError;
        }

        if (result.type === 'success' && result.url) {
          await handleAuthCallbackUrl(result.url);
        }
      } else {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
        if (result.type === 'success' && result.url) {
          await handleAuthCallbackUrl(result.url);
        }
      }
    } catch (error: any) {
      const msg = authErrorMessage(error);
      if (
        msg === 'Sign in was cancelled.' ||
        error?.code === 'ERR_REQUEST_CANCELED' ||
        error?.code === 'ERR_CANCELED' ||
        error?.code === 'access_denied' ||
        error?.message === 'access_denied'
      ) {
        return;
      }
      if (isMounted.current) {
        setIsError(true);
        setMessage(msg);
      }
    } finally {
      submitting.current = false;
      if (isMounted.current) setBusy(false);
    }
  }

  if (mode === 'welcome') {
    return (
      <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.safeArea}>
        <StatusBar style="dark" />
        <View style={styles.welcome}>
          <View style={styles.wordmarkStage}>
            <Wordmark />
          </View>

          {!!message && (
            <Text accessibilityRole={isError ? 'alert' : undefined} accessibilityLiveRegion="polite" style={styles.message}>
              {message}
            </Text>
          )}

          <View style={styles.welcomeActions}>
            <OutlineButton
              disabled={busy || !supabase}
              label={busy ? 'Please wait…' : 'Get started with Google'}
              onPress={signInWithGoogle}
            />
            <OutlineButton disabled={busy} label="Get started with Email" onPress={() => switchMode('login')} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const description = mode === 'signup'
    ? 'Sign up with Email'
    : mode === 'forgot'
      ? 'Reset your Password'
      : 'Sign in with Email';
  const backMode: Mode = mode === 'login' ? 'welcome' : 'login';

  return (
    <KeyboardAvoidingView style={styles.keyboardView} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.safeArea}>
        <StatusBar style="dark" />
        <AuthHeader description={description} onPress={() => switchMode(backMode)} />

        <ScrollView
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={styles.formContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.formFields}>
            <AuthInput
              autoComplete="email"
              editable={!busy}
              keyboardType="email-address"
              label="Email"
              onChangeText={setEmail}
              textContentType="emailAddress"
              value={email}
            />

            {mode !== 'forgot' && (
              <AuthInput
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                editable={!busy}
                label="Password"
                onChangeText={setPassword}
                password
                textContentType={mode === 'signup' ? 'newPassword' : 'password'}
                value={password}
              />
            )}

            {mode === 'signup' && (
              <AuthInput
                autoComplete="new-password"
                editable={!busy}
                label="Confirm password"
                onChangeText={setConfirmation}
                password
                textContentType="newPassword"
                value={confirmation}
              />
            )}

            {mode === 'login' && (
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                hitSlop={10}
                onPress={() => switchMode('forgot')}
                style={({ pressed }) => [styles.forgotButton, pressed && styles.pressed]}
              >
                <Text style={styles.linkLabel}>Forgot password?</Text>
              </Pressable>
            )}

            {!!message && (
              <Text accessibilityRole={isError ? 'alert' : undefined} accessibilityLiveRegion="polite" style={styles.message}>
                {message}
              </Text>
            )}

            <OutlineButton
              disabled={busy || !supabase}
              label={
                busy
                  ? 'Please wait…'
                  : mode === 'signup'
                    ? 'Create Account'
                    : mode === 'forgot'
                      ? 'Send Reset Link'
                      : 'Sign In'
              }
              onPress={() => submit()}
            />

            {canResend && (
              <OutlineButton
                disabled={busy || !supabase}
                label="Resend Confirmation Email"
                onPress={() => submit(true)}
              />
            )}
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={busy}
            hitSlop={10}
            onPress={() => switchMode(mode === 'login' ? 'signup' : 'login')}
            style={({ pressed }) => [styles.bottomLink, pressed && styles.pressed]}
          >
            <Text style={styles.linkLabel}>
              {mode === 'login' ? 'Don’t have an account ? Sign Up here.' : 'Already have an account? Sign In here.'}
            </Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  welcome: {
    flex: 1,
    gap: 10,
    padding: 10,
  },
  wordmarkStage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: {
    width: 200,
    height: 47,
    justifyContent: 'center',
  },
  wordmarkIntro: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 14,
  },
  wordmarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  wordmarkPrefix: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 14,
  },
  wordmarkName: {
    color: '#000000',
    fontFamily: Fonts.mono,
    fontSize: 32,
    fontWeight: '400',
    lineHeight: 36,
  },
  welcomeActions: {
    gap: 10,
  },
  outlineButton: {
    width: '100%',
    height: 36,
    borderColor: '#000000',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  buttonLabel: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 14,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.55,
  },
  disabled: {
    opacity: 0.45,
  },
  header: {
    alignItems: 'center',
    gap: 10,
    justifyContent: 'center',
    padding: 10,
  },
  headerRow: {
    width: '100%',
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBackButton: {
    position: 'absolute',
    top: 4,
    left: 0,
    width: 24,
    height: 24,
  },
  headerBackIcon: {
    width: 24,
    height: 24,
  },
  headerBrand: {
    color: '#000000',
    fontFamily: Fonts.mono,
    fontSize: 20,
    fontWeight: '400',
    lineHeight: 24,
    textAlign: 'center',
  },
  headerDescription: {
    color: '#000000',
    fontSize: 10,
    fontWeight: '600',
    lineHeight: 12,
    textAlign: 'center',
  },
  formContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
    gap: 20,
    padding: 10,
  },
  formFields: {
    gap: 10,
  },
  fieldGroup: {
    gap: 10,
  },
  fieldLabel: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 14,
  },
  field: {
    width: '100%',
    height: 42,
    borderColor: '#D1D5DB',
    borderWidth: 1,
    backgroundColor: '#F3F4F6',
    color: '#000000',
    fontSize: 16,
    paddingHorizontal: 10,
    paddingVertical: 0,
  },
  forgotButton: {
    alignSelf: 'flex-end',
  },
  linkLabel: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 14,
    textAlign: 'center',
  },
  message: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    textAlign: 'center',
  },
  bottomLink: {
    alignSelf: 'center',
  },
});
