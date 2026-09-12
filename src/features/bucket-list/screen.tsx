import { router } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, EmptyState } from '@/components/foundation';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { useSavedPlaces } from './use-saved-places';
import type { SavedPlace } from './types';

const savedDate = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

export default function BucketListScreen() {
  const theme = useTheme();
  const { places, loading, refreshing, error, refresh } = useSavedPlaces();

  return <SafeAreaView edges={['top', 'left', 'right']} style={[styles.screen, { backgroundColor: theme.background }]}>
    <FlatList
      data={places}
      keyExtractor={(place) => place.google_place_id}
      renderItem={({ item }) => <SavedPlaceRow place={item} />}
      contentContainerStyle={[styles.content, places.length === 0 && styles.emptyContent]}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      ListHeaderComponent={<View style={styles.header}>
        <ThemedText type="smallBold" themeColor="primary" style={styles.eyebrow}>BUCKET LIST</ThemedText>
        <ThemedText accessibilityRole="header" type="title" style={styles.title}>Your someday starts here.</ThemedText>
        {places.length > 0 ? <ThemedText themeColor="textSecondary">
          {places.length} saved {places.length === 1 ? 'place' : 'places'}
        </ThemedText> : null}
      </View>}
      ListEmptyComponent={loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={refresh} /> : <EmptyState
        title="Room for new possibilities"
        description="Places you save from Discover will show up here."
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
  const date = new Date(place.saved_at);
  const formattedDate = Number.isNaN(date.getTime()) ? 'Date unavailable' : `Saved ${savedDate.format(date)}`;

  return <View accessible accessibilityLabel={`${place.mode === 'food' ? 'Food' : 'Activity'} saved ${formattedDate.replace('Saved ', '')}`}
    style={[styles.row, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
    <View style={[styles.modeIcon, { backgroundColor: theme.backgroundSelected }]}>
      <ThemedText style={styles.modeIconText}>{place.mode === 'food' ? '◒' : '✦'}</ThemedText>
    </View>
    <View style={styles.rowCopy}>
      <ThemedText type="smallBold" numberOfLines={1}>{place.mode === 'food' ? 'Food' : 'Activity'}</ThemedText>
      <ThemedText type="code" themeColor="textSecondary" numberOfLines={1} selectable>{place.google_place_id}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">{formattedDate}</ThemedText>
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
  separator: { height: 12 },
  row: { minHeight: 96, borderWidth: 1, borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 },
  modeIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  modeIconText: { fontSize: 23, lineHeight: 28 },
  rowCopy: { flex: 1, minWidth: 0, gap: 2 },
  loadingState: { flex: 1, minHeight: 220, alignItems: 'center', justifyContent: 'center', gap: 14 },
  errorState: { borderWidth: 1, borderRadius: 24, padding: 24, gap: 14 },
  stateTitle: { fontSize: 24, lineHeight: 30 },
  retry: { minHeight: 48, borderRadius: 16, paddingHorizontal: 20, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
});
