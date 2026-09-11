import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useTheme } from '@/hooks/use-theme';

export default function AppTabs() {
  const theme = useTheme();
  return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: theme.primary, tabBarInactiveTintColor: theme.textSecondary,
    tabBarStyle: { backgroundColor: theme.backgroundElement, borderTopColor: theme.border }, tabBarLabelStyle: { fontWeight: '600' } }}>
    {[
      ['(discover)', 'Discover', '◎'], ['bucket-list', 'Saved', '♡'], ['rankings', 'Rankings', '≋'], ['friends', 'Friends', '♧'], ['profile', 'Profile', '○'],
    ].map(([name, title, symbol]) => <Tabs.Screen key={name} name={name} options={{ title, tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 26 }} accessibilityElementsHidden>{symbol}</Text> }} />)}
    <Tabs.Screen name="explore/index" options={{ href: null }} />
  </Tabs>;
}
