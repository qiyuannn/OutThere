import { useState } from 'react';
import { Image } from 'expo-image';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { computeIsOpenNow } from '@/lib/opening-hours';
import type { Recommendation } from './types';

function distanceLabel(meters: number) {
  return meters < 1000 ? `${Math.max(50, Math.round(meters / 50) * 50)} m away` : `${(meters / 1000).toFixed(meters < 10000 ? 1 : 0)} km away`;
}

function priceLabel(level: string | null) {
  const levels: Record<string, string> = { PRICE_LEVEL_FREE: 'Free', PRICE_LEVEL_INEXPENSIVE: '$', PRICE_LEVEL_MODERATE: '$$', PRICE_LEVEL_EXPENSIVE: '$$$', PRICE_LEVEL_VERY_EXPENSIVE: '$$$$' };
  return level ? levels[level] ?? null : null;
}

export function RecommendationCard({ place }: { place: Recommendation }) {
  const theme = useTheme(); const [imageFailed, setImageFailed] = useState(false);
  const details = [priceLabel(place.priceLevel), place.category, distanceLabel(place.distanceMeters)].filter(Boolean).join(' · ');
    const isOpen = place.openNow ?? computeIsOpenNow(place.regularOpeningHours);
    return <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
    <View style={[styles.imageFrame, { backgroundColor: theme.backgroundSelected }]}>
      {place.photoUrl && !imageFailed ? <Image source={{ uri: place.photoUrl }} accessibilityLabel={`Photo of ${place.name}`} style={styles.image}
        contentFit="cover" transition={200} onError={() => setImageFailed(true)} />
        : <View style={styles.imageFallback}><ThemedText style={[styles.fallbackArrow, { color: theme.primary }]}>↗</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">A new place to discover</ThemedText></View>}
      {isOpen !== null && isOpen !== undefined ? <View style={[styles.openBadge, {
        backgroundColor: isOpen ? theme.accent : theme.backgroundElement,
        borderColor: isOpen ? theme.accent : theme.border,
      }]}>
        <View style={[styles.statusDot, { backgroundColor: isOpen ? theme.onAccent : theme.textSecondary }]} />
        <ThemedText style={[styles.openBadgeText, { color: isOpen ? theme.onAccent : theme.textSecondary }]}>
          {isOpen ? 'OPEN NOW' : 'CLOSED NOW'}
        </ThemedText>
      </View> : null}
    </View>
    <View style={styles.body}>
      <ThemedText type="smallBold" themeColor="primary" style={styles.kicker}>PICKED FOR YOU · {place.matchPercent}% MATCH</ThemedText>
      <ThemedText accessibilityRole="header" numberOfLines={2} style={styles.placeName}>{place.name}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>{details}</ThemedText>
      {place.rating ? <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>★ {place.rating.toFixed(1)}{place.ratingCount ? ` (${place.ratingCount.toLocaleString()} ratings)` : ''}</ThemedText> : null}
      {place.mapsUrl ? <Pressable accessibilityRole="link" onPress={() => Linking.openURL(place.mapsUrl!)} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, alignSelf: 'flex-start', paddingVertical: 4 })}>
        <ThemedText type="smallBold" themeColor="primary">View on Google Maps ↗</ThemedText>
      </Pressable> : null}
      {place.photoAttribution ? <Pressable disabled={!place.photoAttribution.uri} accessibilityRole={place.photoAttribution.uri ? 'link' : undefined}
        onPress={() => place.photoAttribution?.uri && Linking.openURL(place.photoAttribution.uri)}>
        <ThemedText style={styles.attribution} themeColor="textSecondary" numberOfLines={1}>Photo: {place.photoAttribution.displayName}</ThemedText>
      </Pressable> : null}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  card: { flex: 1, minHeight: 0, borderWidth: 1, borderRadius: 28, padding: 12, overflow: 'hidden' },
  imageFrame: { flex: 1, minHeight: 120, borderRadius: 20, overflow: 'hidden' }, image: { width: '100%', height: '100%' },
  imageFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 8 }, fallbackArrow: { fontSize: 48, lineHeight: 56 },
  openBadge: { position: 'absolute', top: 12, right: 12, borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', gap: 5 },
  statusDot: { width: 6, height: 6, borderRadius: 3 }, openBadgeText: { fontSize: 9, lineHeight: 14, letterSpacing: 0.7, fontWeight: '800' },
  body: { paddingHorizontal: 6, paddingTop: 18, paddingBottom: 8, gap: 7 }, kicker: { fontSize: 10, lineHeight: 16, letterSpacing: 1 },
  placeName: { fontSize: 24, lineHeight: 30, fontWeight: '800', letterSpacing: -0.4 },
  attribution: { fontSize: 10, lineHeight: 14 },
});
