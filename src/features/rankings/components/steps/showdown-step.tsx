import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { getScoreTier } from '../../comparison';
import type { CandidatePlace, RankedPlace } from '../../types';

function ShowdownScore({ score }: { score: number }) {
  const tier = getScoreTier(score);
  return (
    <View style={[styles.showdownScore, { backgroundColor: tier.backgroundColor, borderColor: tier.color }]}>
      <ThemedText style={[styles.showdownScoreText, { color: tier.textColor }]}>{score.toFixed(1)}</ThemedText>
    </View>
  );
}

interface ShowdownStepProps {
  selectedPlace: CandidatePlace;
  comparedPlace: RankedPlace;
  onChoice: (choice: 'new_better' | 'existing_better' | 'equal') => void;
}

export function ShowdownStep({ selectedPlace, comparedPlace, onChoice }: ShowdownStepProps) {
  return (
    <View style={styles.stepContent}>
      <ThemedText style={[styles.prompt, styles.centeredPrompt]}>Which one is better?</ThemedText>
      <View style={styles.showdownRow}>
        <Pressable
          accessibilityLabel={`${selectedPlace.display_name}, current place`}
          accessibilityRole="button"
          onPress={() => onChoice('new_better')}
          style={({ pressed }) => [styles.contenderCard, pressed && styles.pressed]}
        >
          <ThemedText numberOfLines={2} style={styles.contenderName}>
            {selectedPlace.display_name}
          </ThemedText>
          <ThemedText style={styles.contenderName}>(Current)</ThemedText>
        </Pressable>

        <View style={styles.vsColumn}>
          <ThemedText style={styles.vsLabel}>vs</ThemedText>
        </View>

        <Pressable
          accessibilityLabel={`${comparedPlace.display_name}, rated ${comparedPlace.rating.toFixed(1)}`}
          accessibilityRole="button"
          onPress={() => onChoice('existing_better')}
          style={({ pressed }) => [styles.contenderCard, styles.comparedCard, pressed && styles.pressed]}
        >
          <ThemedText numberOfLines={2} style={styles.contenderName}>
            {comparedPlace.display_name}
          </ThemedText>
          <View style={styles.comparedScore}>
            <ShowdownScore score={comparedPlace.rating} />
          </View>
        </Pressable>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => onChoice('equal')}
        style={({ pressed }) => [styles.equalBtn, pressed && styles.pressed]}
      >
        <ThemedText style={styles.equalLabel}>They’re about the same</ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  stepContent: { width: '100%', gap: 10 },
  prompt: { width: '100%', color: '#000000', fontSize: 12, fontWeight: '600', lineHeight: 15 },
  centeredPrompt: { textAlign: 'center' },
  showdownRow: { height: 96, flexDirection: 'row', gap: 10, overflow: 'hidden' },
  contenderCard: {
    flex: 4,
    minWidth: 0,
    padding: 10,
    borderWidth: 1,
    borderColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  comparedCard: { gap: 10 },
  contenderName: { color: '#000000', fontSize: 12, fontWeight: '600', lineHeight: 15, textAlign: 'center' },
  comparedScore: { minHeight: 30, justifyContent: 'center' },
  showdownScore: {
    minWidth: 45,
    height: 30,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  showdownScoreText: { fontSize: 12, fontWeight: '400', lineHeight: 15, textAlign: 'center' },
  vsColumn: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center' },
  vsLabel: { color: '#000000', fontSize: 12, fontWeight: '600', lineHeight: 15, textAlign: 'center' },
  equalBtn: {
    minHeight: 36,
    paddingHorizontal: 40,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  equalLabel: { color: '#000000', fontSize: 12, fontWeight: '600', lineHeight: 15, textAlign: 'center' },
  pressed: { opacity: 0.55 },
});
