import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

import { isAuthConfigured } from '@/features/auth/service';
import { OutlineButton } from './outline-button';
import { Wordmark } from './wordmark';

interface WelcomeViewProps {
  busy: boolean;
  message: string;
  isError: boolean;
  onGoogleSignIn: () => void;
  onEmailSignIn: () => void;
}

export function WelcomeView({
  busy,
  message,
  isError,
  onGoogleSignIn,
  onEmailSignIn,
}: WelcomeViewProps) {
  return (
    <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.welcome}>
        <View style={styles.wordmarkStage}>
          <Wordmark />
        </View>

        {!!message && (
          <Text
            accessibilityRole={isError ? 'alert' : undefined}
            accessibilityLiveRegion="polite"
            style={styles.message}
          >
            {message}
          </Text>
        )}

        <View style={styles.welcomeActions}>
          <OutlineButton
            disabled={busy || !isAuthConfigured()}
            label={busy ? 'Please wait…' : 'Get started with Google'}
            onPress={onGoogleSignIn}
          />
          <OutlineButton
            disabled={busy}
            label="Get started with Email"
            onPress={onEmailSignIn}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  welcomeActions: {
    gap: 10,
  },
  message: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    textAlign: 'center',
  },
});
