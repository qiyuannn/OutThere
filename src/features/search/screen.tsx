import { useState } from 'react';
import { router, type Href } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { FlatList, Keyboard, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
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
          <QuickFilter
            active={filters.mode === 'food'}
            label="🍕 Food"
            onPress={() => setFilters((current) => ({ ...current, mode: current.mode === 'food' ? 'all' : 'food', category: '' }))}
          />
          <QuickFilter
            active={filters.mode === 'activities'}
            label="🎯 Activities"
            onPress={() => setFilters((current) => ({ ...current, mode: current.mode === 'activities' ? 'all' : 'activities', category: '' }))}
          />
          <QuickFilter
            active={query.toLowerCase() === 'coffee'}
            label="☕ Coffee"
            onPress={() => {
              const next = query.toLowerCase() === 'coffee' ? '' : 'Coffee';
              setQuery(next);
              if (next) submit(next);
            }}
          />
          <QuickFilter
            active={query.toLowerCase() === 'cocktails'}
            label="🍸 Cocktails"
            onPress={() => {
              const next = query.toLowerCase() === 'cocktails' ? '' : 'Cocktails';
              setQuery(next);
              if (next) submit(next);
            }}
          />
          <QuickFilter
            active={query.toLowerCase() === 'parks'}
            label="🌳 Parks"
            onPress={() => {
              const next = query.toLowerCase() === 'parks' ? '' : 'Parks';
              setQuery(next);
              if (next) submit(next);
            }}
          />
          <QuickFilter
            active={filters.openNow}
            label="⚡ Open now"
            onPress={() => setFilters((current) => ({ ...current, openNow: !current.openNow }))}
          />
          <QuickFilter
            active={filters.sort === 'distance'}
            label="📍 Nearest"
            onPress={() => setFilters((current) => ({ ...current, sort: current.sort === 'distance' ? 'relevance' : 'distance' }))}
          />
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
                  : <View style={[styles.emptyCard, { backgroundColor: theme.backgroundSelected, borderColor: theme.border }]}><ThemedText style={[styles.emptyTitle, { color: theme.text }]}>Start exploring</ThemedText><ThemedText style={[styles.emptyCopy, { color: theme.textSecondary }]}>Search for a restaurant, activity, dish or neighbourhood. Places you open will appear here.</ThemedText></View>
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
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={() => {
        if (Platform.OS !== 'web') void Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [
        styles.quickFilter,
        {
          backgroundColor: active ? theme.primary : theme.backgroundElement,
          borderColor: active ? theme.primary : theme.border,
        },
        pressed && styles.quickFilterPressed,
      ]}
    >
      <ThemedText style={[styles.quickFilterLabel, { color: active ? theme.onPrimary : theme.text }]}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, overflow: 'hidden' },
  content: { flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: 18, paddingTop: 18, gap: 18, overflow: 'hidden' },
  recentList: { paddingBottom: 120 },
  recentSeparator: { height: 12 },
  emptyList: { flexGrow: 1 },
  emptyCard: { minHeight: 180, borderRadius: 28, borderWidth: 1, padding: 24, justifyContent: 'center', gap: 8 },
  emptyTitle: { fontSize: 20, lineHeight: 25, fontWeight: '700' },
  emptyCopy: { fontSize: 14, lineHeight: 20 },
  skeletons: { gap: 12 },
  quickFilters: { gap: 8, paddingRight: 16 },
  quickFilter: {
    minHeight: 38,
    borderRadius: 19,
    borderWidth: 1,
    paddingHorizontal: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickFilterPressed: {
    transform: [{ scale: 0.94 }],
    opacity: 0.8,
  },
  quickFilterLabel: { fontSize: 13, lineHeight: 17, fontWeight: '700' },
});
