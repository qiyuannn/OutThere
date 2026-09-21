import { DarkTheme, DefaultTheme, ThemeProvider, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/use-theme';
import { SubscriptionProvider } from '@/providers/subscription-provider';
import { ProfileProvider } from '@/providers/profile-provider';
import { BackendProvider } from '@/providers/backend-provider';
import { AuthProvider, useAuth } from '@/providers/auth-provider';
import { PushListener } from '../features/notifications/push-listener';
export { ErrorBoundary } from 'expo-router';

function Navigation() {
  const { session, loading, initializationError, retry } = useAuth();
  const theme = useTheme();

  if (loading) {
    return (
      <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator accessibilityLabel="Restoring your session" color={theme.primary} size="small" />
      </SafeAreaView>
    );
  }
  if (initializationError) {
    return (
      <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <View style={styles.errorBox}>
          <Text style={[styles.errorTitle, { color: theme.text }]}>Let’s try that again.</Text>
          <Text style={[styles.errorMessage, { color: theme.textSecondary }]}>We couldn’t restore your session. Check your connection.</Text>
          <Pressable
            accessibilityRole="button"
            onPress={retry}
            style={({ pressed }) => [styles.outlineButton, { borderColor: theme.border, backgroundColor: theme.backgroundElement }, pressed && styles.pressed]}
          >
            <Text style={[styles.buttonLabel, { color: theme.text }]}>Try again</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        animationDuration: 300,
      }}
    >
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
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 14,
    textAlign: 'center',
  },
  outlineButton: {
    width: '100%',
    height: 40,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    marginTop: 8,
  },
  buttonLabel: {
    fontSize: 13,
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
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider
          value={{
            ...base,
            colors: {
              ...base.colors,
              primary: colors.primary,
              background: colors.background,
              card: colors.backgroundElement,
              text: colors.text,
              border: colors.border,
            },
          }}
        >
          <BackendProvider>
            <AuthProvider>
              <SubscriptionProvider>
                <ProfileProvider>
                  <StatusBar style={dark ? 'light' : 'dark'} />
                  <PushListener />
                  <Navigation />
                </ProfileProvider>
              </SubscriptionProvider>
            </AuthProvider>
          </BackendProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
