import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import type { Vibe } from '../../comparison';
import type { CandidatePlace } from '../../types';
import { RatingPlaceSummary } from '../rating-place-summary';

const vibeIcons = {
  disliked: require('../../../../../assets/images/rankings/vibe-disliked.svg'),
  fine: require('../../../../../assets/images/rankings/vibe-fine.svg'),
  liked: require('../../../../../assets/images/rankings/vibe-liked.svg'),
  loved: require('../../../../../assets/images/rankings/vibe-loved.svg'),
} as const;

const vibeOptions = [
  { key: 'disliked', label: 'Didn’t like it.' },
  { key: 'fine', label: 'It’s fine.' },
  { key: 'liked', label: 'It’s good!' },
  { key: 'loved', label: 'Loved it!' },
] as const;

interface VibeCheckStepProps {
  place: CandidatePlace;
  onSelectVibe: (vibe: Vibe) => void;
}

export function VibeCheckStep({ place, onSelectVibe }: VibeCheckStepProps) {
  return (
    <View style={styles.stepContent}>
      <RatingPlaceSummary place={place} />
      <ThemedText style={styles.prompt}>How was your experience?</ThemedText>
      <View style={styles.vibeGrid}>
        {vibeOptions.map((option) => (
          <Pressable
            key={option.key}
            accessibilityLabel={option.label}
            accessibilityRole="button"
            onPress={() => onSelectVibe(option.key)}
            style={({ pressed }) => [styles.vibeButton, pressed && styles.pressed]}
          >
            <Image source={vibeIcons[option.key]} contentFit="contain" style={styles.vibeIcon} />
            <ThemedText numberOfLines={1} style={styles.vibeLabel}>{option.label}</ThemedText>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stepContent: { width: '100%', gap: 10 },
  prompt: { width: '100%', color: '#000000', fontSize: 12, fontWeight: '600', lineHeight: 15 },
  vibeGrid: { height: 78, flexDirection: 'row', gap: 10, overflow: 'hidden' },
  vibeButton: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', padding: 10 },
  vibeIcon: { width: 24, height: 24 },
  vibeLabel: { color: '#000000', fontSize: 10, fontWeight: '600', lineHeight: 12, textAlign: 'center' },
  pressed: { opacity: 0.55 },
});
