import { useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, EmptyState } from '@/components/foundation';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
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
  return level ? priceLabels[level] ?? level : 'Price unavailable';
}

function openingLabel(openNow: boolean | null) {
  if (openNow === null) return 'Hours unavailable';
  return openNow ? 'Open now' : 'Closed now';
}

export default function BucketListScreen() {
  const theme = useTheme();
  const { places, loading, refreshing, error, refresh } = useSavedPlaces();
  const [selectedMode, setSelectedMode] = useState<SavedPlace['mode']>('food');
  const visiblePlaces = places.filter((place) => place.mode === selectedMode);
  const selectedLabel = selectedMode === 'food' ? 'food' : 'activity';

  return <SafeAreaView edges={['top', 'left', 'right']} style={[styles.screen, { backgroundColor: theme.background }]}>
    <FlatList
      data={visiblePlaces}
      keyExtractor={(place) => place.google_place_id}
      renderItem={({ item }) => <SavedPlaceRow place={item} />}
      contentContainerStyle={[styles.content, visiblePlaces.length === 0 && styles.emptyContent]}
      ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: theme.border }]} />}
      ListHeaderComponent={<View style={styles.header}>
        <ThemedText type="smallBold" themeColor="primary" style={styles.eyebrow}>BUCKET LIST</ThemedText>
        <ThemedText accessibilityRole="header" type="title" style={styles.title}>Your someday starts here.</ThemedText>
        <View accessibilityRole="tablist" style={[styles.tabs, { backgroundColor: theme.backgroundSelected }]}>
          {(['food', 'activities'] as const).map((mode) => {
            const selected = selectedMode === mode;
            return <Pressable key={mode} accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => setSelectedMode(mode)}
              style={({ pressed }) => [styles.tab, { backgroundColor: selected ? theme.accent : 'transparent', opacity: pressed ? 0.75 : 1 }]}>
              <ThemedText type="smallBold" style={{ color: selected ? theme.onAccent : theme.textSecondary }}>
                {mode === 'food' ? 'Food' : 'Activity'}
              </ThemedText>
            </Pressable>;
          })}
        </View>
        {visiblePlaces.length > 0 ? <ThemedText themeColor="textSecondary">
          {visiblePlaces.length} saved {selectedLabel} {visiblePlaces.length === 1 ? 'place' : 'places'}
        </ThemedText> : null}
      </View>}
      ListEmptyComponent={loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={refresh} /> : <EmptyState
        title={`No saved ${selectedMode === 'food' ? 'food' : 'activities'} yet`}
        description={`Places you save from Discover’s ${selectedMode === 'food' ? 'Food' : 'Activities'} tab will show up here.`}
      >
        <Button label="Back to Discover" onPress={() => router.navigate('/')} />
      </EmptyState>}
      onRefresh={refresh}
      refreshing={refreshing}
      accessibilityRole="list"
    />
  </SafeAreaView>;
}

function SavedPlaceRow({ place }: { place: SavedPlace }) {
  const theme = useTheme();
  const name = place.display_name ?? 'Unnamed place';
  const location = place.location ?? 'Location unavailable';
  const category = place.category ?? (place.mode === 'food' ? 'Food' : 'Activity');
  const price = priceLabel(place.price_level);
  const opening = openingLabel(place.open_now);

  return <View accessible accessibilityLabel={`${name}. ${price}. ${category}. ${location}. ${opening}.`}
    style={styles.row}>
    <View style={styles.rowCopy}>
      <ThemedText accessibilityRole="header" numberOfLines={2} style={styles.placeName}>{name}</ThemedText>
      <ThemedText numberOfLines={2} style={styles.detailLine}>{price} · {category}</ThemedText>
      <ThemedText numberOfLines={2} style={styles.detailLine}>⌖ · {location}</ThemedText>
      <ThemedText numberOfLines={1} style={[styles.openingStatus, { color: place.open_now ? theme.primary : theme.textSecondary }]}>{opening}</ThemedText>
    </View>
  </View>;
}

function LoadingState() {
  const theme = useTheme();
  return <View accessibilityRole="progressbar" style={styles.loadingState}>
    <ActivityIndicator size="large" color={theme.primary} />
    <ThemedText themeColor="textSecondary">Loading your saved places…</ThemedText>
  </View>;
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  const theme = useTheme();
  return <View style={[styles.errorState, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
    <ThemedText accessibilityRole="alert" type="subtitle" style={styles.stateTitle}>Couldn’t load saved places</ThemedText>
    <ThemedText themeColor="textSecondary">{message}</ThemedText>
    <Pressable accessibilityRole="button" onPress={onRetry}
      style={({ pressed }) => [styles.retry, { backgroundColor: theme.primary, opacity: pressed ? 0.75 : 1 }]}>
      <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>Try again</ThemedText>
    </Pressable>
  </View>;
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
  separator: { height: StyleSheet.hairlineWidth },
  row: { minHeight: 124, paddingVertical: 16 },
  rowCopy: { flex: 1, minWidth: 0 },
  placeName: { fontSize: 18, lineHeight: 23, fontWeight: '800', letterSpacing: -0.25 },
  detailLine: { fontSize: 14, lineHeight: 19, fontWeight: '500' },
  openingStatus: { marginTop: 12, fontSize: 13, lineHeight: 18, fontWeight: '500' },
  loadingState: { flex: 1, minHeight: 220, alignItems: 'center', justifyContent: 'center', gap: 14 },
  errorState: { borderWidth: 1, borderRadius: 24, padding: 24, gap: 14 },
  stateTitle: { fontSize: 24, lineHeight: 30 },
  retry: { minHeight: 48, borderRadius: 16, paddingHorizontal: 20, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
});
