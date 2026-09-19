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
  const isOpen = place.openNow ?? computeIsOpenNow(place.regularOpeningHours);
  const categoryLine = [place.category, priceLabel(place.priceLevel)].filter(Boolean).join('  ·  ');
  const locationLine = [place.address, distanceLabel(place.distanceMeters)].filter(Boolean).join('  ·  ');
  const ratingLine = [
    place.rating ? `★ ${place.rating.toFixed(1)}` : null,
    isOpen === true ? 'Open now' : isOpen === false ? 'Closed now' : null,
    place.ratingCount ? `${place.ratingCount.toLocaleString()} ratings` : null,
  ].filter(Boolean).join('   ·   ');

  return <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
    <View style={[styles.imageFrame, { backgroundColor: theme.backgroundSelected }]}>
      {place.photoUrl && !imageFailed ? <Image source={{ uri: place.photoUrl }} accessibilityLabel={`Photo of ${place.name}`} style={styles.image}
        contentFit="cover" transition={200} onError={() => setImageFailed(true)} />
        : <View style={styles.imageFallback}><ThemedText style={[styles.fallbackArrow, { color: theme.primary }]}>↗</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">A new place to discover</ThemedText></View>}
      {isOpen !== null && isOpen !== undefined ? <View style={[styles.openBadge, {
        backgroundColor: isOpen ? theme.accent : theme.backgroundElement,
      }]}>
        <View style={[styles.statusDot, { backgroundColor: isOpen ? theme.onAccent : theme.textSecondary }]} />
        <ThemedText style={[styles.openBadgeText, { color: isOpen ? theme.onAccent : theme.textSecondary }]}>
          {isOpen ? 'OPEN NOW' : 'CLOSED NOW'}
        </ThemedText>
      </View> : null}
      {place.photoAttribution ? <Pressable disabled={!place.photoAttribution.uri} accessibilityRole={place.photoAttribution.uri ? 'link' : undefined}
        onPress={() => place.photoAttribution?.uri && Linking.openURL(place.photoAttribution.uri)} style={styles.attributionBadge}>
        <ThemedText style={styles.attribution} numberOfLines={1}>Photo: {place.photoAttribution.displayName}</ThemedText>
      </Pressable> : null}
    </View>
    <View style={styles.body}>
      <ThemedText type="smallBold" themeColor="primary" style={styles.kicker}>PICKED FOR YOU · {place.matchPercent}% MATCH</ThemedText>
      <ThemedText accessibilityRole="header" numberOfLines={1} style={styles.placeName}>{place.name}</ThemedText>
      {categoryLine ? <ThemedText style={styles.category} numberOfLines={1}>{categoryLine}</ThemedText> : null}
      {locationLine ? <ThemedText style={styles.detail} themeColor="textSecondary" numberOfLines={1}>{locationLine}</ThemedText> : null}
      {ratingLine ? <ThemedText style={styles.detail} themeColor="textSecondary" numberOfLines={1}>{ratingLine}</ThemedText> : null}
      {place.mapsUrl ? <Pressable accessibilityRole="link" onPress={() => Linking.openURL(place.mapsUrl!)} style={({ pressed }) => [styles.detailsLink, pressed && styles.pressed]}>
        <ThemedText style={styles.detailsLinkText} themeColor="primary">View place details  ↗</ThemedText>
      </Pressable> : null}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  card: { flex: 1, minHeight: 0, borderWidth: 1, borderRadius: 28, padding: 12, overflow: 'hidden', shadowColor: '#14221D', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.13, shadowRadius: 14, elevation: 7 },
  imageFrame: { flex: 1, minHeight: 120, borderRadius: 20, overflow: 'hidden' }, image: { width: '100%', height: '100%' },
  imageFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 8 }, fallbackArrow: { fontSize: 48, lineHeight: 56 },
  openBadge: { position: 'absolute', top: 12, right: 12, height: 28, borderRadius: 14, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  statusDot: { width: 6, height: 6, borderRadius: 3 }, openBadgeText: { fontSize: 9, lineHeight: 14, letterSpacing: 0.7, fontWeight: '800' },
  attributionBadge: { position: 'absolute', left: 10, bottom: 8, maxWidth: '72%', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.82)' },
  attribution: { color: '#14221D', fontSize: 8, lineHeight: 10 },
  body: { flex: 0, minHeight: 185, paddingHorizontal: 6, paddingTop: 16, paddingBottom: 8, gap: 7 },
  kicker: { fontSize: 10, lineHeight: 15, letterSpacing: 0.8 },
  placeName: { fontSize: 26, lineHeight: 32, fontWeight: '800', letterSpacing: -0.5 },
  category: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  detail: { fontSize: 13, lineHeight: 19, fontWeight: '500' },
  detailsLink: { alignSelf: 'flex-start' },
  detailsLinkText: { fontSize: 13, lineHeight: 19, fontWeight: '600' },
  pressed: { opacity: 0.6 },
});
