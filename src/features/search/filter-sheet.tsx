import { useState } from 'react';
import { View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/foundation';
import { DEFAULT_FILTERS, PRICES, SEARCH_CATEGORIES, type SearchFilters, type SearchMode } from './model';
import { Chip, SearchSheet, searchStyles } from './controls';

export function FilterSheet({ filters, onApply, onClose }: { filters: SearchFilters; onApply: (value: SearchFilters) => void; onClose: () => void }) {
  const [draft, setDraft] = useState(filters);
  function patch(value: Partial<SearchFilters>) { setDraft(old => ({ ...old, ...value })); }
  return <SearchSheet title="Search filters" onClose={onClose}>
    <ThemedText type="smallBold">Looking for</ThemedText>
    <View style={searchStyles.row}>{(['all', 'food', 'activities'] as SearchMode[]).map(mode => <Chip key={mode} label={mode === 'all' ? 'All places' : mode === 'food' ? 'Food' : 'Activities'} selected={draft.mode === mode} onPress={() => patch({ mode, category: '' })} />)}</View>
    <ThemedText type="smallBold">Category</ThemedText>
    <View style={searchStyles.row}><Chip label="Any category" selected={!draft.category} onPress={() => patch({ category: '' })} />
      {SEARCH_CATEGORIES.filter(c => draft.mode === 'all' || c.mode === draft.mode).map(c => <Chip key={c.key} label={c.label} selected={draft.category === c.key} onPress={() => patch({ category: c.key })} />)}</View>
    <ThemedText type="smallBold">Distance from your search area</ThemedText>
    <View style={searchStyles.row}>{[1, 2, 5, 10, 20, 30, 50].map(km => <Chip key={km} label={`${km} km`} selected={draft.radiusMeters === km * 1000} onPress={() => patch({ radiusMeters: km * 1000 })} />)}</View>
    <ThemedText type="smallBold">Opening hours</ThemedText>
    <View style={searchStyles.row}><Chip label="Any time" selected={!draft.openNow} onPress={() => patch({ openNow: false })} /><Chip label="Open now" selected={draft.openNow} onPress={() => patch({ openNow: true })} /></View>
    <ThemedText type="smallBold">Price</ThemedText>
    <View style={searchStyles.row}><Chip label="Any price" selected={!draft.price} onPress={() => patch({ price: '' })} />{PRICES.map(p => <Chip key={p.key} label={p.label} selected={draft.price === p.key} onPress={() => patch({ price: p.key })} />)}</View>
    <ThemedText type="small" themeColor="textSecondary">Price filters exclude places with no reported price. “Free” means Google reports a free price level; it does not guarantee every activity or service is free.</ThemedText>
    <ThemedText type="smallBold">Minimum Google rating</ThemedText>
    <View style={searchStyles.row}>{[0, 3, 3.5, 4, 4.5].map(r => <Chip key={r} label={r ? `${r}+ ★` : 'Any rating'} selected={draft.minRating === r} onPress={() => patch({ minRating: r })} />)}</View>
    <ThemedText type="smallBold">Sort by</ThemedText>
    <View style={searchStyles.row}><Chip label="Relevance" selected={draft.sort === 'relevance'} onPress={() => patch({ sort: 'relevance' })} /><Chip label="Nearest" selected={draft.sort === 'distance'} onPress={() => patch({ sort: 'distance' })} /></View>
    <ThemedText type="small" themeColor="textSecondary">Distance is straight-line distance. Nearest sorts the matches loaded from Google, not every place in the area.</ThemedText>
    <Button label="Apply filters" onPress={() => onApply(draft)} />
    <Chip label="Reset filters" onPress={() => setDraft({ ...DEFAULT_FILTERS })} />
  </SearchSheet>;
}
