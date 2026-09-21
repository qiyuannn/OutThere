import { Image } from 'expo-image';
import { Pressable, Share, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { computeIsOpenNow } from '@/lib/opening-hours';
import type { PlaceDetails } from '../types';

const shareIcon = require('../../../../assets/images/place-details/share.svg');

function priceLabel(level: string | null | undefined): string | null {
  const labels: Record<string, string> = {
    PRICE_LEVEL_FREE: 'Free',
    PRICE_LEVEL_INEXPENSIVE: '$',
    PRICE_LEVEL_MODERATE: '$$',
    PRICE_LEVEL_EXPENSIVE: '$$$',
    PRICE_LEVEL_VERY_EXPENSIVE: '$$$$',
  };
  return level ? labels[level] ?? null : null;
}

export function PlaceHeader({ place }: { place: PlaceDetails }) {
  const price = priceLabel(place.priceLevel);
  const categoryLine = [price, place.category].filter(Boolean).join(' ');
  const isOpen = place.liveDetails ? place.openNow : place.openNow ?? computeIsOpenNow(place.regularOpeningHours);

  const share = async () => {
    await Share.share({
      title: place.name,
      message: [place.name, place.address, place.mapsUrl].filter(Boolean).join('\n'),
      url: place.mapsUrl ?? place.websiteUri ?? undefined,
    }).catch(() => undefined);
  };

  return (
    <View style={styles.container}>
      <View style={styles.details}>
        <ThemedText accessibilityRole="header" numberOfLines={1} style={styles.name}>{place.name}</ThemedText>
        {categoryLine ? <ThemedText numberOfLines={1} style={styles.meta}>{categoryLine}</ThemedText> : null}
        {place.address ? <ThemedText numberOfLines={1} style={styles.meta}>{place.address}</ThemedText> : null}
        {isOpen !== null && isOpen !== undefined ? (
          <ThemedText style={styles.meta}>{isOpen ? 'Open Now' : 'Closed Now'}</ThemedText>
        ) : null}
      </View>
      <Pressable
        accessibilityLabel={`Share ${place.name}`}
        accessibilityRole="button"
        hitSlop={8}
        onPress={() => void share()}
        style={({ pressed }) => [styles.shareButton, pressed && styles.pressed]}
      >
        <Image source={shareIcon} contentFit="contain" style={styles.shareIcon} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', minHeight: 82, flexDirection: 'row', alignItems: 'flex-start', gap: 14, overflow: 'hidden' },
  details: { flex: 1, minWidth: 0, alignItems: 'flex-start', gap: 3, overflow: 'hidden' },
  name: { color: '#000000', fontSize: 28, fontWeight: '800', lineHeight: 34, letterSpacing: -0.55 },
  meta: { color: '#637068', fontSize: 13, fontWeight: '400', lineHeight: 18 },
  shareButton: { width: 48, height: 48, borderRadius: 24, flexShrink: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F4F6' },
  shareIcon: { width: 24, height: 24 },
  pressed: { opacity: 0.5 },
});
