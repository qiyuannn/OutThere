import { useState } from 'react';
import { router, type Href } from 'expo-router';
import { ActivityIndicator, FlatList, Keyboard, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/app-header';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers/auth-provider';
import { AreaSheet } from './area-sheet';
import { FilterSheet } from './filter-sheet';
import {
  DEFAULT_FILTERS,
  type ProfileSearchResult,
  type SearchArea,
  type SearchFilters,
  type SearchPlace,
  type SearchScope,
} from './model';
import { PlaceSuggestions } from './place-suggestions';
import { ProfileSuggestions } from './profile-suggestions';
import { SearchControls } from './search-controls';
import { SearchPlaceItem } from './search-place-item';
import { usePlaceSearch } from './use-search';

export function SearchScreen() {
  const theme = useTheme();
  const { session } = useAuth();
  const search = usePlaceSearch();
  const [query, setQuery] = useState('');
  const [searchScope, setSearchScope] = useState<SearchScope>('places');
  const [area, setArea] = useState<SearchArea | null>(null);
  const [filters, setFilters] = useState<SearchFilters>({ ...DEFAULT_FILTERS });
  const [sheet, setSheet] = useState<'area' | 'filters' | null>(null);
  const [pendingSubmit, setPendingSubmit] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  function submit(q = query, nextFilters = filters, nextArea = area) {
    if (searchScope === 'profiles') {
      Keyboard.dismiss();
      return;
    }
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
    setFilters(nextFilters);
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

  const selectProfile = (item: ProfileSearchResult) => {
    setShowSuggestions(false);
    Keyboard.dismiss();
    if (session?.user?.id && item.user_id === session.user.id) {
      router.push('/profile' as Href);
    } else {
      router.push({
        pathname: '/search/profile/[id]',
        params: { id: item.user_id },
      } as unknown as Href);
    }
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
          searchScope={searchScope}
        />

        {searchScope === 'profiles' ? (
          inputEmpty ? (
            <View style={styles.emptyProfilesPrompt}>
              <ThemedText style={styles.emptyProfilesTitle}>Search Profiles</ThemedText>
              <ThemedText style={styles.emptyProfilesCopy}>
                Search for friends and other members by name or @username.
              </ThemedText>
              <Pressable
                accessibilityRole="button"
                onPress={() => setSearchScope('places')}
                style={({ pressed }) => [styles.switchBackOutline, pressed && styles.pressed]}
              >
                <ThemedText style={styles.switchBackText}>Switch to Places Search</ThemedText>
              </Pressable>
            </View>
          ) : (
            <ProfileSuggestions
              query={query}
              onSelect={selectProfile}
              onSwitchToPlaces={() => setSearchScope('places')}
            />
          )
        ) : autocompleteVisible ? (
          <View style={styles.suggestionsContainer}>
            <Pressable
              accessibilityLabel={`Search for profile ${query.trim()}`}
              accessibilityRole="button"
              onPress={() => {
                setSearchScope('profiles');
                setShowSuggestions(true);
              }}
              style={({ pressed }) => [styles.profileSearchBanner, pressed && styles.pressedBanner]}
            >
              <View style={styles.profileSearchIconSlot}>
                <ThemedText style={styles.profileSearchIcon}>👤</ThemedText>
              </View>
              <View style={styles.profileSearchTextSlot}>
                <ThemedText style={styles.profileSearchTitle}>Search for profile</ThemedText>
                <ThemedText numberOfLines={1} style={styles.profileSearchSubtitle}>
                  Search profiles matching “{query.trim()}”
                </ThemedText>
              </View>
              <ThemedText style={styles.profileSearchArrow}>›</ThemedText>
            </Pressable>

            <PlaceSuggestions query={query} center={area ?? undefined} onSelect={selectSuggestion} />
          </View>
        ) : inputEmpty ? (
          <>
            <View style={styles.sectionHeader}>
              <ThemedText style={styles.sectionTitle}>Recent</ThemedText>
            </View>
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
                  ? <ActivityIndicator color={theme.primary} accessibilityLabel="Loading recent places" />
                  : <ThemedText style={styles.emptyCopy}>Places you open from Search will appear here.</ThemedText>
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
      {sheet === 'filters' ? <FilterSheet filters={filters} onApply={apply} onClose={() => setSheet(null)} /> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, overflow: 'hidden' },
  content: { flex: 1, width: '100%', maxWidth: 402, alignSelf: 'center', padding: 10, gap: 10, overflow: 'hidden' },
  sectionHeader: { width: '100%', padding: 10, justifyContent: 'center', overflow: 'hidden' },
  sectionTitle: { color: '#000000', fontSize: 16, fontWeight: '600', lineHeight: 20 },
  recentList: { padding: 10, paddingBottom: 36 },
  recentSeparator: { height: 10 },
  emptyList: { flexGrow: 1 },
  emptyCopy: { color: '#637068', fontSize: 13, lineHeight: 19 },
  suggestionsContainer: { flex: 1, minHeight: 0 },
  profileSearchBanner: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderRadius: 14,
    backgroundColor: '#F3F6F1',
    borderWidth: 1,
    borderColor: '#DFE5D9',
    gap: 10,
  },
  pressedBanner: {
    opacity: 0.7,
  },
  profileSearchIconSlot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DFE5D9',
  },
  profileSearchIcon: {
    fontSize: 15,
  },
  profileSearchTextSlot: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  profileSearchTitle: {
    color: '#14221D',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
  },
  profileSearchSubtitle: {
    color: '#637068',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 15,
  },
  profileSearchArrow: {
    color: '#637068',
    fontSize: 18,
    fontWeight: '400',
    paddingRight: 4,
  },
  emptyProfilesPrompt: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  emptyProfilesTitle: {
    color: '#14221D',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyProfilesCopy: {
    color: '#637068',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  switchBackOutline: {
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#DFE5D9',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  switchBackText: {
    color: '#14221D',
    fontSize: 13,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.6,
  },
});
