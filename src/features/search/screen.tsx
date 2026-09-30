import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/app-header';
import { useTheme } from '@/hooks/use-theme';
import { AreaSheet } from './area-sheet';
import { EmptyProfilesPrompt } from './components/empty-profiles-prompt';
import { ProfileSearchBanner } from './components/profile-search-banner';
import { RecentPlacesList } from './components/recent-places-list';
import { FilterSheet } from './filter-sheet';
import { useSearchScreenState } from './hooks/use-search-screen-state';
import { PlaceSuggestions } from './place-suggestions';
import { ProfileSuggestions } from './profile-suggestions';
import { SearchControls } from './search-controls';
import { usePlaceSearch } from './use-search';

export function SearchScreen() {
  const theme = useTheme();
  const search = usePlaceSearch();
  const {
    query,
    setQuery,
    searchScope,
    setSearchScope,
    area,
    setArea,
    filters,
    sheet,
    setSheet,
    pendingSubmit,
    setPendingSubmit,
    setShowSuggestions,
    activeFilterCount,
    inputEmpty,
    autocompleteVisible,
    submit,
    apply,
    openFilters,
    selectSuggestion,
    selectProfile,
    openPlace,
  } = useSearchScreenState();

  return (
    <SafeAreaView edges={['left', 'right']} style={[styles.screen, { backgroundColor: theme.backgroundElement }]}>
      <AppHeader description="Where To Go?" />
      <View style={styles.content}>
        <SearchControls
          activeFilterCount={activeFilterCount}
          onChangeText={(value) => {
            setQuery(value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          onOpenFilters={openFilters}
          onSubmitEditing={() => submit()}
          returnKeyType="search"
          searchScope={searchScope}
          value={query}
        />

        {searchScope === 'profiles' ? (
          inputEmpty ? (
            <EmptyProfilesPrompt onSwitchToPlaces={() => setSearchScope('places')} />
          ) : (
            <ProfileSuggestions
              onSelect={selectProfile}
              onSwitchToPlaces={() => setSearchScope('places')}
              query={query}
            />
          )
        ) : autocompleteVisible ? (
          <View style={styles.suggestionsContainer}>
            <ProfileSearchBanner
              onPress={() => {
                setSearchScope('profiles');
                setShowSuggestions(true);
              }}
              query={query}
            />
            <PlaceSuggestions center={area ?? undefined} onSelect={selectSuggestion} query={query} />
          </View>
        ) : inputEmpty ? (
          <RecentPlacesList
            loading={search.recentPlacesLoading}
            onDeletePlace={(place) => void search.removeRecentPlace(place.id)}
            onOpenPlace={openPlace}
            recentPlaces={search.recentPlaces}
            themePrimary={theme.primary}
          />
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
  suggestionsContainer: { flex: 1, minHeight: 0 },
});
