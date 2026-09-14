import { useState } from 'react';
import { ActivityIndicator, FlatList, Keyboard, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Button } from '@/components/foundation';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { DEFAULT_FILTERS, SEARCH_CATEGORIES, priceLabel, type SearchArea, type SearchFilters } from './model';
import { AreaSheet } from './area-sheet';
import { FilterSheet } from './filter-sheet';
import { ResultCard } from './result-card';
import { Chip, SearchInput, searchStyles } from './controls';
import { usePlaceSearch } from './use-search';

export function SearchScreen() {
  const theme = useTheme();
  const search = usePlaceSearch();
  const [query, setQuery] = useState('');
  const [area, setArea] = useState<SearchArea | null>(null);
  const [filters, setFilters] = useState<SearchFilters>({ ...DEFAULT_FILTERS });
  const [sheet, setSheet] = useState<'area' | 'filters' | null>(null);
  const [pendingSubmit, setPendingSubmit] = useState(false);
  function submit(q = query, f = filters, a = area) {
    if (q.trim().length < 2) return;
    Keyboard.dismiss();
    if (!a) { setPendingSubmit(true); setSheet('area'); return; }
    void search.run({ query: q.trim(), filters: f, center: { latitude: a.latitude, longitude: a.longitude } });
  }
  function apply(next: SearchFilters) {
    setFilters(next); setSheet(null);
    if (search.request) submit(search.request.query, next);
  }
  const chips: { key: string; label: string; clear: Partial<SearchFilters> }[] = [
    ...(filters.mode !== 'all' ? [{ key: 'mode', label: filters.mode === 'food' ? 'Food' : 'Activities', clear: { mode: 'all' as const, category: '' } }] : []),
    ...(filters.category ? [{ key: 'category', label: SEARCH_CATEGORIES.find(c => c.key === filters.category)?.label ?? filters.category, clear: { category: '' } }] : []),
    ...(filters.radiusMeters !== DEFAULT_FILTERS.radiusMeters ? [{ key: 'distance', label: `${filters.radiusMeters / 1000} km`, clear: { radiusMeters: DEFAULT_FILTERS.radiusMeters } }] : []),
    ...(filters.openNow ? [{ key: 'open', label: 'Open now', clear: { openNow: false } }] : []),
    ...(filters.price ? [{ key: 'price', label: priceLabel(filters.price), clear: { price: '' } }] : []),
    ...(filters.minRating ? [{ key: 'rating', label: `${filters.minRating}+ ★`, clear: { minRating: 0 } }] : []),
    ...(filters.sort !== 'relevance' ? [{ key: 'sort', label: 'Nearest', clear: { sort: 'relevance' as const } }] : []),
  ];
  return <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: theme.background }}>
    <FlatList data={search.results} keyExtractor={p => p.id} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets
      contentContainerStyle={{ padding: 24, gap: 18, paddingBottom: 40, width: '100%', maxWidth: 720, alignSelf: 'center' }}
      ListHeaderComponent={<View style={{ gap: 16 }}>
        <ThemedText type="smallBold" themeColor="primary" style={{ letterSpacing: 3 }}>OUTTHERE</ThemedText>
        <ThemedText type="title" accessibilityRole="header">Find your next place</ThemedText>
        <ThemedText themeColor="textSecondary">A favourite dish, a new neighbourhood, or somewhere worth the detour.</ThemedText>
        <SearchInput accessibilityLabel="Search places" placeholder="Ramen, quiet café, Botanic Gardens…" value={query} onChangeText={setQuery} returnKeyType="search" onSubmitEditing={() => submit()} />
        <View style={searchStyles.row}><Chip label={area ? `Near ${area.label}` : 'Choose search area'} onPress={() => { setPendingSubmit(false); setSheet('area'); }} /><Chip label={`Filters${chips.length ? ` (${chips.length})` : ''}`} onPress={() => setSheet('filters')} /></View>
        <ThemedText type="small" themeColor="textSecondary">Within {filters.radiusMeters / 1000} km · {filters.sort === 'distance' ? 'Nearest matches' : 'Most relevant'}</ThemedText>
        {!!chips.length && <View style={searchStyles.row}>{chips.map(c => <Chip key={c.key} label={`${c.label} ×`} selected onPress={() => apply({ ...filters, ...c.clear })} />)}</View>}
        <Button label={search.loading ? 'Searching…' : 'Search places'} disabled={query.trim().length < 2} onPress={() => submit()} />
        {!search.request && !!search.recent.length && <View style={{ gap: 12 }}>
          <ThemedText type="smallBold">Recent searches</ThemedText><View style={searchStyles.row}>{search.recent.map(q => <Chip key={q} label={q} onPress={() => { setQuery(q); submit(q); }} />)}</View><Chip label="Clear recent searches" onPress={search.clearRecent} />
        </View>}
        {!search.request && <View style={searchStyles.row}>{['Cafés', 'Parks', 'Museums', 'Ramen'].map(q => <Chip key={q} label={q} onPress={() => { setQuery(q); submit(q); }} />)}</View>}
        {search.request && <ThemedText type="smallBold">{search.results.length} matches for “{search.request.query}”</ThemedText>}
        {search.loading && <ActivityIndicator color={theme.primary} accessibilityLabel="Searching places" />}
      </View>}
      renderItem={({ item }) => <ResultCard place={item} saved={search.savedIds.has(item.id)} saving={search.savingIds.has(item.id)}
        onOpen={() => router.push({ pathname: '/(tabs)/search/[id]', params: { id: item.id, mode: item.mode } })} onSave={() => search.toggleSave(item)} />}
      ListFooterComponent={<View style={{ gap: 16 }}>
        {search.error && <><ThemedText accessibilityRole="alert">{search.error}</ThemedText><Button label="Retry" onPress={() => { if (search.response?.cursor) void search.loadMore(); else if (search.request) void search.run(search.request); }} /></>}
        {search.response && !search.loading && !search.results.length && <><ThemedText type="subtitle">No matches in this area</ThemedText><ThemedText themeColor="textSecondary">Try a wider distance, fewer filters, or a different query. Places with missing prices, ratings, or hours cannot match those filters.</ThemedText><Chip label="Adjust filters" onPress={() => setSheet('filters')} /></>}
        {search.response?.cursor && <Button label={search.loadingMore ? 'Loading more…' : 'Load more matches'} disabled={search.loadingMore} onPress={() => void search.loadMore()} />}
        {search.response && <ThemedText type="small" themeColor="textSecondary">{search.response.limited ? 'Search limit reached. Narrow your query or choose another area for more matches. ' : ''}Results reflect Google’s available matches, not every place in the area. Distances are straight-line distances.{filters.sort === 'distance' ? ' Nearest sorts the loaded matches.' : ''}</ThemedText>}
      </View>} />
    {sheet === 'area' && <AreaSheet onClose={() => { setSheet(null); setPendingSubmit(false); }} onSelect={next => { setArea(next); setSheet(null); if (pendingSubmit || search.request) submit(query || search.request?.query, filters, next); setPendingSubmit(false); }} />}
    {sheet === 'filters' && <FilterSheet filters={filters} onApply={apply} onClose={() => setSheet(null)} />}
  </SafeAreaView>;
}
