import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { suggestPlaces } from './service';
import { createSuggestionsController, type PlaceSuggestion, type SuggestionsState } from './suggestions-controller';
import { GoogleAttribution } from './result-card';

export function PlaceSuggestions({ query, center, onSelect }: {
  query: string; center?: { latitude: number; longitude: number }; onSelect: (place: PlaceSuggestion) => void;
}) {
  const theme = useTheme();
  const [state, setState] = useState<SuggestionsState>({ items: [], loading: false, error: null });
  const controller = useMemo(() => createSuggestionsController(suggestPlaces, setState), []);
  useEffect(() => {
    controller.update(query, center);
    return controller.cancel;
  }, [controller, query, center?.latitude, center?.longitude]);
  if (query.trim().length < 2) return null;
  return <View style={{ borderWidth: 1, borderColor: theme.border, borderRadius: 16, backgroundColor: theme.backgroundElement, padding: 14, gap: 8 }}>
    <ThemedText type="smallBold">Suggested places</ThemedText>
    <ThemedText type="small" themeColor="textSecondary">{center ? 'Names near your search area. Search filters apply to full results.' : 'Choose an area to prioritize nearby names.'}</ThemedText>
    {state.loading && <ActivityIndicator accessibilityLabel="Finding place suggestions" color={theme.primary} />}
    {state.error && <ThemedText type="small" accessibilityRole="alert">{state.error}</ThemedText>}
    {!state.loading && !state.error && !state.items.length && <ThemedText type="small">No names found. Try more letters or Search places.</ThemedText>}
    {state.items.map(place => <Pressable key={place.id} accessibilityRole="button" accessibilityLabel={`${place.name}, ${place.address}`} accessibilityHint="Opens this place’s details" onPress={() => { controller.cancel(); onSelect(place); }}
      style={({ pressed }) => ({ paddingVertical: 12, gap: 4, borderBottomWidth: 1, borderBottomColor: theme.border, opacity: pressed ? 0.6 : 1 })}>
      <ThemedText type="smallBold">{place.name}</ThemedText>
      {!!place.address && <ThemedText type="small" themeColor="textSecondary">{place.address}</ThemedText>}
    </Pressable>)}
    {!!state.items.length && <GoogleAttribution />}
  </View>;
}
