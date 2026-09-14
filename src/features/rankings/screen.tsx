import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Card, EmptyState, Screen } from '@/components/foundation';
import { ThemedText } from '@/components/themed-text';
import { CATEGORY_GROUPS_BY_MODE } from '@/features/categories/catalog';
import { useTheme } from '@/hooks/use-theme';
import { RankedPlaceCard } from './components/ranked-place-card';
import { RatePlaceModal } from './components/rate-place-modal';
import { ScoreBadge } from './components/score-badge';
import type { RankingMode } from './types';
import { useRankings } from './use-rankings';

export default function RankingsScreen() {
  const theme = useTheme();
  const [modalVisible, setModalVisible] = useState(false);

  const {
    mode,
    setMode,
    rankings,
    filteredRankings,
    loading,
    refreshing,
    error,
    categoryFilter,
    setCategoryFilter,
    searchQuery,
    setSearchQuery,
    stats,
    saveRating,
    removeRating,
    refresh,
  } = useRankings('food');

  const groups = CATEGORY_GROUPS_BY_MODE[mode];

  // Distinct category keys present in the user's rankings
  const activeCategoryPills = useMemo(() => {
    const activeKeys = new Set(rankings.map((r) => r.category_key).filter(Boolean));
    return groups.filter((g) => activeKeys.has(g.key));
  }, [rankings, groups]);

  const isFood = mode === 'food';

  return (
    <Screen title="Your places. Your favourites." eyebrow="RANKINGS">
      {/* Dual Mode Switcher (Food vs Activities) */}
      <View accessibilityRole="tablist" style={[styles.tabs, { backgroundColor: theme.backgroundSelected }]}>
        {(['food', 'activities'] as const).map((m) => (
          <Pressable
            key={m}
            accessibilityRole="tab"
            accessibilityState={{ selected: mode === m }}
            onPress={() => setMode(m)}
            style={({ pressed }) => [
              styles.tab,
              {
                backgroundColor: mode === m ? theme.accent : 'transparent',
                opacity: pressed ? 0.75 : 1,
              },
            ]}
          >
            <ThemedText
              type="smallBold"
              style={{ color: mode === m ? theme.onAccent : theme.textSecondary }}
            >
              {m === 'food' ? '🍕 Food Rankings' : '🎯 Activity Rankings'}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      {/* Stats Summary Banner */}
      <Card>
        <View style={styles.statsRow}>
          <View style={styles.statCol}>
            <ThemedText type="small" themeColor="textSecondary">
              Ranked
            </ThemedText>
            <ThemedText type="subtitle" style={styles.statNum}>
              {stats.totalCount}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {isFood ? 'restaurants' : 'activities'}
            </ThemedText>
          </View>

          <View style={[styles.statDivider, { backgroundColor: theme.border }]} />

          <View style={styles.statCol}>
            <ThemedText type="small" themeColor="textSecondary">
              Average
            </ThemedText>
            {stats.totalCount > 0 ? (
              <View style={{ marginTop: 2 }}>
                <ScoreBadge score={parseFloat(stats.averageScore)} size="small" />
              </View>
            ) : (
              <ThemedText type="subtitle" style={styles.statNum}>
                —
              </ThemedText>
            )}
            <ThemedText type="small" themeColor="textSecondary">
              out of 10
            </ThemedText>
          </View>

          <View style={[styles.statDivider, { backgroundColor: theme.border }]} />

          <View style={styles.statCol}>
            <ThemedText type="small" themeColor="textSecondary">
              #1 Pick
            </ThemedText>
            <ThemedText
              type="smallBold"
              numberOfLines={1}
              style={[styles.statNum, { fontSize: 16 }]}
            >
              {stats.topPlace?.display_name ?? '—'}
            </ThemedText>
            <ThemedText type="small" themeColor="primary">
              {stats.topPlace ? `★ ${stats.topPlace.rating.toFixed(1)}` : 'unranked'}
            </ThemedText>
          </View>
        </View>
      </Card>

      {/* Action: Rate a Place Floating Trigger */}
      <Pressable
        onPress={() => setModalVisible(true)}
        style={({ pressed }) => [
          styles.rateActionBtn,
          {
            backgroundColor: theme.primary,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <ThemedText type="smallBold" style={{ color: '#fff', fontSize: 16 }}>
          + Rate a {isFood ? 'Restaurant' : 'Place'}
        </ThemedText>
      </Pressable>

      {/* Filter / Search Area (Only if user has ranked places) */}
      {rankings.length > 0 && (
        <View style={{ gap: 10 }}>
          {/* Search bar */}
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={`Filter your ${isFood ? 'food' : 'activity'} rankings…`}
            placeholderTextColor={theme.textSecondary}
            style={[
              styles.filterSearchInput,
              {
                backgroundColor: theme.backgroundElement,
                borderColor: theme.border,
                color: theme.text,
              },
            ]}
          />

          {/* Category Filter Pills */}
          {activeCategoryPills.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
            >
              <Pressable
                onPress={() => setCategoryFilter(null)}
                style={[
                  styles.filterPill,
                  {
                    backgroundColor: categoryFilter === null ? theme.accent : theme.backgroundElement,
                    borderColor: theme.border,
                  },
                ]}
              >
                <ThemedText
                  type="smallBold"
                  style={{
                    color: categoryFilter === null ? theme.onAccent : theme.textSecondary,
                  }}
                >
                  All ({rankings.length})
                </ThemedText>
              </Pressable>

              {activeCategoryPills.map((group) => {
                const count = rankings.filter((r) => r.category_key === group.key).length;
                const isSelected = categoryFilter === group.key;
                return (
                  <Pressable
                    key={group.key}
                    onPress={() => setCategoryFilter(isSelected ? null : group.key)}
                    style={[
                      styles.filterPill,
                      {
                        backgroundColor: isSelected ? theme.accent : theme.backgroundElement,
                        borderColor: theme.border,
                      },
                    ]}
                  >
                    <ThemedText
                      type="smallBold"
                      style={{
                        color: isSelected ? theme.onAccent : theme.textSecondary,
                      }}
                    >
                      {group.icon} {group.label} ({count})
                    </ThemedText>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>
      )}

      {/* Error state */}
      {error && (
        <ThemedText style={{ color: '#e53935' }}>
          {error}
        </ThemedText>
      )}

      {/* Ranked List or Empty State */}
      {loading && !refreshing ? (
        <View style={styles.loadingArea}>
          <ActivityIndicator size="small" color={theme.primary} />
          <ThemedText themeColor="textSecondary" style={{ marginTop: 8 }}>
            Loading rankings…
          </ThemedText>
        </View>
      ) : filteredRankings.length > 0 ? (
        <View style={{ gap: 4 }}>
          {filteredRankings.map((item, idx) => (
            <RankedPlaceCard
              key={item.id}
              item={item}
              rank={idx + 1}
              onDelete={removeRating}
            />
          ))}
        </View>
      ) : rankings.length > 0 ? (
        <EmptyState
          title="No matching rankings"
          description="Try adjusting your search query or category filter."
        />
      ) : (
        <EmptyState
          title={`No ${isFood ? 'food' : 'activity'} rankings yet`}
          description={`Start rating places you’ve visited with Beli-style showdowns to build your personal ${isFood ? 'restaurant' : 'activity'} leaderboard and taste profile.`}
        />
      )}

      {/* Floating Card Rate Modal */}
      <RatePlaceModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSave={saveRating}
        existingRankings={rankings}
        mode={mode}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', padding: 4, gap: 4, borderRadius: 28 },
  tab: { flex: 1, minHeight: 44, padding: 10, alignItems: 'center', justifyContent: 'center', borderRadius: 24 },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  statNum: {
    fontSize: 20,
    fontWeight: '800',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 40,
  },
  rateActionBtn: {
    paddingVertical: 14,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  filterSearchInput: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1,
  },
  loadingArea: {
    paddingVertical: 32,
    alignItems: 'center',
  },
});
