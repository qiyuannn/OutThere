import { Pressable, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';

interface EmptyProfilesPromptProps {
  onSwitchToPlaces: () => void;
}

export function EmptyProfilesPrompt({ onSwitchToPlaces }: EmptyProfilesPromptProps) {
  return (
    <View style={styles.container}>
      <ThemedText style={styles.title}>Search Profiles</ThemedText>
      <ThemedText style={styles.copy}>
        Search for friends and other members by name or @username.
      </ThemedText>
      <Pressable
        accessibilityRole="button"
        onPress={onSwitchToPlaces}
        style={({ pressed }) => [styles.switchBackOutline, pressed && styles.pressed]}
      >
        <ThemedText style={styles.switchBackText}>Switch to Places Search</ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  title: {
    color: '#14221D',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  copy: {
    color: '#637068',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  switchBackOutline: {
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#DFE5D9',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  switchBackText: {
    color: '#14221D',
    fontSize: 13,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.6,
  },
});
