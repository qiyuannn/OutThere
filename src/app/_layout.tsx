import { DarkTheme, DefaultTheme, ThemeProvider, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/use-theme';
import { BackendProvider } from '@/providers/backend-provider';
import { AuthProvider, useAuth } from '@/providers/auth-provider';
import { Screen, Button } from '@/components/foundation';
import { ThemedText } from '@/components/themed-text';
export { ErrorBoundary } from 'expo-router';

function Navigation() {
  const { session, loading, initializationError, retry } = useAuth();
  const theme = useTheme();
  if (loading) return <Screen title="Welcome back."><ActivityIndicator accessibilityLabel="Restoring your session" color={theme.primary} /></Screen>;
  if (initializationError) return <Screen title="Let’s try that again."><ThemedText>We couldn’t restore your session. Check your connection.</ThemedText><Button label="Try again" onPress={retry} /></Screen>;
  return <Stack screenOptions={{ headerShown: false }}>
    <Stack.Screen name="auth" />
    <Stack.Protected guard={!!session}><Stack.Screen name="(tabs)" /></Stack.Protected>
  </Stack>;
}

export default function RootLayout() {
  const dark = useColorScheme() === 'dark';
  const colors = useTheme();
  const base = dark ? DarkTheme : DefaultTheme;
  return <SafeAreaProvider><ThemeProvider value={{ ...base, colors: { ...base.colors, primary: colors.primary, background: colors.background, card: colors.backgroundElement, text: colors.text, border: colors.border } }}>
    <BackendProvider><AuthProvider><StatusBar style={dark ? 'light' : 'dark'} /><Navigation /></AuthProvider></BackendProvider>
  </ThemeProvider></SafeAreaProvider>;
}
