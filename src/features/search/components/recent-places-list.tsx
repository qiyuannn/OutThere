import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import type { SearchPlace } from '../model';
import { SearchPlaceItem } from '../search-place-item';

interface RecentPlacesListProps {
  recentPlaces: SearchPlace[];
  loading: boolean;
  themePrimary: string;
  onOpenPlace: (place: Pick<SearchPlace, 'id'>) => void;
  onDeletePlace: (place: Pick<SearchPlace, 'id'>) => void;
}

export function RecentPlacesList({
  recentPlaces,
  loading,
  themePrimary,
  onOpenPlace,
  onDeletePlace,
}: RecentPlacesListProps) {
  return (
    <>
      <View style={styles.sectionHeader}>
        <ThemedText style={styles.sectionTitle}>Recent</ThemedText>
      </View>
      <FlatList
        accessibilityRole="list"
        contentContainerStyle={[styles.recentList, recentPlaces.length === 0 && styles.emptyList]}
        data={recentPlaces}
        ItemSeparatorComponent={() => <View style={styles.recentSeparator} />}
        keyExtractor={(place) => place.id}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator accessibilityLabel="Loading recent places" color={themePrimary} />
          ) : (
            <ThemedText style={styles.emptyCopy}>Places you open from Search will appear here.</ThemedText>
          )
        }
        renderItem={({ item }) => (
          <SearchPlaceItem
            onDelete={onDeletePlace}
            onPress={onOpenPlace}
            place={item}
          />
        )}
        showsVerticalScrollIndicator={false}
      />
    </>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    width: '100%',
    padding: 10,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  sectionTitle: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 20,
  },
  recentList: {
    padding: 10,
    paddingBottom: 36,
  },
  recentSeparator: {
    height: 10,
  },
  emptyList: {
    flexGrow: 1,
  },
  emptyCopy: {
    color: '#637068',
    fontSize: 13,
    lineHeight: 19,
  },
});
