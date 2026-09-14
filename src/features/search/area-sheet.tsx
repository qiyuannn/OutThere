import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Button } from '@/components/foundation';
import { ThemedText } from '@/components/themed-text';
import { getRoundedDeviceLocation } from '@/features/discover/service';
import type { SearchArea } from './model';
import { searchAreas } from './service';
import { Chip, SearchInput, SearchSheet } from './controls';
import { GoogleAttribution } from './result-card';

export function AreaSheet({ onSelect, onClose }: { onSelect: (area: SearchArea) => void; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [areas, setAreas] = useState<SearchArea[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const version = useRef(0);
  useEffect(() => () => { version.current++; }, []);
  async function find(device = false) {
    const id = ++version.current;
    setLoading(true); setError(null); setAreas([]); setSearched(false);
    try {
      if (device) {
        const center = await getRoundedDeviceLocation();
        if (id === version.current) onSelect({ id: 'device', label: 'Current location', ...center });
      } else {
        const result = await searchAreas(query.trim());
        if (id === version.current) { setAreas(result); setSearched(true); }
      }
    } catch (e) { if (id === version.current) setError((e instanceof Error ? e.message : 'Could not find that area.') + (device ? ' You can search for an area below.' : '')); }
    finally { if (id === version.current) setLoading(false); }
  }
  return <SearchSheet title="Search area" onClose={onClose}>
    <Button label="Use current location" disabled={loading} onPress={() => void find(true)} />
    <ThemedText themeColor="textSecondary">Or choose a city, neighbourhood, address, or landmark to search around.</ThemedText>
    <SearchInput accessibilityLabel="City, neighbourhood, or landmark" placeholder="e.g. Tiong Bahru, Singapore" value={query} onChangeText={value => { version.current++; setLoading(false); setQuery(value); setAreas([]); setSearched(false); setError(null); }} returnKeyType="search" onSubmitEditing={() => { if (query.trim().length >= 2) void find(); }} />
    <Button label="Find area" disabled={loading || query.trim().length < 2} onPress={() => void find()} />
    {loading && <ActivityIndicator accessibilityLabel="Finding search area" />}
    {error && <ThemedText accessibilityRole="alert">{error}</ThemedText>}
    {areas.length > 0 && <GoogleAttribution />}
    {areas.map(area => <View key={area.id}><Chip label={area.label} onPress={() => onSelect(area)} /><GoogleAttribution attributions={area.attributions} providersOnly /></View>)}
    {searched && !areas.length && <ThemedText>No matching area. Include the city or country and try again.</ThemedText>}
  </SearchSheet>;
}
