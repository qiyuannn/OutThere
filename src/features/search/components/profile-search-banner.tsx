import { Pressable, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';

interface ProfileSearchBannerProps {
  query: string;
  onPress: () => void;
}

export function ProfileSearchBanner({ query, onPress }: ProfileSearchBannerProps) {
  const trimmed = query.trim();

  return (
    <Pressable
      accessibilityLabel={`Search for profile ${trimmed}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.banner, pressed && styles.pressedBanner]}
    >
      <View style={styles.iconSlot}>
        <ThemedText style={styles.icon}>👤</ThemedText>
      </View>
      <View style={styles.textSlot}>
        <ThemedText style={styles.title}>Search for profile</ThemedText>
        <ThemedText numberOfLines={1} style={styles.subtitle}>
          Search profiles matching “{trimmed}”
        </ThemedText>
      </View>
      <ThemedText style={styles.arrow}>›</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderRadius: 14,
    backgroundColor: '#F3F6F1',
    borderWidth: 1,
    borderColor: '#DFE5D9',
    gap: 10,
  },
  pressedBanner: {
    opacity: 0.7,
  },
  iconSlot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DFE5D9',
  },
  icon: {
    fontSize: 15,
  },
  textSlot: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  title: {
    color: '#14221D',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
  },
  subtitle: {
    color: '#637068',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 15,
  },
  arrow: {
    color: '#637068',
    fontSize: 18,
    fontWeight: '400',
    paddingRight: 4,
  },
});
