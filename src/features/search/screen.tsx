import { useState } from 'react';
import { router, type Href } from 'expo-router';
import { FlatList, Keyboard, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/app-header';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { enforceSearchAccess } from '@/features/subscriptions/model';
import { useSubscription } from '@/providers/subscription-provider';
import { SectionHeading, SkeletonBlock } from '@/components/ui-system';
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
        <ScrollView horizontal keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickFilters}>
          <QuickFilter active={filters.mode === 'food'} label="Food" onPress={() => setFilters((current) => ({ ...current, mode: current.mode === 'food' ? 'all' : 'food', category: '' }))} />
          <QuickFilter active={filters.mode === 'activities'} label="Activities" onPress={() => setFilters((current) => ({ ...current, mode: current.mode === 'activities' ? 'all' : 'activities', category: '' }))} />
          <QuickFilter active={filters.openNow} label="Open now" onPress={() => setFilters((current) => ({ ...current, openNow: !current.openNow }))} />
          <QuickFilter active={filters.sort === 'distance'} label="Nearest" onPress={() => setFilters((current) => ({ ...current, sort: current.sort === 'distance' ? 'relevance' : 'distance' }))} />
        </ScrollView>

        {autocompleteVisible ? (
          <PlaceSuggestions query={query} center={area ?? undefined} onSelect={selectSuggestion} />
        ) : inputEmpty ? (
          <>
            <SectionHeading eyebrow="Pick up where you left off" title="Recent places" />
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
                  ? <View style={styles.skeletons} accessibilityLabel="Loading recent places"><SkeletonBlock height={82} /><SkeletonBlock height={82} /></View>
                  : <View style={styles.emptyCard}><ThemedText style={styles.emptyTitle}>Start exploring</ThemedText><ThemedText style={styles.emptyCopy}>Search for a restaurant, activity, dish or neighbourhood. Places you open will appear here.</ThemedText></View>
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

function QuickFilter({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={[styles.quickFilter, active && styles.activeQuickFilter]}>
    <ThemedText style={[styles.quickFilterLabel, active && styles.activeQuickFilterLabel]}>{label}</ThemedText>
  </Pressable>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, overflow: 'hidden' },
  content: { flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: 18, paddingTop: 18, gap: 18, overflow: 'hidden' },
  recentList: { paddingBottom: 120 },
  recentSeparator: { height: 12 },
  emptyList: { flexGrow: 1 },
  emptyCard: { minHeight: 180, borderRadius: 28, padding: 24, justifyContent: 'center', gap: 8, backgroundColor: '#F3F4F6' },
  emptyTitle: { color: '#000000', fontSize: 20, lineHeight: 25, fontWeight: '700' },
  emptyCopy: { color: '#637068', fontSize: 15, lineHeight: 21 },
  skeletons: { gap: 12 },
  quickFilters: { gap: 8, paddingRight: 16 },
  quickFilter: { minHeight: 38, borderRadius: 19, paddingHorizontal: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F4F6' },
  activeQuickFilter: { backgroundColor: '#000000' },
  quickFilterLabel: { color: '#637068', fontSize: 13, lineHeight: 17, fontWeight: '700' },
  activeQuickFilterLabel: { color: '#FFFFFF' },
});
