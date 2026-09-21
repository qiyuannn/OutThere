import { useEffect, useRef } from 'react';
import { Image } from 'expo-image';
import { GlassView, isGlassEffectAPIAvailable } from 'expo-glass-effect';
import * as Haptics from 'expo-haptics';
import { Animated, Platform, StyleSheet, View } from 'react-native';

import { Avatar } from '@/features/profile/components/avatar';
import { useTheme } from '@/hooks/use-theme';
import { useProfile } from '@/providers/profile-provider';

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
  const theme = useTheme();
  const iconScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (active) {
      if (Platform.OS !== 'web') void Haptics.selectionAsync();
      Animated.sequence([
        Animated.timing(iconScale, { toValue: 0.82, duration: 80, useNativeDriver: true }),
        Animated.spring(iconScale, { toValue: 1, speed: 28, bounciness: 8, useNativeDriver: true }),
      ]).start();
    }
  }, [active, iconScale]);

  const icon = name === 'profile' ? (
    <View style={[styles.profile, active && [styles.activeProfile, { borderColor: theme.text }]]}>
      <Avatar name={profile?.display_name ?? ''} path={profile?.avatar_path ?? null} size={24} />
    </View>
  ) : (() => {
    const size = name === 'search' ? 24 : 23;
    return (
      <Image
        accessibilityElementsHidden
        source={icons[name]}
        style={{ width: size, height: size, tintColor: active ? theme.text : theme.textSecondary }}
        contentFit="contain"
      />
    );
  })();

  return (
    <View
      style={[
        styles.iconButton,
        active && [
          styles.activeIconButton,
          {
            backgroundColor: liquidGlass ? 'transparent' : theme.backgroundElement,
            borderColor: theme.border,
          },
        ],
      ]}
    >
      {active && liquidGlass ? (
        <GlassView
          colorScheme="light"
          glassEffectStyle="clear"
          isInteractive={false}
          pointerEvents="none"
          style={styles.activeGlass}
          tintColor="rgba(255, 255, 255, 0.40)"
        />
      ) : null}
      <Animated.View style={{ transform: [{ scale: iconScale }] }}>
        {icon}
      </Animated.View>
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
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowColor: '#101820',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 4,
  },
  activeGlass: {
    ...StyleSheet.absoluteFill,
    borderRadius: 23,
  },
  profile: {
    width: 24,
    height: 24,
    borderRadius: 12,
    overflow: 'hidden',
  },
  activeProfile: {
    borderWidth: 1.5,
  },
});
