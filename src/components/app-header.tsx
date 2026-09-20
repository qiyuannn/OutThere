import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Fonts } from '@/constants/theme';

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
      <View style={styles.container}>
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
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#FFFFFF',
  },
  container: {
    gap: 10,
    padding: 10,
    backgroundColor: '#FFFFFF',
  },
  row: {
    minHeight: 24,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionSlot: {
    width: 44,
    height: 24,
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
    width: 24,
    height: 24,
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
    fontSize: 20,
    fontWeight: '400',
    lineHeight: 24,
    textAlign: 'center',
  },
  leadingBrand: {
    textAlign: 'left',
  },
  description: {
    color: '#000000',
    fontSize: 10,
    fontWeight: '600',
    lineHeight: 12,
    textAlign: 'center',
  },
});
