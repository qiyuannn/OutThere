import { ActivityIndicator, FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import type { CandidatePlace } from '../../types';

interface SelectPlaceStepProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  loading: boolean;
  candidates: CandidatePlace[];
  onSelect: (place: CandidatePlace) => void;
}

export function SelectPlaceStep({
  searchQuery,
  onSearchChange,
  loading,
  candidates,
  onSelect,
}: SelectPlaceStepProps) {
  const theme = useTheme();

  return (
    <View style={{ flex: 1 }}>
      <TextInput
        value={searchQuery}
        onChangeText={onSearchChange}
        placeholder="Search saved or recent places…"
        placeholderTextColor={theme.textSecondary}
        style={[
          styles.searchInput,
          {
            backgroundColor: theme.backgroundElement,
            borderColor: theme.border,
            color: theme.text,
          },
        ]}
      />

      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="small" color={theme.primary} />
          <ThemedText themeColor="textSecondary" style={{ marginTop: 8 }}>
            Loading places…
          </ThemedText>
        </View>
      ) : (
        <FlatList
          data={candidates}
          keyExtractor={(item) => item.google_place_id}
          style={styles.candidateList}
          contentContainerStyle={{ gap: 8, paddingBottom: 16 }}
          ListEmptyComponent={
            <View style={styles.emptyList}>
              <ThemedText themeColor="textSecondary" style={{ textAlign: 'center' }}>
                {searchQuery.trim()
                  ? 'No matching places found.'
                  : 'No unrated places found. Save places from Discover to rate them here.'}
              </ThemedText>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => onSelect(item)}
              style={({ pressed }) => [
                styles.candidateItem,
                {
                  backgroundColor: theme.backgroundElement,
                  borderColor: theme.border,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
            >
              <View style={{ flex: 1 }}>
                <ThemedText type="smallBold" style={{ fontSize: 15 }}>
                  {item.display_name}
                </ThemedText>
                {item.primary_type_display_name ? (
                  <ThemedText themeColor="primary" type="small" style={{ marginTop: 2 }}>
                    {item.primary_type_display_name}
                  </ThemedText>
                ) : null}
                {item.formatted_address ? (
                  <ThemedText themeColor="textSecondary" type="small" numberOfLines={1}>
                    {item.formatted_address}
                  </ThemedText>
                ) : null}
              </View>
              <ThemedText style={{ fontSize: 18, color: theme.primary }}>→</ThemedText>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  searchInput: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 12,
  },
  centerLoading: { padding: 32, alignItems: 'center' },
  candidateList: { maxHeight: 340 },
  candidateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
  },
  emptyList: { padding: 24 },
});
