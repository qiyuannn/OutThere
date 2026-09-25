import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomNavigationIcon, type MainTabName } from '@/components/bottom-navigation';

const tabs: { name: MainTabName; title: string }[] = [
  { name: 'rankings', title: 'Feed' },
  { name: 'search', title: 'Search' },
  { name: '(discover)', title: 'Discover' },
  { name: 'bucket-list', title: 'Saved' },
  { name: 'profile', title: 'Profile' },
];

export default function AppTabs() {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 14);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: '#000000',
        tabBarInactiveTintColor: '#000000',
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          height: 56 + bottomInset,
          paddingTop: 18,
          paddingBottom: Math.max(bottomInset - 10, 4),
          paddingHorizontal: 11,
          backgroundColor: '#FFFFFF',
          borderTopColor: 'rgba(0, 0, 0, 0.1)',
          borderTopWidth: 0.5,
          elevation: 0,
        },
        tabBarItemStyle: {
          height: 48,
          maxWidth: 76,
          padding: 0,
        },
        tabBarIconStyle: {
          width: 24,
          height: 24,
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
            tabBarIcon: () => <BottomNavigationIcon name={name} />,
          }}
        />
      ))}
      <Tabs.Screen name="explore/index" options={{ href: null }} />
      <Tabs.Screen name="friends" options={{ href: null }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
    </Tabs>
  );
}
