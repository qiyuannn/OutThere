import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import type { CandidatePlace, RankingMode } from '../../types';
import { RatingPlaceSummary } from '../rating-place-summary';

interface ScoreRevealStepProps {
  place: CandidatePlace;
  finalScore: number;
  projectedRank: number;
  totalRanked: number;
  mode: RankingMode;
  saving: boolean;
  onSave: (openPost?: boolean) => void;
}

export function ScoreRevealStep({
  place,
  finalScore,
  projectedRank,
  totalRanked,
  mode,
  saving,
  onSave,
}: ScoreRevealStepProps) {
  const rankSuffix =
    projectedRank === 1 ? 'st' : projectedRank === 2 ? 'nd' : projectedRank === 3 ? 'rd' : 'th';
  const modeLabel = mode === 'food' ? 'Food' : 'Activities';

  return (
    <View style={styles.stepContent}>
      <RatingPlaceSummary place={place} />
      <ThemedText style={styles.finalScore}>{finalScore.toFixed(1)}</ThemedText>
      <ThemedText style={styles.rankCopy}>
        Ranked {projectedRank}{rankSuffix} out of {totalRanked} in {modeLabel}
      </ThemedText>
      <View style={styles.finalActions}>
        <Pressable
          accessibilityRole="button"
          disabled={saving}
          onPress={() => onSave(false)}
          style={({ pressed }) => [styles.finalButton, (pressed || saving) && styles.pressed]}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#000000" />
          ) : (
            <ThemedText style={styles.finalButtonLabel}>Save</ThemedText>
          )}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={saving}
          onPress={() => onSave(true)}
          style={({ pressed }) => [styles.finalButton, (pressed || saving) && styles.pressed]}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#000000" />
          ) : (
            <ThemedText style={styles.finalButtonLabel}>Save &amp; Post</ThemedText>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stepContent: { width: '100%', gap: 10 },
  finalScore: { color: '#000000', fontSize: 40, fontWeight: '100', lineHeight: 48, textAlign: 'center' },
  rankCopy: { width: '100%', color: '#000000', fontSize: 13, fontWeight: '600', lineHeight: 16, textAlign: 'center' },
  finalActions: {
    width: '100%',
    height: 45,
    flexDirection: 'row',
    gap: 10,
    overflow: 'hidden',
  },
  finalButton: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderColor: '#000000',
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  finalButtonLabel: { color: '#000000', fontSize: 13, fontWeight: '600', lineHeight: 16, textAlign: 'center' },
  pressed: { opacity: 0.55 },
});
