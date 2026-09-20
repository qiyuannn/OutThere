import { useState } from 'react';
import { router, type Href } from 'expo-router';
import { ActivityIndicator, FlatList, Keyboard, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/app-header';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { enforceSearchAccess } from '@/features/subscriptions/model';
import { useSubscription } from '@/providers/subscription-provider';
import { AreaSheet } from './area-sheet';
import { FilterSheet } from './filter-sheet';
import { DEFAULT_FILTERS, type SearchArea, type SearchFilters, type SearchPlace } from './model';
import { PlaceSuggestions } from './place-suggestions';
import { SearchControls } from './search-controls';
import { SearchPlaceItem } from './search-place-item';
import { usePlaceSearch } from './use-search';

export function SearchScreen() {
  const theme = useTheme();
  const search = usePlaceSearch();
  const { isPro } = useSubscription();
  const [query, setQuery] = useState('');
  const [area, setArea] = useState<SearchArea | null>(null);
  const [filters, setFilters] = useState<SearchFilters>({ ...DEFAULT_FILTERS });
  const [sheet, setSheet] = useState<'area' | 'filters' | null>(null);
  const [pendingSubmit, setPendingSubmit] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  function submit(q = query, nextFilters = filters, nextArea = area) {
    if (q.trim().length < 2) return;
    setShowSuggestions(false);
    Keyboard.dismiss();
    if (!nextArea) {
      setPendingSubmit(true);
      setSheet('area');
      return;
    }
    router.push({
      pathname: '/search/results',
      params: {
        query: q.trim(),
        latitude: String(nextArea.latitude),
        longitude: String(nextArea.longitude),
        filters: JSON.stringify(nextFilters),
      },
    } as unknown as Href);
  }

  function apply(nextFilters: SearchFilters) {
    setFilters(enforceSearchAccess(nextFilters, isPro));
    setSheet(null);
  }

  const activeFilterCount = [
    filters.mode !== DEFAULT_FILTERS.mode,
    filters.category !== DEFAULT_FILTERS.category,
    filters.radiusMeters !== DEFAULT_FILTERS.radiusMeters,
    filters.openNow !== DEFAULT_FILTERS.openNow,
    filters.price !== DEFAULT_FILTERS.price,
    filters.minRating !== DEFAULT_FILTERS.minRating,
    filters.sort !== DEFAULT_FILTERS.sort,
  ].filter(Boolean).length;

  const openFilters = () => {
    setShowSuggestions(false);
    Keyboard.dismiss();
    setSheet('filters');
  };

  const selectSuggestion = (place: { id: string; name: string }) => {
    setShowSuggestions(false);
    setQuery('');
    Keyboard.dismiss();
    router.push({ pathname: '/search/[id]', params: { id: place.id } } as unknown as Href);
  };

  const openPlace = (place: Pick<SearchPlace, 'id'>) => {
    setShowSuggestions(false);
    Keyboard.dismiss();
    router.push({ pathname: '/search/[id]', params: { id: place.id } } as unknown as Href);
  };

  const inputEmpty = query.trim().length === 0;
  const autocompleteVisible = !sheet && !inputEmpty && showSuggestions;

  return (
    <SafeAreaView edges={['left', 'right']} style={[styles.screen, { backgroundColor: theme.backgroundElement }]}>
      <AppHeader description="Where To Go?" />
      <View style={styles.content}>
        <SearchControls
          value={query}
          onFocus={() => setShowSuggestions(true)}
          onChangeText={(value) => {
            setQuery(value);
            setShowSuggestions(true);
          }}
          returnKeyType="search"
          onSubmitEditing={() => submit()}
          onOpenFilters={openFilters}
          activeFilterCount={activeFilterCount}
        />

        {autocompleteVisible ? (
          <PlaceSuggestions query={query} center={area ?? undefined} onSelect={selectSuggestion} />
        ) : inputEmpty ? (
          <>
            <View style={styles.sectionHeader}>
              <ThemedText style={styles.sectionTitle}>Recent</ThemedText>
            </View>
            <FlatList
              accessibilityRole="list"
              data={search.recentPlaces}
              keyExtractor={(place) => place.id}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={[styles.recentList, search.recentPlaces.length === 0 && styles.emptyList]}
              ItemSeparatorComponent={() => <View style={styles.recentSeparator} />}
              renderItem={({ item }) => (
                <SearchPlaceItem
                  place={item}
                  onPress={openPlace}
                  onDelete={(place) => void search.removeRecentPlace(place.id)}
                />
              )}
              ListEmptyComponent={
                search.recentPlacesLoading
                  ? <ActivityIndicator color={theme.primary} accessibilityLabel="Loading recent places" />
                  : <ThemedText style={styles.emptyCopy}>Places you open from Search will appear here.</ThemedText>
              }
              showsVerticalScrollIndicator={false}
            />
          </>
        ) : null}
      </View>

      {sheet === 'area' ? (
        <AreaSheet
          onClose={() => {
            setSheet(null);
            setPendingSubmit(false);
          }}
          onSelect={(nextArea) => {
            setArea(nextArea);
            setSheet(null);
            if (pendingSubmit) submit(query, filters, nextArea);
            setPendingSubmit(false);
          }}
        />
      ) : null}
      {sheet === 'filters' ? <FilterSheet filters={filters} isPro={isPro} onApply={apply} onClose={() => setSheet(null)} onUpgrade={() => { setSheet(null); router.push('/profile/subscription'); }} /> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, overflow: 'hidden' },
  content: { flex: 1, width: '100%', maxWidth: 402, alignSelf: 'center', padding: 10, gap: 10, overflow: 'hidden' },
  sectionHeader: { width: '100%', padding: 10, justifyContent: 'center', overflow: 'hidden' },
  sectionTitle: { color: '#000000', fontSize: 16, fontWeight: '600', lineHeight: 20 },
  recentList: { padding: 10, paddingBottom: 36 },
  recentSeparator: { height: 10 },
  emptyList: { flexGrow: 1 },
  emptyCopy: { color: '#637068', fontSize: 13, lineHeight: 19 },
});
