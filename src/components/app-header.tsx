import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Fonts } from '@/constants/theme';
import { GlassSurface } from './ui-system';

const backIcon = require('../../assets/images/navigation/back.svg');
const bellIcon = require('../../assets/images/navigation/bell.svg');

type AppHeaderProps = {
  brandLeading?: boolean;
  description: string;
  onBack?: () => void;
  onNotifications?: () => void;
  showBack?: boolean;
};

export function AppHeader({
  brandLeading = false,
  description,
  onBack,
  onNotifications,
  showBack = false,
}: AppHeaderProps) {
  const handleBack = onBack ?? (() => {
    if (router.canGoBack()) router.back();
  });

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <GlassSurface style={styles.container}>
        <View style={styles.row}>
          <View style={[styles.actionSlot, brandLeading && styles.hiddenSlot]}>
            {showBack ? (
              <Pressable
                accessibilityLabel="Go back"
                accessibilityRole="button"
                hitSlop={10}
                onPress={handleBack}
                style={({ pressed }) => [styles.action, pressed && styles.pressed]}
              >
                <Image source={backIcon} style={styles.icon} contentFit="contain" />
              </Pressable>
            ) : null}
          </View>

          <Text accessibilityRole="header" style={[styles.brand, brandLeading && styles.leadingBrand]}>OutThere</Text>

          <View style={[styles.actionSlot, styles.trailingSlot]}>
            {onNotifications ? (
              <Pressable
                accessibilityLabel="Notifications"
                accessibilityRole="button"
                hitSlop={10}
                onPress={onNotifications}
                style={({ pressed }) => [styles.action, pressed && styles.pressed]}
              >
                <Image source={bellIcon} style={styles.icon} contentFit="contain" />
              </Pressable>
            ) : (
              <Image accessibilityElementsHidden source={bellIcon} style={styles.icon} contentFit="contain" />
            )}
          </View>
        </View>

        <Text numberOfLines={1} style={styles.description}>{description}</Text>
      </GlassSurface>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: 'rgba(255,255,255,0.94)',
    zIndex: 20,
  },
  container: {
    gap: 5,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  row: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionSlot: {
    width: 44,
    height: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  trailingSlot: {
    alignItems: 'flex-end',
  },
  hiddenSlot: {
    display: 'none',
  },
  action: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.55,
  },
  icon: {
    width: 24,
    height: 24,
  },
  brand: {
    color: '#000000',
    fontFamily: Fonts.mono,
    fontSize: 22,
    fontWeight: '400',
    lineHeight: 24,
    textAlign: 'center',
  },
  leadingBrand: {
    textAlign: 'left',
  },
  description: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 17,
    textAlign: 'center',
  },
});
