import { DarkTheme, DefaultTheme, ThemeProvider, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/use-theme';
import { SubscriptionProvider } from '@/providers/subscription-provider';
import { ProfileProvider } from '@/providers/profile-provider';
import { BackendProvider } from '@/providers/backend-provider';
import { AuthProvider, useAuth } from '@/providers/auth-provider';
export { ErrorBoundary } from 'expo-router';

function Navigation() {
  const { session, loading, initializationError, retry } = useAuth();
  if (loading) {
    return (
      <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={styles.loadingContainer}>
        <ActivityIndicator accessibilityLabel="Restoring your session" color="#000000" size="small" />
      </SafeAreaView>
    );
  }
  if (initializationError) {
    return (
      <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={styles.loadingContainer}>
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>Let’s try that again.</Text>
          <Text style={styles.errorMessage}>We couldn’t restore your session. Check your connection.</Text>
          <Pressable
            accessibilityRole="button"
            onPress={retry}
            style={({ pressed }) => [styles.outlineButton, pressed && styles.pressed]}
          >
            <Text style={styles.buttonLabel}>Try again</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="auth" />
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
    </Stack>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBox: {
    width: '100%',
    maxWidth: 400,
    padding: 24,
    gap: 12,
    alignItems: 'center',
  },
  errorTitle: {
    color: '#000000',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  errorMessage: {
    color: '#6B7280',
    fontSize: 14,
    textAlign: 'center',
  },
  outlineButton: {
    width: '100%',
    height: 36,
    borderColor: '#000000',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    marginTop: 8,
  },
  buttonLabel: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.55,
  },
});

export default function RootLayout() {
  const dark = useColorScheme() === 'dark';
  const colors = useTheme();
  const base = dark ? DarkTheme : DefaultTheme;
  return <SafeAreaProvider><ThemeProvider value={{ ...base, colors: { ...base.colors, primary: colors.primary, background: colors.background, card: colors.backgroundElement, text: colors.text, border: colors.border } }}>
    <BackendProvider><AuthProvider><SubscriptionProvider><ProfileProvider><StatusBar style={dark ? 'light' : 'dark'} /><Navigation /></ProfileProvider></SubscriptionProvider></AuthProvider></BackendProvider>
  </ThemeProvider></SafeAreaProvider>;
}
