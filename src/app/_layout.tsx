import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppTabs from '@/components/app-tabs';
import { useTheme } from '@/hooks/use-theme';
import { BackendProvider } from '@/providers/backend-provider';
export { ErrorBoundary } from 'expo-router';

export default function RootLayout() {
  const dark = useColorScheme() === 'dark';
  const colors = useTheme();
  const base = dark ? DarkTheme : DefaultTheme;
  return <SafeAreaProvider><ThemeProvider value={{ ...base, colors: { ...base.colors, primary: colors.primary, background: colors.background, card: colors.backgroundElement, text: colors.text, border: colors.border } }}>
    <BackendProvider><StatusBar style={dark ? 'light' : 'dark'} /><AppTabs /></BackendProvider>
  </ThemeProvider></SafeAreaProvider>;
}
