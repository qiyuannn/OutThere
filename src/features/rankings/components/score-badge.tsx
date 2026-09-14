import { StyleSheet, Text, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { getScoreTier } from '../comparison';

interface ScoreBadgeProps {
  score: number;
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
}

export function ScoreBadge({ score, size = 'medium', showLabel = false }: ScoreBadgeProps) {
  const tier = getScoreTier(score);
  const formattedScore = Math.max(0.0, Math.min(10.0, score)).toFixed(1);

  const isSmall = size === 'small';
  const isLarge = size === 'large';

  return (
    <View style={styles.wrapper}>
      <View
        style={[
          styles.badge,
          {
            backgroundColor: tier.backgroundColor,
            borderColor: tier.color,
          },
          isSmall && styles.badgeSmall,
          isLarge && styles.badgeLarge,
        ]}
      >
        <Text
          style={[
            styles.scoreText,
            { color: tier.color },
            isSmall && styles.scoreSmall,
            isLarge && styles.scoreLarge,
          ]}
        >
          {formattedScore}
        </Text>
      </View>
      {showLabel && (
        <ThemedText
          type="small"
          style={[styles.tierLabel, { color: tier.color }]}
        >
          {tier.label}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    gap: 6,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeSmall: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  badgeLarge: {
    paddingHorizontal: 22,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 2.5,
    minWidth: 88,
  },
  scoreText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
    textAlign: 'center',
    includeFontPadding: false,
  },
  scoreSmall: {
    fontSize: 13,
    lineHeight: 16,
  },
  scoreLarge: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  tierLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
});
