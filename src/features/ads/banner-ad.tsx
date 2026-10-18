import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { FeedAdBannerProps } from './types';

// Preview the native banner placement without requesting a real advertisement.
// The Explore feed applies the same non-Pro eligibility and insertion interval.
export function FeedAdBanner({ style }: FeedAdBannerProps) {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.header}>
        <Text style={styles.badge}>ADVERTISEMENT</Text>
        <Pressable
          accessibilityHint="Navigates to OutThere Pro subscription options"
          accessibilityLabel="Remove ads with OutThere Pro"
          accessibilityRole="button"
          onPress={() => router.push('/profile/subscription')}
          style={({ pressed }) => [styles.upgradeButton, pressed && styles.pressed]}
        >
          <Text style={styles.upgradeText}>Hide ads with Pro ⚡</Text>
        </Pressable>
      </View>
      <View accessibilityLabel="Test advertisement. Web preview only." style={styles.banner}>
        <Text style={styles.title}>Test advertisement</Text>
        <Text style={styles.caption}>Web preview only</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: 10,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    marginVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
    alignItems: 'center',
    gap: 8,
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    gap: 4,
  },
  badge: { fontSize: 9, lineHeight: 12, fontWeight: '600', letterSpacing: 0.5, color: '#9CA3AF' },
  upgradeButton: { paddingVertical: 2, paddingHorizontal: 6, borderRadius: 4 },
  upgradeText: { fontSize: 10, lineHeight: 13, fontWeight: '600', color: '#000000' },
  banner: {
    width: 320,
    maxWidth: '100%',
    minHeight: 50,
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#9CA3AF',
  },
  title: { color: '#374151', fontSize: 12, lineHeight: 16, fontWeight: '600', textAlign: 'center' },
  caption: { color: '#6B7280', fontSize: 10, lineHeight: 14, textAlign: 'center' },
  pressed: { opacity: 0.55 },
});
