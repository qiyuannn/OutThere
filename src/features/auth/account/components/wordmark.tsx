import { StyleSheet, Text, View } from 'react-native';

import { Fonts } from '@/constants/theme';

export function Wordmark() {
  return (
    <View accessibilityRole="header" style={styles.wordmark}>
      <Text style={styles.wordmarkIntro}>Are you ready to discover</Text>
      <View style={styles.wordmarkRow}>
        <Text style={styles.wordmarkPrefix}>what’s</Text>
        <Text style={styles.wordmarkName}>OutThere</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wordmark: {
    width: 200,
    height: 47,
    justifyContent: 'center',
  },
  wordmarkIntro: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 14,
  },
  wordmarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  wordmarkPrefix: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 14,
  },
  wordmarkName: {
    color: '#000000',
    fontFamily: Fonts.mono,
    fontSize: 32,
    fontWeight: '400',
    lineHeight: 36,
  },
});
