import { StatusBar } from 'expo-status-bar';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { isAuthConfigured } from '@/features/auth/service';
import type { Mode } from '../use-account-auth';
import { AuthHeader } from './auth-header';
import { FormFields } from './form-fields';
import { OutlineButton } from './outline-button';

interface AccountFormProps {
  mode: Mode;
  email: string;
  setEmail: (val: string) => void;
  password: string;
  setPassword: (val: string) => void;
  confirmation: string;
  setConfirmation: (val: string) => void;
  busy: boolean;
  message: string;
  isError: boolean;
  canResend: boolean;
  onSwitchMode: (next: Mode) => void;
  onSubmit: (resend?: boolean) => void;
}

export function AccountForm(props: AccountFormProps) {
  const { mode, busy, message, isError, canResend, onSwitchMode, onSubmit } = props;

  const description =
    mode === 'signup'
      ? 'Sign up with Email'
      : mode === 'forgot'
        ? 'Reset your Password'
        : 'Sign in with Email';
  const backMode: Mode = mode === 'login' ? 'welcome' : 'login';

  const submitLabel = busy
    ? 'Please wait…'
    : mode === 'signup'
      ? 'Create Account'
      : mode === 'forgot'
        ? 'Send Reset Link'
        : 'Sign In';

  return (
    <KeyboardAvoidingView style={styles.keyboardView} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.safeArea}>
        <StatusBar style="dark" />
        <AuthHeader description={description} onPress={() => onSwitchMode(backMode)} />

        <ScrollView
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={styles.formContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.formFields}>
            <FormFields {...props} />

            {!!message && (
              <Text accessibilityRole={isError ? 'alert' : undefined} accessibilityLiveRegion="polite" style={styles.message}>
                {message}
              </Text>
            )}

            <OutlineButton disabled={busy || !isAuthConfigured()} label={submitLabel} onPress={() => onSubmit()} />

            {canResend && (
              <OutlineButton
                disabled={busy || !isAuthConfigured()}
                label="Resend Confirmation Email"
                onPress={() => onSubmit(true)}
              />
            )}
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={busy}
            hitSlop={10}
            onPress={() => onSwitchMode(mode === 'login' ? 'signup' : 'login')}
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
  keyboardView: { flex: 1, backgroundColor: '#FFFFFF' },
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  formContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
    gap: 20,
    padding: 10,
  },
  formFields: { gap: 10 },
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
  bottomLink: { alignSelf: 'center' },
  pressed: { opacity: 0.55 },
});
