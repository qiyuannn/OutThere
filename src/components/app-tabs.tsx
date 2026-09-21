import { router, Tabs } from 'expo-router';
import { GlassView, isGlassEffectAPIAvailable } from 'expo-glass-effect';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomNavigationIcon, type MainTabName } from '@/components/bottom-navigation';
import { useTheme } from '@/hooks/use-theme';

const tabs: { name: MainTabName; title: string }[] = [
  { name: 'feed', title: 'Feed' },
  { name: 'search', title: 'Search' },
  { name: '(discover)', title: 'Discover' },
  { name: 'bucket-list', title: 'Saved' },
  { name: 'profile', title: 'Profile' },
];

function GlassTabBackground() {
  const theme = useTheme();
  const liquidGlass = Platform.OS === 'ios' && isGlassEffectAPIAvailable();
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {liquidGlass ? (
        <GlassView
          colorScheme="light"
          glassEffectStyle="regular"
          isInteractive={false}
          style={styles.glassSurface}
          tintColor="rgba(246, 250, 255, 0.46)"
        />
      ) : (
        <View style={[styles.fallbackSurface, { backgroundColor: theme.backgroundElement }]} />
      )}
      <View style={[styles.glassEdge, { borderColor: theme.border }]} />
    </View>
  );
}

export default function AppTabs() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        popToTopOnBlur: true,
        tabBarShowLabel: false,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarHideOnKeyboard: true,
        tabBarBackground: () => <GlassTabBackground />,
        tabBarStyle: {
          height: 58,
          marginHorizontal: 20,
          marginBottom: Math.max(insets.bottom, 12),
          paddingHorizontal: 8,
          paddingTop: 0,
          paddingBottom: 0,
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          borderRadius: 30,
          shadowColor: '#101820',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: Platform.OS === 'ios' ? 0.18 : 0,
          shadowRadius: 18,
          elevation: 12,
        },
        tabBarItemStyle: {
          height: 58,
          padding: 0,
        },
        tabBarIconStyle: {
          width: 46,
          height: 46,
          margin: 0,
        },
      }}
    >
      {tabs.map(({ name, title }) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title,
            tabBarAccessibilityLabel: title,
            tabBarIcon: ({ focused }) => <BottomNavigationIcon active={focused} label={title} name={name} />,
            popToTopOnBlur: true,
          }}
          listeners={({ navigation }) => ({
            tabPress: () => {
              if (navigation.isFocused()) {
                const target = name === '(discover)' ? '/' : `/${name}`;
                router.replace(target as any);
              }
            },
          })}
        />
      ))}
      <Tabs.Screen name="explore/index" options={{ href: null }} />
      <Tabs.Screen name="friends" options={{ href: null }} />
      <Tabs.Screen name="rankings" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  glassSurface: {
    ...StyleSheet.absoluteFill,
    borderRadius: 30,
  },
  fallbackSurface: {
    ...StyleSheet.absoluteFill,
    borderRadius: 30,
  },
  glassEdge: {
    ...StyleSheet.absoluteFill,
    borderRadius: 30,
    borderWidth: 1,
  },
});
