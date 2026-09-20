import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { Avatar } from '@/features/profile/components/avatar';
import { useProfile } from '@/providers/profile-provider';

const icons = {
  rankings: require('../../assets/images/navigation/feed.svg'),
  search: require('../../assets/images/navigation/search.svg'),
  '(discover)': require('../../assets/images/navigation/discover.svg'),
  'bucket-list': require('../../assets/images/navigation/saved.svg'),
} as const;

export type MainTabName = keyof typeof icons | 'profile';

export function BottomNavigationIcon({ name }: { name: MainTabName }) {
  const { profile } = useProfile();

  if (name === 'profile') {
    return (
      <View style={styles.profile}>
        <Avatar
          name={profile?.display_name ?? ''}
          path={profile?.avatar_path ?? null}
          size={24}
        />
      </View>
    );
  }

  const size = name === 'search' ? 24 : 23;
  return <Image accessibilityElementsHidden source={icons[name]} style={{ width: size, height: size }} contentFit="contain" />;
}

const styles = StyleSheet.create({
  profile: {
    width: 24,
    height: 24,
    borderRadius: 12,
    overflow: 'hidden',
  },
});
