import { useCallback, useMemo, useState } from 'react';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/app-header';
import { CATEGORY_GROUPS_BY_MODE } from '@/features/categories/catalog';
import { getScoreTier } from '@/features/rankings/comparison';
import { useAuth } from '@/providers/auth-provider';
import { RadarChart, type RadarChartItem } from './components/radar-chart';
import { formatStatisticsTitle } from './model';
import { loadDistributionStatistics, type DistributionStatistics } from './service';
import type { ProfileMode } from './types';

const EMPTY_STATISTICS: DistributionStatistics = { averageRating: null, placesRated: 0, weights: {} };

export default function StatisticsScreen() {
  const { userId: paramUserId, userName } = useLocalSearchParams<{ userId?: string; userName?: string }>();
  const { session } = useAuth();
  const currentUserId = session?.user.id;
  const targetUserId = paramUserId || currentUserId;
  const isOwn = !paramUserId || paramUserId === currentUserId;

  const { width } = useWindowDimensions();
  const [mode, setMode] = useState<ProfileMode>('activities');
  const [statistics, setStatistics] = useState<DistributionStatistics>(EMPTY_STATISTICS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const availableChartSize = Math.min(width - 20, 700);
  const chartSize = mode === 'food' ? availableChartSize * 0.84 : availableChartSize;

  useFocusEffect(useCallback(() => {
    void attempt;
    let active = true;
    if (!targetUserId) {
      setLoading(false);
      return () => { active = false; };
    }
    setLoading(true);
    setError(false);
    void loadDistributionStatistics(targetUserId, mode)
      .then((next) => { if (active) setStatistics(next); })
      .catch(() => { if (active) { setStatistics(EMPTY_STATISTICS); setError(true); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt, mode, targetUserId]));

  const groups = CATEGORY_GROUPS_BY_MODE[mode];
  const chartItems: RadarChartItem[] = useMemo(() => groups.map((group) => ({
    key: group.key,
    label: group.label,
    weight: statistics.weights[group.key] ?? 0,
  })), [groups, statistics.weights]);

  const topCategory = useMemo(() => {
    let top: (typeof groups)[number] | null = null;
    let topWeight = 0;
    for (const group of groups) {
      const weight = statistics.weights[group.key] ?? 0;
      if (weight > topWeight) { top = group; topWeight = weight; }
    }
    return top?.label ?? '—';
  }, [groups, statistics.weights]);

  const headerTitle = formatStatisticsTitle(isOwn, userName);

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.safeArea}>
      <AppHeader description={headerTitle} showBack onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content}>
        <View accessibilityRole="tablist" style={styles.filters}>
          {(['activities', 'food'] as const).map((value) => (
            <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: mode === value }}
              onPress={() => setMode(value)} style={({ pressed }) => [styles.filter, pressed && styles.pressed]}>
              <Text style={[styles.filterLabel, mode !== value && styles.inactiveFilter]}>
                {value === 'activities' ? 'Activities' : 'Food'}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={[styles.chartArea, { height: chartSize * 0.95 + 8 }]}>
          {loading ? <ActivityIndicator color="#000000" /> : (
            <RadarChart items={chartItems} size={chartSize} showLegend={false} showPoints={false}
              accentColor="#3157D5" backgroundColor="#FFFFFF" gridColor="#B8B8B8" labelColor="#000000" />
          )}
        </View>

        {error ? (
          <Pressable accessibilityRole="button" onPress={() => setAttempt((value) => value + 1)} style={styles.retry}>
            <Text style={styles.retryText}>Could not load statistics. Tap to retry.</Text>
          </Pressable>
        ) : null}

        <View style={styles.statistics}>
          <StatisticRow label="Places Rated:" value={loading ? '—' : String(statistics.placesRated)} />
          <StatisticRow label="Average Rating:" value={loading || statistics.averageRating === null ? '—' : statistics.averageRating.toFixed(1)} />
          <StatisticRow label="Top category:" value={loading ? '—' : topCategory} />
        </View>

        <Text style={styles.sectionHeading}>Breakdown by category</Text>
        <View style={styles.categoryList}>
          {groups.map((group) => (
            <CategoryRow key={group.key} label={group.label} description={group.description}
              score={(statistics.weights[group.key] ?? 0) * 10} loading={loading} />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatisticRow({ label, value }: { label: string; value: string }) {
  return <View style={styles.statRow}><Text style={styles.statLabel}>{label}</Text><Text style={styles.statValue}>{value}</Text></View>;
}

function CategoryRow({ description, label, loading, score }: { description: string; label: string; loading: boolean; score: number }) {
  const tier = getScoreTier(score);
  const rated = score > 0;
  return (
    <View style={styles.categoryRow}>
      <View style={styles.categoryDetails}>
        <Text numberOfLines={1} style={styles.categoryName}>{label}</Text>
        <Text numberOfLines={2} style={styles.categoryDescription}>{description}</Text>
      </View>
      <View style={styles.ratingSlot}>
        {loading ? <Text style={styles.unrated}>—</Text> : rated ? (
          <View style={[styles.ratingBadge, { backgroundColor: tier.backgroundColor, borderColor: tier.color }]}>
            <Text style={[styles.ratingText, { color: tier.textColor }]}>{score.toFixed(1)}</Text>
          </View>
        ) : <Text style={styles.unrated}>—</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: 10, gap: 10, backgroundColor: '#FFFFFF' },
  filters: { minHeight: 55, padding: 10, flexDirection: 'row' },
  filter: { flex: 1, minHeight: 35, alignItems: 'center', justifyContent: 'center' },
  filterLabel: { color: '#000000', fontSize: 20, lineHeight: 24, fontWeight: '600', letterSpacing: 0.25 },
  inactiveFilter: { opacity: 0.48 },
  pressed: { opacity: 0.55 },
  chartArea: { width: '100%', alignItems: 'center', justifyContent: 'center' },
  retry: { minHeight: 36, alignItems: 'center', justifyContent: 'center' },
  retryText: { color: '#9A3412', fontSize: 12, lineHeight: 15, fontWeight: '600' },
  statistics: { padding: 10, gap: 5 },
  statRow: { flexDirection: 'row', gap: 10 },
  statLabel: { width: 117, color: '#000000', fontSize: 12, lineHeight: 15, fontWeight: '600' },
  statValue: { flex: 1, color: '#000000', fontSize: 12, lineHeight: 15, fontWeight: '400' },
  sectionHeading: { color: '#000000', fontSize: 16, lineHeight: 19, fontWeight: '600' },
  categoryList: { padding: 10, gap: 10 },
  categoryRow: { minHeight: 45, flexDirection: 'row', alignItems: 'center', gap: 11, overflow: 'hidden' },
  categoryDetails: { flex: 1, minWidth: 0, alignItems: 'flex-start', overflow: 'hidden' },
  categoryName: { color: '#000000', fontSize: 16, lineHeight: 18, fontWeight: '600', letterSpacing: 0.25 },
  categoryDescription: { color: '#000000', fontSize: 10, lineHeight: 15, fontWeight: '300', letterSpacing: 0.25 },
  ratingSlot: { width: 45, height: 45, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
  ratingBadge: { minWidth: 45, height: 30, paddingHorizontal: 10, borderWidth: 1, borderRadius: 100, alignItems: 'center', justifyContent: 'center' },
  ratingText: { fontSize: 12, lineHeight: 15, fontWeight: '400' },
  unrated: { color: '#777777', fontSize: 12, lineHeight: 15 },
});
