import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Fonts } from '@/constants/theme';

const backIcon = require('../../../../../assets/images/navigation/back.svg');

export function AuthHeader({ description, onPress }: { description: string; onPress: () => void }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={10}
          onPress={onPress}
          style={({ pressed }) => [styles.headerBackButton, pressed && styles.pressed]}
        >
          <Image source={backIcon} style={styles.headerBackIcon} contentFit="contain" />
        </Pressable>
        <Text style={styles.headerBrand}>OutThere</Text>
      </View>
      <Text style={styles.headerDescription}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    gap: 10,
    justifyContent: 'center',
    padding: 10,
  },
  headerRow: {
    width: '100%',
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBackButton: {
    position: 'absolute',
    top: 4,
    left: 0,
    width: 24,
    height: 24,
  },
  headerBackIcon: {
    width: 24,
    height: 24,
  },
  headerBrand: {
    color: '#000000',
    fontFamily: Fonts.mono,
    fontSize: 20,
    fontWeight: '400',
    lineHeight: 24,
    textAlign: 'center',
  },
  headerDescription: {
    color: '#000000',
    fontSize: 10,
    fontWeight: '600',
    lineHeight: 12,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.55,
  },
});
