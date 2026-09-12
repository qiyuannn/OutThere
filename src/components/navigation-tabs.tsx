import { SymbolView } from 'expo-symbols';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/use-theme';

const tabs = [
  {
    name: 'rankings',
    title: 'Feed',
    icon: { ios: 'list.bullet.rectangle', android: 'feed', web: 'feed' },
  },
  {
    name: 'friends',
    title: 'Search',
    icon: { ios: 'magnifyingglass', android: 'search', web: 'search' },
  },
  {
    name: '(discover)',
    title: 'Discover',
    icon: { ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' },
  },
  {
    name: 'bucket-list',
    title: 'Saved',
    icon: { ios: 'bookmark', android: 'bookmark', web: 'bookmark' },
  },
  {
    name: 'profile',
    title: 'Profile',
    icon: { ios: 'person', android: 'person', web: 'person' },
  },
] as const;

export default function AppTabs() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: theme.primary, tabBarInactiveTintColor: theme.textSecondary,
    tabBarStyle: { backgroundColor: theme.backgroundElement, borderTopColor: theme.border, paddingHorizontal: 16 },
    tabBarItemStyle: { transform: [{ translateY: Math.max(0, insets.bottom / 2 - 5) }] }, tabBarLabelStyle: { fontWeight: '600' } }}>
    {tabs.map(({ name, title, icon }) => <Tabs.Screen key={name} name={name} options={{
      title,
      tabBarIcon: ({ color }) => <SymbolView name={icon} tintColor={color} size={28} accessibilityElementsHidden />,
    }} />)}
    <Tabs.Screen name="explore/index" options={{ href: null }} />
  </Tabs>;
}
