import { useCallback, useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/app-header';
import { FilterOptions } from '@/components/filter-options';
import { Button, EmptyState } from '@/components/foundation';
import { ThemedText } from '@/components/themed-text';
import { RatePlaceModal } from '@/features/rankings/components/rate-place-modal';
import { getUserRankings, getUserRatingsMap, saveUserPlaceRating } from '@/features/rankings/service';
import type { CandidatePlace, RankedPlace, SaveRatingInput } from '@/features/rankings/types';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers/auth-provider';
import { RatingStatusDropdown, type RatingStatus } from './components/rating-status-dropdown';
import { SavedPlaceItem } from './components/saved-place-item';
import { useSavedPlaces } from './use-saved-places';
import type { SavedPlace } from './types';

const savedModeFilters = [
  { label: 'Activities', value: 'activities' },
  { label: 'Food', value: 'food' },
] as const satisfies readonly { label: string; value: SavedPlace['mode'] }[];

export default function BucketListScreen() {
  const theme = useTheme();
  const { session } = useAuth();
  const userId = session?.user.id;
  const { places, loading, refreshing, error, refresh } = useSavedPlaces();

  const [selectedMode, setSelectedMode] = useState<SavedPlace['mode']>('food');
  const [ratingStatus, setRatingStatus] = useState<RatingStatus>('rated');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [ratingsMap, setRatingsMap] = useState<Record<string, number>>({});
  const [ratingsLoading, setRatingsLoading] = useState(true);
  const [existingRankings, setExistingRankings] = useState<RankedPlace[]>([]);
  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [placeToRate, setPlaceToRate] = useState<CandidatePlace | null>(null);
  const [displayMode, setDisplayMode] = useState<'list' | 'grid'>('list');

  const loadRatings = useCallback(async () => {
    if (!userId) {
      setRatingsLoading(false);
      return;
    }

    setRatingsLoading(true);
    try {
      const [map, ranks] = await Promise.all([
        getUserRatingsMap(userId),
        getUserRankings(userId, selectedMode),
      ]);
      setRatingsMap(map);
      setExistingRankings(ranks);
    } finally {
      setRatingsLoading(false);
    }
  }, [selectedMode, userId]);

  useEffect(() => {
    void loadRatings().catch(() => undefined);
  }, [loadRatings]);

  const visiblePlaces = useMemo(() => places.filter((place) => {
    if (place.mode !== selectedMode) return false;
    if (ratingStatus === 'all') return true;
    const isRated = ratingsMap[place.google_place_id] !== undefined;
    return ratingStatus === 'rated' ? isRated : !isRated;
  }), [places, ratingStatus, ratingsMap, selectedMode]);

  const openDetails = (place: SavedPlace) => {
    router.push({
      pathname: '/(tabs)/bucket-list/[id]',
      params: { id: place.google_place_id, mode: place.mode },
    });
  };

  const openRating = (place: SavedPlace) => {
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

  const saveRating = async (input: SaveRatingInput) => {
    if (!userId) return;
    await saveUserPlaceRating(userId, input);
    await loadRatings();
  };

  const changeMode = (mode: SavedPlace['mode']) => {
    setDropdownOpen(false);
    setSelectedMode(mode);
  };

  const handleRefresh = () => {
    refresh();
    void loadRatings().catch(() => undefined);
  };

  const emptyLabel = ratingStatus === 'all'
    ? `saved ${selectedMode === 'food' ? 'food places' : 'activities'}`
    : `${ratingStatus} ${selectedMode === 'food' ? 'food places' : 'activities'}`;
  const showLoading = loading || ratingsLoading;

  return (
    <SafeAreaView edges={['left', 'right']} style={[styles.screen, { backgroundColor: theme.backgroundElement }]}>
      <AppHeader description="My Saved Places" />
      <View style={styles.content}>
        <FilterOptions options={savedModeFilters} value={selectedMode} onChange={changeMode} />
        <RatingStatusDropdown
          value={ratingStatus}
          open={dropdownOpen}
          onOpenChange={setDropdownOpen}
          onChange={setRatingStatus}
        />
        <View style={styles.viewSwitcher} accessibilityRole="tablist">
          {(['list', 'grid'] as const).map((mode) => <Pressable key={mode} accessibilityRole="tab" accessibilityState={{ selected: displayMode === mode }}
            onPress={() => setDisplayMode(mode)} style={[styles.viewOption, displayMode === mode && styles.selectedView]}>
            <ThemedText style={[styles.viewLabel, displayMode === mode && styles.selectedViewLabel]}>{mode === 'list' ? '☷  List' : '▦  Grid'}</ThemedText>
          </Pressable>)}
        </View>

        <FlatList
          key={displayMode}
          numColumns={displayMode === 'grid' ? 2 : 1}
          columnWrapperStyle={displayMode === 'grid' ? styles.gridRow : undefined}
          accessibilityRole="list"
          data={visiblePlaces}
          keyExtractor={(place) => place.google_place_id}
          renderItem={({ item }) => (
            <SavedPlaceItem
              place={item}
              grid={displayMode === 'grid'}
              userRating={ratingsMap[item.google_place_id]}
              onPress={openDetails}
              onRate={openRating}
            />
          )}
          contentContainerStyle={[styles.list, visiblePlaces.length === 0 && styles.emptyList]}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            showLoading ? <LoadingState />
              : error ? <ErrorState message={error} onRetry={handleRefresh} />
                : <EmptyState
                    title={`No ${emptyLabel} yet`}
                    description={ratingStatus === 'rated'
                      ? 'Rate a saved place and it will appear here.'
                      : ratingStatus === 'unrated'
                        ? 'Places you save from Search or Discover will appear here until you rate them.'
                        : 'Places you save from Search or Discover will appear here.'}
                  >
                    <Button label="Back to Discover" onPress={() => router.navigate('/')} />
                  </EmptyState>
          }
          onRefresh={handleRefresh}
          refreshing={refreshing}
          showsVerticalScrollIndicator={false}
        />
      </View>

      <RatePlaceModal
        visible={ratingModalVisible}
        onClose={() => setRatingModalVisible(false)}
        onSave={saveRating}
        existingRankings={existingRankings}
        mode={selectedMode}
        initialPlace={placeToRate}
      />
    </SafeAreaView>
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
    <View style={[styles.errorState, { borderColor: theme.border }]}>
      <ThemedText accessibilityRole="alert" style={styles.stateTitle}>Couldn’t load saved places</ThemedText>
      <ThemedText themeColor="textSecondary">{message}</ThemedText>
      <Pressable
        accessibilityRole="button"
        onPress={onRetry}
        style={({ pressed }) => [styles.retry, { backgroundColor: theme.primary, opacity: pressed ? 0.75 : 1 }]}
      >
        <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>Try again</ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, overflow: 'hidden' },
  content: { flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: 18, paddingTop: 18, gap: 14, overflow: 'hidden' },
  list: { paddingBottom: 120 },
  emptyList: { flexGrow: 1 },
  separator: { height: 12 },
  gridRow: { gap: 12 },
  viewSwitcher: { alignSelf: 'flex-end', padding: 3, borderRadius: 18, flexDirection: 'row', backgroundColor: '#F3F4F6' },
  viewOption: { minHeight: 34, borderRadius: 15, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  selectedView: { backgroundColor: '#000000' },
  viewLabel: { color: '#637068', fontSize: 12, lineHeight: 16, fontWeight: '700' },
  selectedViewLabel: { color: '#FFFFFF' },
  loadingState: { flex: 1, minHeight: 220, alignItems: 'center', justifyContent: 'center', gap: 14 },
  errorState: { borderWidth: 1, borderRadius: 24, padding: 24, gap: 14, backgroundColor: '#FFFFFF' },
  stateTitle: { fontSize: 24, lineHeight: 30, fontWeight: '700' },
  retry: { minHeight: 48, borderRadius: 16, paddingHorizontal: 20, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
});
