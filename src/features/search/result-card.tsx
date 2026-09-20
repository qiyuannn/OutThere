import { useState } from 'react';
import { Image } from 'expo-image';
import { Alert, Linking, Pressable, View } from 'react-native';
import { Card } from '@/components/foundation';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { Chip, searchStyles } from './controls';
import { priceLabel, type SearchPlace } from './model';

export function GoogleAttribution({ attributions = [], providersOnly = false }: { attributions?: { provider?: string; providerUri?: string }[]; providersOnly?: boolean }) {
  const theme = useTheme();
  return <View style={searchStyles.row}>
    {!providersOnly && <ThemedText style={{ fontSize: 12, fontWeight: '400', letterSpacing: 0, color: theme.textSecondary }}>Google Maps</ThemedText>}
    {attributions.map((a, i) => <Pressable key={i} accessibilityRole="link" disabled={!a.providerUri} onPress={() => a.providerUri && void Linking.openURL(a.providerUri).catch(() => {})}><ThemedText type="small">{a.provider}</ThemedText></Pressable>)}
  </View>;
}
export function ResultCard({ place, saved, saving, onOpen, onSave }: { place: SearchPlace; saved: boolean; saving: boolean; onOpen: () => void; onSave: () => Promise<void> }) {
  const [imageFailed, setImageFailed] = useState(false);
  const theme = useTheme();
  return <Card>
    <Pressable accessibilityRole="button" accessibilityHint="Opens place details" onPress={onOpen} style={{ gap: 10 }}>
      {place.photoUrl && !imageFailed ? <Image source={place.photoUrl} contentFit="cover" cachePolicy="none" style={{ height: 170, width: '100%', borderRadius: 16 }} accessibilityLabel={place.name} onError={() => setImageFailed(true)} /> :
        <View style={{ height: 100, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.backgroundSelected }}><ThemedText themeColor="textSecondary">{place.category ?? 'Explore this place'}</ThemedText></View>}
      <ThemedText type="subtitle">{place.name}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">{place.category} · {place.distanceMeters == null ? 'Distance unavailable' : place.distanceMeters < 1000 ? `${place.distanceMeters} m away` : `${(place.distanceMeters / 1000).toFixed(1)} km away`}</ThemedText>
      <ThemedText type="small">{place.rating == null ? 'Not yet rated' : `★ ${place.rating.toFixed(1)} (${place.ratingCount ?? 0})`} · {priceLabel(place.priceLevel)}</ThemedText>
      <ThemedText type="small" themeColor={place.openNow ? 'primary' : 'textSecondary'}>{place.openNow === true ? 'Open now' : place.openNow === false ? 'Closed now' : 'Opening hours unavailable'}</ThemedText>
      <ThemedText type="small" numberOfLines={2} themeColor="textSecondary">{place.address}</ThemedText>
    </Pressable>
    <GoogleAttribution attributions={place.attributions} />
    <View style={searchStyles.row}><Chip label="View details & rate" onPress={onOpen} /><Chip label={saving ? 'Saving…' : saved ? 'Saved · remove' : 'Save place'} selected={saved} disabled={saving} onPress={() => void onSave().catch(e => Alert.alert('Could not update saved places', e instanceof Error ? e.message : 'Try again.'))} /></View>
  </Card>;
}
