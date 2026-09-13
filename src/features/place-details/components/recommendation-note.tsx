import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import type { PlaceDetails } from '../types';

interface RecommendationNoteProps {
  place: PlaceDetails;
}

export function RecommendationNote({ place }: RecommendationNoteProps) {
  const theme = useTheme();

  if (!place.reason) return null;

  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundSelected, borderColor: theme.border }]}>
      <View style={styles.headerRow}>
        <ThemedText style={styles.sparkleIcon}>✦</ThemedText>
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.label}>
          WHY YOU’LL LOVE THIS
        </ThemedText>
      </View>
      <ThemedText type="default" style={styles.reasonText}>
        “{place.reason}”
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    gap: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sparkleIcon: {
    fontSize: 13,
  },
  label: {
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 1.2,
  },
  reasonText: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
    fontStyle: 'italic',
  },
});
