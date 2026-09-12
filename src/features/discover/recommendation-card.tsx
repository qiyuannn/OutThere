import { useState } from 'react';
import { Image } from 'expo-image';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import type { DiscoverMode, Recommendation } from './types';

function distanceLabel(meters: number) {
  return meters < 1000 ? `${Math.max(50, Math.round(meters / 50) * 50)} m away` : `${(meters / 1000).toFixed(meters < 10000 ? 1 : 0)} km away`;
}

function priceLabel(level: string | null) {
  const levels: Record<string, string> = { PRICE_LEVEL_FREE: 'Free', PRICE_LEVEL_INEXPENSIVE: '$', PRICE_LEVEL_MODERATE: '$$', PRICE_LEVEL_EXPENSIVE: '$$$', PRICE_LEVEL_VERY_EXPENSIVE: '$$$$' };
  return level ? levels[level] ?? null : null;
}

export function RecommendationCard({ place, mode }: { place: Recommendation; mode: DiscoverMode }) {
  const theme = useTheme(); const [imageFailed, setImageFailed] = useState(false);
  const details = [priceLabel(place.priceLevel), place.category, distanceLabel(place.distanceMeters), place.openNow === true ? 'Open now' : place.openNow === false ? 'Closed now' : null].filter(Boolean).join(' · ');
  return <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
    <View style={[styles.imageFrame, { backgroundColor: theme.backgroundSelected }]}>
      {place.photoUrl && !imageFailed ? <Image source={{ uri: place.photoUrl }} accessibilityLabel={`Photo of ${place.name}`} style={styles.image}
        contentFit="cover" transition={200} onError={() => setImageFailed(true)} />
        : <View style={styles.imageFallback}><ThemedText style={[styles.fallbackArrow, { color: theme.primary }]}>↗</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">A new place to discover</ThemedText></View>}
      <View style={[styles.photoBadge, { backgroundColor: theme.accent }]}>
        <ThemedText style={[styles.photoBadgeText, { color: theme.onAccent }]}>↗  {mode === 'activities' ? 'A LITTLE ADVENTURE' : 'SOMETHING DELICIOUS'}</ThemedText>
      </View>
    </View>
    <View style={styles.body}>
      <ThemedText type="smallBold" themeColor="primary" style={styles.kicker}>PICKED FOR YOU · {place.matchPercent}% MATCH</ThemedText>
      <ThemedText accessibilityRole="header" style={styles.headline}>{place.headline}</ThemedText>
      <ThemedText style={styles.placeName}>{place.name}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">{details}</ThemedText>
      {place.rating ? <ThemedText type="small" themeColor="textSecondary">★ {place.rating.toFixed(1)}{place.ratingCount ? ` (${place.ratingCount.toLocaleString()} ratings)` : ''}</ThemedText> : null}
      <View style={[styles.reason, { borderTopColor: theme.border }]}><ThemedText type="small" themeColor="textSecondary">{place.reason}</ThemedText></View>
      {place.mapsUrl ? <Pressable accessibilityRole="link" onPress={() => Linking.openURL(place.mapsUrl!)} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, alignSelf: 'flex-start', paddingVertical: 4 })}>
        <ThemedText type="smallBold" themeColor="primary">View on Google Maps ↗</ThemedText>
      </Pressable> : null}
      {place.photoAttribution ? <Pressable disabled={!place.photoAttribution.uri} accessibilityRole={place.photoAttribution.uri ? 'link' : undefined}
        onPress={() => place.photoAttribution?.uri && Linking.openURL(place.photoAttribution.uri)}>
        <ThemedText style={styles.attribution} themeColor="textSecondary">Photo: {place.photoAttribution.displayName}</ThemedText>
      </Pressable> : null}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 28, padding: 12, overflow: 'hidden' }, imageFrame: { aspectRatio: 1.65, borderRadius: 20, overflow: 'hidden' }, image: { width: '100%', height: '100%' },
  imageFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 8 }, fallbackArrow: { fontSize: 48, lineHeight: 56 },
  photoBadge: { position: 'absolute', bottom: 12, left: 12, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 }, photoBadgeText: { fontSize: 9, lineHeight: 14, letterSpacing: 0.8, fontWeight: '800' },
  body: { paddingHorizontal: 6, paddingTop: 18, paddingBottom: 8, gap: 7 }, kicker: { fontSize: 10, lineHeight: 16, letterSpacing: 1 },
  headline: { fontSize: 27, lineHeight: 33, letterSpacing: -0.7, fontWeight: '800' }, placeName: { fontSize: 17, lineHeight: 24, fontWeight: '700' },
  reason: { borderTopWidth: 1, marginTop: 6, paddingTop: 11 }, attribution: { fontSize: 10, lineHeight: 14 },
});
