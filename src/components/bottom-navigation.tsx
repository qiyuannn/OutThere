import { Image } from 'expo-image';
import { GlassView, isGlassEffectAPIAvailable } from 'expo-glass-effect';
import { Platform, StyleSheet, View } from 'react-native';

import { Avatar } from '@/features/profile/components/avatar';
import { useProfile } from '@/providers/profile-provider';
import { ThemedText } from './themed-text';

const icons = {
  feed: require('../../assets/images/navigation/feed.svg'),
  search: require('../../assets/images/navigation/search.svg'),
  '(discover)': require('../../assets/images/navigation/discover.svg'),
  'bucket-list': require('../../assets/images/navigation/saved.svg'),
} as const;

export type MainTabName = keyof typeof icons | 'profile';
const liquidGlass = Platform.OS === 'ios' && isGlassEffectAPIAvailable();

export function BottomNavigationIcon({ active = false, label, name }: { active?: boolean; label: string; name: MainTabName }) {
  const { profile } = useProfile();

  const icon = name === 'profile' ? (
    <View style={[styles.profile, active && styles.activeProfile]}>
      <Avatar name={profile?.display_name ?? ''} path={profile?.avatar_path ?? null} size={24} />
    </View>
  ) : (() => {
    const size = name === 'search' ? 24 : 23;
    return <Image accessibilityElementsHidden source={icons[name]} style={{ width: size, height: size }} contentFit="contain" />;
  })();

  return (
    <View style={[styles.iconButton, active && styles.activeIconButton]}>
      {active && liquidGlass ? <GlassView colorScheme="light" glassEffectStyle="clear" isInteractive={false}
        pointerEvents="none" style={styles.activeGlass} tintColor="rgba(255, 255, 255, 0.40)" /> : null}
      {icon}
      {active ? <ThemedText numberOfLines={1} style={styles.activeLabel}>{label}</ThemedText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  iconButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeIconButton: {
    width: 72,
    paddingHorizontal: 10,
    flexDirection: 'row',
    gap: 6,
    backgroundColor: liquidGlass ? 'transparent' : 'rgba(255, 255, 255, 0.92)',
    borderColor: 'rgba(255, 255, 255, 0.92)',
    borderWidth: 1,
    shadowColor: '#101820',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 7,
    elevation: 4,
  },
  activeGlass: {
    ...StyleSheet.absoluteFill,
    borderRadius: 23,
  },
  activeLabel: { color: '#000000', fontSize: 11, lineHeight: 14, fontWeight: '700' },
  profile: {
    width: 24,
    height: 24,
    borderRadius: 12,
    overflow: 'hidden',
  },
  activeProfile: {
    borderWidth: 1.5,
    borderColor: '#000000',
  },
});
