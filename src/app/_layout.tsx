import { DarkTheme, DefaultTheme, ThemeProvider, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View, useColorScheme, useWindowDimensions } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/use-theme';
import { SubscriptionProvider } from '@/providers/subscription-provider';
import { ProfileProvider } from '@/providers/profile-provider';
import { NotificationsProvider } from '@/providers/notifications-provider';
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
        <Stack.Screen name="(main)" />
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
    </Stack>
  );
}

function WebSidebar() {
  return (
    <View style={styles.webSidebar}>
      <View style={styles.webSidebarHeader}>
        <Text style={styles.webSidebarTitle}>OutThere 🧭</Text>
        <Text style={styles.webSidebarSubtitle}>Web Preview & Testing</Text>
      </View>

      <View style={styles.webSidebarCard}>
        <Text style={styles.webSidebarCardTitle}>🔑 Demo Account Login</Text>

        <View style={styles.webCredField}>
          <Text style={styles.webCredLabel}>Email</Text>
          <Text selectable style={styles.webCredValue}>test@test.com</Text>
        </View>

        <View style={styles.webCredField}>
          <Text style={styles.webCredLabel}>Password</Text>
          <Text selectable style={styles.webCredValue}>12345678</Text>
        </View>

        <View style={styles.webDivider} />

        <Text style={styles.webSidebarTip}>
          • Select and copy the credentials above to log in.
        </Text>
        <Text style={styles.webSidebarTip}>
          • Or create a fresh account using the Sign Up tab.
        </Text>
      </View>

      <View style={styles.webSidebarFooter}>
        <Text style={styles.webFooterText}>
          📱 Pro Tip: For the authentic mobile experience with haptics & gestures, open this link directly on your phone.
        </Text>
      </View>
    </View>
  );
}

function WebContainer({
  children,
  backgroundColor,
  borderColor,
}: {
  children: React.ReactNode;
  backgroundColor: string;
  borderColor: string;
}) {
  const { width } = useWindowDimensions();
  const isDesktop = width > 402;
  const showSidebar = width > 880;

  return (
    <View style={[styles.webOuter, isDesktop && styles.webOuterDesktop, showSidebar && styles.webOuterRow]}>
      {showSidebar && <WebSidebar />}
      <View
        style={[
          styles.webFrame,
          { backgroundColor },
          isDesktop && [styles.webFrameDesktop, { borderColor }],
        ]}
      >
        {children}
      </View>
    </View>
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
  webOuter: {
    flex: 1,
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  webOuterRow: {
    flexDirection: 'row',
    gap: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webSidebar: {
    width: 320,
    gap: 16,
  },
  webSidebarHeader: {
    gap: 4,
  },
  webSidebarTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  webSidebarSubtitle: {
    color: '#8B949E',
    fontSize: 14,
    fontWeight: '500',
  },
  webSidebarCard: {
    backgroundColor: '#161B22',
    borderWidth: 1,
    borderColor: '#30363D',
    borderRadius: 16,
    padding: 18,
    gap: 12,
  },
  webSidebarCardTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  webCredField: {
    backgroundColor: '#0D1117',
    borderWidth: 1,
    borderColor: '#30363D',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 2,
  },
  webCredLabel: {
    color: '#8B949E',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  webCredValue: {
    color: '#58A6FF',
    fontSize: 14,
    fontWeight: '600',
  },
  webDivider: {
    height: 1,
    backgroundColor: '#30363D',
    marginVertical: 2,
  },
  webSidebarTip: {
    color: '#8B949E',
    fontSize: 12,
    lineHeight: 17,
  },
  webSidebarFooter: {
    backgroundColor: 'rgba(56, 139, 253, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(56, 139, 253, 0.25)',
    borderRadius: 12,
    padding: 14,
  },
  webFooterText: {
    color: '#79C0FF',
    fontSize: 12,
    lineHeight: 17,
  },
  webOuterDesktop: {
    backgroundColor: '#0D1117',
    padding: 16,
  },
  webFrame: {
    flex: 1,
    width: '100%',
    maxWidth: 402,
    height: '100%',
    alignSelf: 'center',
  },
  webFrameDesktop: {
    height: '100%',
    maxHeight: 874,
    // Reserve the status-bar space that iOS supplies inside its safe area.
    paddingTop: 54,
    borderRadius: 48,
    overflow: 'hidden',
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
  },
});

export default function RootLayout() {
  const dark = useColorScheme() === 'dark';
  const colors = useTheme();
  const base = dark ? DarkTheme : DefaultTheme;
  return (
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
                <NotificationsProvider>
                  <StatusBar style={dark ? 'light' : 'dark'} />
                  {Platform.OS === 'web' ? (
                    <WebContainer backgroundColor={colors.background} borderColor={colors.border}>
                      <Navigation />
                    </WebContainer>
                  ) : (
                    <Navigation />
                  )}
                </NotificationsProvider>
              </ProfileProvider>
            </SubscriptionProvider>
          </AuthProvider>
        </BackendProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
