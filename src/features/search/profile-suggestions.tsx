import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import type { ProfileSearchResult } from './model';
import { SearchProfileItem } from './search-profile-item';
import { searchProfiles } from './service';
import { createSuggestionsController, type SuggestionsState } from './suggestions-controller';

export function ProfileSuggestions({
  query,
  onSelect,
  onSwitchToPlaces,
}: {
  query: string;
  onSelect: (profile: ProfileSearchResult) => void;
  onSwitchToPlaces: () => void;
}) {
  const theme = useTheme();
  const [state, setState] = useState<SuggestionsState<ProfileSearchResult>>({
    items: [],
    loading: false,
    error: null,
  });

  const controller = useMemo(
    () =>
      createSuggestionsController<ProfileSearchResult>(
        (q) => searchProfiles(q),
        setState,
        250,
        'Could not search profiles. Check your connection and try again.',
      ),
    [],
  );

  useEffect(() => {
    controller.update(query);
    return controller.cancel;
  }, [controller, query]);

  const input = query.trim();

  return (
    <View style={styles.container}>
      {/* Switch to places button */}
      <Pressable
        accessibilityLabel="Search for places instead"
        accessibilityRole="button"
        onPress={onSwitchToPlaces}
        style={({ pressed }) => [styles.switchButton, pressed && styles.switchPressed]}
      >
        <View style={styles.switchIconSlot}>
          <ThemedText style={styles.switchIcon}>📍</ThemedText>
        </View>
        <View style={styles.switchTextSlot}>
          <ThemedText style={styles.switchTitle}>Search for places</ThemedText>
          {input ? (
            <ThemedText numberOfLines={1} style={styles.switchSubtitle}>
              Find places matching “{input}”
            </ThemedText>
          ) : null}
        </View>
        <ThemedText style={styles.switchArrow}>›</ThemedText>
      </Pressable>

      <View style={styles.header}>
        <ThemedText style={styles.title}>Profiles</ThemedText>
      </View>

      <FlatList
        accessibilityRole="list"
        data={state.items}
        keyExtractor={(profile) => profile.user_id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.list, state.items.length === 0 && styles.emptyList]}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => (
          <SearchProfileItem
            profile={item}
            onPress={() => {
              controller.cancel();
              onSelect(item);
            }}
          />
        )}
        ListEmptyComponent={
          <View style={styles.status}>
            {input.length < 2 ? (
              <ThemedText style={styles.statusCopy}>Keep typing to find profiles.</ThemedText>
            ) : state.loading ? (
              <ActivityIndicator accessibilityLabel="Finding profiles" color={theme.primary} />
            ) : state.error ? (
              <ThemedText accessibilityRole="alert" style={styles.statusCopy}>
                {state.error}
              </ThemedText>
            ) : (
              <ThemedText style={styles.statusCopy}>No matching profiles found.</ThemedText>
            )}
          </View>
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 0 },
  switchButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginVertical: 4,
    borderRadius: 14,
    backgroundColor: '#F3F6F1',
    borderWidth: 1,
    borderColor: '#DFE5D9',
    gap: 10,
  },
  switchPressed: {
    opacity: 0.7,
  },
  switchIconSlot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DFE5D9',
  },
  switchIcon: {
    fontSize: 15,
  },
  switchTextSlot: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  switchTitle: {
    color: '#14221D',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
  },
  switchSubtitle: {
    color: '#637068',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 15,
  },
  switchArrow: {
    color: '#637068',
    fontSize: 18,
    fontWeight: '400',
    paddingRight: 4,
  },
  header: {
    width: '100%',
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 4,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  title: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 20,
  },
  list: {
    padding: 10,
    paddingBottom: 36,
  },
  emptyList: {
    flexGrow: 1,
  },
  separator: {
    height: 6,
  },
  status: {
    minHeight: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusCopy: {
    color: '#637068',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
});
