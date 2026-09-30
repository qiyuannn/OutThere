import { Pressable, StyleSheet, Text } from 'react-native';

import type { Mode } from '../use-account-auth';
import { AuthInput } from './auth-input';

interface FormFieldsProps {
  mode: Mode;
  email: string;
  setEmail: (val: string) => void;
  password: string;
  setPassword: (val: string) => void;
  confirmation: string;
  setConfirmation: (val: string) => void;
  busy: boolean;
  onSwitchMode: (next: Mode) => void;
}

export function FormFields({
  mode,
  email,
  setEmail,
  password,
  setPassword,
  confirmation,
  setConfirmation,
  busy,
  onSwitchMode,
}: FormFieldsProps) {
  return (
    <>
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
          onPress={() => onSwitchMode('forgot')}
          style={({ pressed }) => [styles.forgotButton, pressed && styles.pressed]}
        >
          <Text style={styles.linkLabel}>Forgot password?</Text>
        </Pressable>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  forgotButton: { alignSelf: 'flex-end' },
  linkLabel: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 14,
    textAlign: 'center',
  },
  pressed: { opacity: 0.55 },
});
