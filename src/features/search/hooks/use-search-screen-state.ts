import { useState } from 'react';
import { Keyboard } from 'react-native';
import { router } from 'expo-router';

import { routes } from '@/lib/routes';
import { useAuth } from '@/providers/auth-provider';
import {
  DEFAULT_FILTERS,
  type ProfileSearchResult,
  type SearchArea,
  type SearchFilters,
  type SearchPlace,
  type SearchScope,
} from '../model';

export function useSearchScreenState() {
  const { session } = useAuth();
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
    router.push(
      routes.searchResults({
        query: q.trim(),
        latitude: nextArea.latitude,
        longitude: nextArea.longitude,
        filters: nextFilters,
      })
    );
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
    router.push(routes.placeDetails(place.id));
  };

  const selectProfile = (item: ProfileSearchResult) => {
    setShowSuggestions(false);
    Keyboard.dismiss();
    if (session?.user?.id && item.user_id === session.user.id) {
      router.push(routes.profile);
    } else {
      router.push(routes.userProfile(item.user_id));
    }
  };

  const openPlace = (place: Pick<SearchPlace, 'id'>) => {
    setShowSuggestions(false);
    Keyboard.dismiss();
    router.push(routes.placeDetails(place.id));
  };

  const inputEmpty = query.trim().length === 0;
  const autocompleteVisible = !sheet && !inputEmpty && showSuggestions;

  return {
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
  };
}
