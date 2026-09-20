import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { GoogleAttribution } from './result-card';
import { SearchPlaceItem } from './search-place-item';
import { suggestPlaces } from './service';
import { createSuggestionsController, type PlaceSuggestion, type SuggestionsState } from './suggestions-controller';

export function PlaceSuggestions({ query, center, onSelect }: {
  query: string;
  center?: { latitude: number; longitude: number };
  onSelect: (place: PlaceSuggestion) => void;
}) {
  const theme = useTheme();
  const [state, setState] = useState<SuggestionsState>({ items: [], loading: false, error: null });
  const controller = useMemo(() => createSuggestionsController(suggestPlaces, setState), []);

  useEffect(() => {
    controller.update(query, center);
    return controller.cancel;
  }, [controller, query, center?.latitude, center?.longitude]);

  const input = query.trim();
  if (!input) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <ThemedText style={styles.title}>Suggestions</ThemedText>
      </View>
      <FlatList
        accessibilityRole="list"
        data={state.items}
        keyExtractor={(place) => place.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.list, state.items.length === 0 && styles.emptyList]}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => (
          <SearchPlaceItem
            place={{ id: item.id, name: item.name, address: item.address }}
            onPress={() => {
              controller.cancel();
              onSelect(item);
            }}
          />
        )}
        ListEmptyComponent={
          <View style={styles.status}>
            {input.length < 2 ? (
              <ThemedText style={styles.statusCopy}>Keep typing to find places.</ThemedText>
            ) : state.loading ? (
              <ActivityIndicator accessibilityLabel="Finding place suggestions" color={theme.primary} />
            ) : state.error ? (
              <ThemedText accessibilityRole="alert" style={styles.statusCopy}>{state.error}</ThemedText>
            ) : (
              <ThemedText style={styles.statusCopy}>No matching places found.</ThemedText>
            )}
          </View>
        }
        ListFooterComponent={state.items.length ? <GoogleAttribution /> : null}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 0 },
  header: { width: '100%', padding: 10, justifyContent: 'center', overflow: 'hidden' },
  title: { color: '#000000', fontSize: 16, fontWeight: '600', lineHeight: 20 },
  list: { padding: 10, paddingBottom: 36 },
  emptyList: { flexGrow: 1 },
  separator: { height: 10 },
  status: { minHeight: 100, alignItems: 'center', justifyContent: 'center' },
  statusCopy: { color: '#637068', fontSize: 13, lineHeight: 19, textAlign: 'center' },
});
