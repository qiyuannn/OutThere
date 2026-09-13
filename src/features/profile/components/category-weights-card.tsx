import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Card } from '@/components/foundation';
import { ThemedText } from '@/components/themed-text';
import { CATEGORY_GROUPS_BY_MODE } from '@/features/categories/catalog';
import { useTheme } from '@/hooks/use-theme';
import type { ProfileMode } from '../types';
import { RadarChart, type RadarChartItem } from './radar-chart';

interface Props {
  mode: ProfileMode;
  weights: Record<string, number>;
  stats?: {
    savedCount: number;
    passedCount: number;
  };
  loading: boolean;
  error: string | null;
}

export function CategoryWeightsCard({
  mode,
  weights,
  stats,
  loading,
  error,
}: Props) {
  const theme = useTheme();
  const groups = CATEGORY_GROUPS_BY_MODE[mode];
  const isFood = mode === 'food';

  const chartItems: RadarChartItem[] = useMemo(() => {
    return groups.map((g) => ({
      key: g.key,
      label: g.label,
      icon: g.icon,
      weight: weights[g.key] ?? 0.00,
    }));
  }, [groups, weights]);

  // Derived metrics for summary cards
  const metrics = useMemo(() => {
    let topCategory = '—';
    let topWeight = 0;
    let activeCount = 0;

    for (const group of groups) {
      const w = weights[group.key] ?? 0;
      if (w > 0) activeCount++;
      if (w > topWeight) {
        topWeight = w;
        topCategory = group.label;
      }
    }

    const saved = stats?.savedCount ?? 0;
    const passed = stats?.passedCount ?? 0;
    const totalSwiped = saved + passed;

    return {
      topCategory,
      topPercentage: Math.round(topWeight * 100),
      activeCount,
      totalCount: groups.length,
      saved,
      totalSwiped,
    };
  }, [groups, weights, stats]);

  return (
    <Card>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <ThemedText type="subtitle" style={{ fontSize: 24 }}>
            {isFood ? '🍕 Food Distribution' : '🎯 Activity Distribution'}
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.description}>
            Your personal recommendation weights adjust automatically as you swipe in Discover.
          </ThemedText>
        </View>
      </View>

      {error && (
        <ThemedText style={{ color: '#e53935' }}>
          {error}
        </ThemedText>
      )}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={theme.primary} />
          <ThemedText themeColor="textSecondary">Loading weights…</ThemedText>
        </View>
      ) : (
        <>
          {/* Radar Chart Display */}
          <RadarChart items={chartItems} size={330} />

          {/* 2x2 Metric Cards (Inspired by Hevy screenshot) */}
          <View style={styles.statsGrid}>
            <View style={styles.statRow}>
              {/* Card 1: Saved Places */}
              <View
                style={[
                  styles.statCard,
                  {
                    backgroundColor: theme.backgroundElement,
                    borderColor: theme.border,
                  },
                ]}
              >
                <ThemedText type="small" themeColor="textSecondary">
                  Saved Places
                </ThemedText>
                <ThemedText type="subtitle" style={styles.statValue}>
                  {metrics.saved}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.statSub}>
                  in Bucket List
                </ThemedText>
              </View>

              {/* Card 2: Places Reviewed */}
              <View
                style={[
                  styles.statCard,
                  {
                    backgroundColor: theme.backgroundElement,
                    borderColor: theme.border,
                  },
                ]}
              >
                <ThemedText type="small" themeColor="textSecondary">
                  Places Explored
                </ThemedText>
                <ThemedText type="subtitle" style={styles.statValue}>
                  {metrics.totalSwiped}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.statSub}>
                  swiped in Discover
                </ThemedText>
              </View>
            </View>

            <View style={styles.statRow}>
              {/* Card 3: Top Category */}
              <View
                style={[
                  styles.statCard,
                  {
                    backgroundColor: theme.backgroundElement,
                    borderColor: theme.border,
                  },
                ]}
              >
                <ThemedText type="small" themeColor="textSecondary">
                  Top Preference
                </ThemedText>
                <ThemedText
                  type="subtitle"
                  numberOfLines={1}
                  style={styles.statValue}
                >
                  {metrics.topPercentage > 0 ? `${metrics.topPercentage}%` : '—'}
                </ThemedText>
                <ThemedText
                  type="small"
                  numberOfLines={1}
                  themeColor="primary"
                  style={styles.statSub}
                >
                  {metrics.topCategory}
                </ThemedText>
              </View>

              {/* Card 4: Active Categories */}
              <View
                style={[
                  styles.statCard,
                  {
                    backgroundColor: theme.backgroundElement,
                    borderColor: theme.border,
                  },
                ]}
              >
                <ThemedText type="small" themeColor="textSecondary">
                  Active Taste
                </ThemedText>
                <ThemedText type="subtitle" style={styles.statValue}>
                  {metrics.activeCount}
                  <ThemedText type="small" themeColor="textSecondary">
                    /{metrics.totalCount}
                  </ThemedText>
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.statSub}>
                  positive affinity
                </ThemedText>
              </View>
            </View>
          </View>

          {/* Read-Only Category Affinity Breakdown */}
          <View style={styles.categoryList}>
            <ThemedText type="smallBold" themeColor="textSecondary" style={{ marginTop: 8 }}>
              CATEGORY BREAKDOWN
            </ThemedText>

            {groups.map((group) => {
              const currentWeight = weights[group.key] ?? 0.00;
              const percent = Math.round(currentWeight * 100);

              return (
                <View
                  key={group.key}
                  style={[
                    styles.categoryItem,
                    {
                      backgroundColor: theme.background,
                      borderColor: percent > 0 ? theme.primary : theme.border,
                      borderWidth: 1,
                    },
                  ]}
                >
                  <View style={styles.titleRow}>
                    <View style={styles.iconCircle}>
                      <ThemedText style={styles.icon}>{group.icon}</ThemedText>
                    </View>
                    <View style={styles.titleArea}>
                      <View style={styles.labelRow}>
                        <ThemedText type="smallBold" style={{ fontSize: 15, flex: 1 }}>
                          {group.label}
                        </ThemedText>
                        <ThemedText
                          type="smallBold"
                          themeColor={percent > 0 ? 'primary' : 'textSecondary'}
                        >
                          {percent}%
                        </ThemedText>
                      </View>
                      <ThemedText themeColor="textSecondary" style={styles.groupMeta}>
                        {group.description}
                      </ThemedText>
                    </View>
                  </View>

                  {/* Read-only Progress Meter */}
                  <View style={[styles.barBackground, { backgroundColor: theme.backgroundSelected }]}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          width: `${percent}%`,
                          backgroundColor: percent > 0 ? theme.primary : 'transparent',
                        },
                      ]}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  description: { fontSize: 13, lineHeight: 18, marginTop: 4 },
  loadingContainer: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 18 },
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
  categoryList: { gap: 10, marginTop: 8 },
  categoryItem: { borderRadius: 16, padding: 12, gap: 10 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconCircle: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 20 },
  titleArea: { flex: 1, minWidth: 0 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  groupMeta: { fontSize: 12, lineHeight: 16, marginTop: 2 },
  barBackground: { height: 6, borderRadius: 3, width: '100%', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
});
