import { useCallback, useEffect, useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, EmptyState } from '@/components/foundation';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers/auth-provider';
import { RatePlaceModal } from '@/features/rankings/components/rate-place-modal';
import { ScoreBadge } from '@/features/rankings/components/score-badge';
import { getUserRankings, getUserRatingsMap, saveUserPlaceRating } from '@/features/rankings/service';
import type { CandidatePlace, RankedPlace, SaveRatingInput } from '@/features/rankings/types';
import { useSavedPlaces } from './use-saved-places';
import type { SavedPlace } from './types';

const priceLabels: Record<string, string> = {
  PRICE_LEVEL_FREE: 'Free',
  PRICE_LEVEL_INEXPENSIVE: '$',
  PRICE_LEVEL_MODERATE: '$$',
  PRICE_LEVEL_EXPENSIVE: '$$$',
  PRICE_LEVEL_VERY_EXPENSIVE: '$$$$',
};

function priceLabel(level: string | null) {
  return level ? priceLabels[level] ?? level : null;
}

function openingLabel(openNow: boolean | null) {
  if (openNow === null) return null;
  return openNow ? 'Open now' : 'Closed now';
}

export default function BucketListScreen() {
  const theme = useTheme();
  const { session } = useAuth();
  const userId = session?.user.id;

  const { places, loading, refreshing, error, refresh } = useSavedPlaces();
  const [selectedMode, setSelectedMode] = useState<SavedPlace['mode']>('food');
  const visiblePlaces = places.filter((place) => place.mode === selectedMode);
  const selectedLabel = selectedMode === 'food' ? 'food' : 'activity';

  // Rating state
  const [ratingsMap, setRatingsMap] = useState<Record<string, number>>({});
  const [existingRankings, setExistingRankings] = useState<RankedPlace[]>([]);
  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [placeToRate, setPlaceToRate] = useState<CandidatePlace | null>(null);

  const loadRatings = useCallback(async () => {
    if (!userId) return;
    try {
      const [map, ranks] = await Promise.all([
        getUserRatingsMap(userId),
        getUserRankings(userId, selectedMode),
      ]);
      setRatingsMap(map);
      setExistingRankings(ranks);
    } catch {
      // Ignore rating load failure
    }
  }, [userId, selectedMode]);

  useEffect(() => {
    void loadRatings();
  }, [loadRatings]);

  const handleOpenRate = (place: SavedPlace) => {
    setPlaceToRate({
      google_place_id: place.google_place_id,
      display_name: place.display_name ?? (place.mode === 'food' ? 'Saved Food Spot' : 'Saved Activity'),
      formatted_address: place.location,
      primary_type: place.category,
      primary_type_display_name: place.category,
      photo_url: (place.places?.photos?.[0] as { url?: string } | undefined)?.url ?? null,
      mode: place.mode,
    });
    setRatingModalVisible(true);
  };

  const handleSaveRating = async (input: SaveRatingInput) => {
    if (!userId) return;
    await saveUserPlaceRating(userId, input);
    await loadRatings();
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.screen, { backgroundColor: theme.background }]}>
      <FlatList
        data={visiblePlaces}
        keyExtractor={(place) => place.google_place_id}
        renderItem={({ item }) => (
          <SavedPlaceRow
            place={item}
            userRating={ratingsMap[item.google_place_id]}
            onRate={handleOpenRate}
          />
        )}
        contentContainerStyle={[styles.content, visiblePlaces.length === 0 && styles.emptyContent]}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <ThemedText type="smallBold" themeColor="primary" style={styles.eyebrow}>
              BUCKET LIST
            </ThemedText>
            <ThemedText accessibilityRole="header" type="title" style={styles.title}>
              Your someday starts here.
            </ThemedText>
            <View accessibilityRole="tablist" style={[styles.tabs, { backgroundColor: theme.backgroundSelected }]}>
              {(['food', 'activities'] as const).map((mode) => {
                const selected = selectedMode === mode;
                return (
                  <Pressable
                    key={mode}
                    accessibilityRole="tab"
                    accessibilityState={{ selected }}
                    onPress={() => setSelectedMode(mode)}
                    style={({ pressed }) => [
                      styles.tab,
                      { backgroundColor: selected ? theme.accent : 'transparent', opacity: pressed ? 0.75 : 1 },
                    ]}
                  >
                    <ThemedText
                      type="smallBold"
                      style={{ color: selected ? theme.onAccent : theme.textSecondary }}
                    >
                      {mode === 'food' ? 'Food' : 'Activity'}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
            {visiblePlaces.length > 0 ? (
              <ThemedText themeColor="textSecondary">
                {visiblePlaces.length} saved {selectedLabel} {visiblePlaces.length === 1 ? 'place' : 'places'}
              </ThemedText>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <LoadingState />
          ) : error ? (
            <ErrorState message={error} onRetry={refresh} />
          ) : (
            <EmptyState
              title={`No saved ${selectedMode === 'food' ? 'food' : 'activities'} yet`}
              description={`Places you save from Discover’s ${selectedMode === 'food' ? 'Food' : 'Activities'} tab will show up here.`}
            >
              <Button label="Back to Discover" onPress={() => router.navigate('/')} />
            </EmptyState>
          )
        }
        onRefresh={refresh}
        refreshing={refreshing}
        accessibilityRole="list"
      />

      <RatePlaceModal
        visible={ratingModalVisible}
        onClose={() => setRatingModalVisible(false)}
        onSave={handleSaveRating}
        existingRankings={existingRankings}
        mode={selectedMode}
        initialPlace={placeToRate}
      />
    </SafeAreaView>
  );
}

function SavedPlaceRow({
  place,
  userRating,
  onRate,
}: {
  place: SavedPlace;
  userRating?: number;
  onRate: (place: SavedPlace) => void;
}) {
  const theme = useTheme();
  const name = place.display_name ?? (place.mode === 'food' ? 'Saved Food Spot' : 'Saved Activity');
  const location = place.location;
  const category = place.category ?? (place.mode === 'food' ? 'Food' : 'Activity');
  const price = priceLabel(place.price_level);
  const opening = openingLabel(place.open_now);

  const subLine = [price, category, location].filter(Boolean).join(' · ');

  const handlePress = () => {
    router.push({
      pathname: '/(tabs)/bucket-list/[id]',
      params: { id: place.google_place_id },
    });
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${category}`}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: theme.backgroundElement,
          borderColor: theme.border,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <View style={[styles.modeIcon, { backgroundColor: theme.backgroundSelected }]}>
        <ThemedText style={styles.modeIconText}>{place.mode === 'food' ? '◒' : '✦'}</ThemedText>
      </View>
      <View style={styles.rowCopy}>
        <View style={styles.titleRow}>
          <ThemedText type="smallBold" numberOfLines={1} style={styles.placeTitle}>
            {name}
          </ThemedText>
          {place.rating ? (
            <ThemedText type="smallBold" style={styles.ratingText}>
              ★ {place.rating.toFixed(1)}
            </ThemedText>
          ) : null}
        </View>
        {subLine ? (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {subLine}
          </ThemedText>
        ) : null}
        {opening ? (
          <ThemedText
            type="small"
            style={[styles.openingStatus, { color: place.open_now ? theme.primary : theme.textSecondary }]}
          >
            {opening}
          </ThemedText>
        ) : null}
      </View>
      <View style={styles.actionCol}>
        {userRating !== undefined ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Rated ${userRating}, tap to update`}
            onPress={() => onRate(place)}
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
          >
            <ScoreBadge score={userRating} size="small" />
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Rate ${name}`}
            onPress={() => onRate(place)}
            style={({ pressed }) => [
              styles.rateBtn,
              {
                backgroundColor: theme.backgroundSelected,
                borderColor: theme.border,
                opacity: pressed ? 0.75 : 1,
              },
            ]}
          >
            <ThemedText type="smallBold" themeColor="primary" style={{ fontSize: 12 }}>
              ★ Rate
            </ThemedText>
          </Pressable>
        )}
      </View>
      <ThemedText style={[styles.chevron, { color: theme.textSecondary }]}>›</ThemedText>
    </Pressable>
  );
}

function LoadingState() {
  const theme = useTheme();
  return (
    <View accessibilityRole="progressbar" style={styles.loadingState}>
      <ActivityIndicator size="large" color={theme.primary} />
      <ThemedText themeColor="textSecondary">Loading your saved places…</ThemedText>
    </View>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  const theme = useTheme();
  return (
    <View style={[styles.errorState, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <ThemedText accessibilityRole="alert" type="subtitle" style={styles.stateTitle}>
        Couldn’t load saved places
      </ThemedText>
      <ThemedText themeColor="textSecondary">{message}</ThemedText>
      <Pressable
        accessibilityRole="button"
        onPress={onRetry}
        style={({ pressed }) => [styles.retry, { backgroundColor: theme.primary, opacity: pressed ? 0.75 : 1 }]}
      >
        <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
          Try again
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: 24, paddingTop: 36, paddingBottom: 48 },
  emptyContent: { flexGrow: 1 },
  header: { gap: 10, marginBottom: 24 },
  eyebrow: { letterSpacing: 3 },
  title: { fontSize: 40, lineHeight: 46, fontWeight: '800', letterSpacing: -1.5 },
  tabs: { flexDirection: 'row', padding: 4, gap: 4, borderRadius: 24, marginTop: 6 },
  tab: { flex: 1, minHeight: 40, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  separator: { height: 12 },
  row: {
    minHeight: 96,
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  modeIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  modeIconText: { fontSize: 23, lineHeight: 28 },
  rowCopy: { flex: 1, minWidth: 0, gap: 3 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  placeTitle: { flex: 1, fontSize: 16, lineHeight: 22, fontWeight: '700' },
  ratingText: { fontSize: 13, color: '#E5A50A' },
  openingStatus: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
  chevron: { fontSize: 24, lineHeight: 26, paddingHorizontal: 4 },
  actionCol: { alignItems: 'center', justifyContent: 'center' },
  rateBtn: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  loadingState: { flex: 1, minHeight: 220, alignItems: 'center', justifyContent: 'center', gap: 14 },
  errorState: { borderWidth: 1, borderRadius: 24, padding: 24, gap: 14 },
  stateTitle: { fontSize: 24, lineHeight: 30 },
  retry: { minHeight: 48, borderRadius: 16, paddingHorizontal: 20, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
});
