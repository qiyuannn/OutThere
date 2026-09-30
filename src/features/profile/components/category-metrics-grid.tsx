import { StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

export interface CategoryMetrics {
  topCategory: string;
  topPercentage: number;
  activeCount: number;
  totalCount: number;
  saved: number;
  totalSwiped: number;
}

interface CategoryMetricsGridProps {
  metrics: CategoryMetrics;
}

export function CategoryMetricsGrid({ metrics }: CategoryMetricsGridProps) {
  const theme = useTheme();

  return (
    <View style={styles.statsGrid}>
      <View style={styles.statRow}>
        <View
          style={[
            styles.statCard,
            { backgroundColor: theme.backgroundElement, borderColor: theme.border },
          ]}
        >
          <ThemedText themeColor="textSecondary" type="small">
            Saved Places
          </ThemedText>
          <ThemedText style={styles.statValue} type="subtitle">
            {metrics.saved}
          </ThemedText>
          <ThemedText style={styles.statSub} themeColor="textSecondary" type="small">
            in Bucket List
          </ThemedText>
        </View>

        <View
          style={[
            styles.statCard,
            { backgroundColor: theme.backgroundElement, borderColor: theme.border },
          ]}
        >
          <ThemedText themeColor="textSecondary" type="small">
            Places Explored
          </ThemedText>
          <ThemedText style={styles.statValue} type="subtitle">
            {metrics.totalSwiped}
          </ThemedText>
          <ThemedText style={styles.statSub} themeColor="textSecondary" type="small">
            swiped in Discover
          </ThemedText>
        </View>
      </View>

      <View style={styles.statRow}>
        <View
          style={[
            styles.statCard,
            { backgroundColor: theme.backgroundElement, borderColor: theme.border },
          ]}
        >
          <ThemedText themeColor="textSecondary" type="small">
            Top Preference
          </ThemedText>
          <ThemedText numberOfLines={1} style={styles.statValue} type="subtitle">
            {metrics.topPercentage > 0 ? `${(metrics.topPercentage / 10).toFixed(1)} / 10` : '—'}
          </ThemedText>
          <ThemedText numberOfLines={1} style={styles.statSub} themeColor="primary" type="small">
            {metrics.topCategory}
          </ThemedText>
        </View>

        <View
          style={[
            styles.statCard,
            { backgroundColor: theme.backgroundElement, borderColor: theme.border },
          ]}
        >
          <ThemedText themeColor="textSecondary" type="small">
            Active Taste
          </ThemedText>
          <ThemedText style={styles.statValue} type="subtitle">
            {metrics.activeCount}
            <ThemedText themeColor="textSecondary" type="small">
              /{metrics.totalCount}
            </ThemedText>
          </ThemedText>
          <ThemedText style={styles.statSub} themeColor="textSecondary" type="small">
            rated categories
          </ThemedText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  statsGrid: { gap: 10, marginVertical: 12 },
  statRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 4,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 2,
  },
  statSub: {
    fontSize: 12,
    marginTop: 1,
  },
});
