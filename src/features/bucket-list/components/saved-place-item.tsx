import { Image } from 'expo-image';
import { Pressable, StyleSheet, View, type GestureResponderEvent } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { getScoreTier } from '@/features/rankings/comparison';
import type { SavedPlace } from '../types';

const priceLabels: Record<string, string> = {
  PRICE_LEVEL_FREE: 'Free',
  PRICE_LEVEL_INEXPENSIVE: '$',
  PRICE_LEVEL_MODERATE: '$$',
  PRICE_LEVEL_EXPENSIVE: '$$$',
  PRICE_LEVEL_VERY_EXPENSIVE: '$$$$',
};

function priceLabel(level: string | null) {
  return level ? priceLabels[level] ?? level : null;
}

function openingLabel(openNow: boolean | null) {
  if (openNow === null) return null;
  return openNow ? 'Open Now' : 'Closed Now';
}

type SavedPlaceItemProps = {
  grid?: boolean;
  place: SavedPlace;
  userRating?: number;
  onPress: (place: SavedPlace) => void;
  onRate: (place: SavedPlace) => void;
};

export function SavedPlaceItem({ grid = false, place, userRating, onPress, onRate }: SavedPlaceItemProps) {
  const name = place.display_name ?? (place.mode === 'food' ? 'Saved Food Spot' : 'Saved Activity');
  const category = place.category ?? (place.mode === 'food' ? 'Food' : 'Activity');
  const categoryLine = [priceLabel(place.price_level), category].filter(Boolean).join(' ');
  const opening = openingLabel(place.open_now);
  const ratingTier = userRating === undefined ? null : getScoreTier(userRating);
  const photoUrl = (place.places?.photos?.[0] as { url?: string } | undefined)?.url;

  const handleRate = (event: GestureResponderEvent) => {
    event.stopPropagation();
    onRate(place);
  };

  return (
    <Pressable
      accessibilityLabel={`${name}, ${category}${userRating === undefined ? ', unrated' : `, rated ${userRating.toFixed(1)}`}`}
      accessibilityRole="button"
      onPress={() => onPress(place)}
      style={({ pressed }) => [styles.row, grid && styles.gridCard, pressed && styles.pressed]}
    >
      {photoUrl ? <Image accessibilityLabel="" source={photoUrl} contentFit="cover" transition={160} style={[styles.photo, grid && styles.gridPhoto]} />
        : <View style={[styles.photoFallback, grid && styles.gridPhoto]}><ThemedText style={styles.photoMarker}>⌖</ThemedText></View>}
      <View style={[styles.details, grid && styles.gridDetails]}>
        <ThemedText numberOfLines={1} style={styles.name}>{name}</ThemedText>
        {categoryLine ? <ThemedText numberOfLines={1} style={styles.meta}>{categoryLine}</ThemedText> : null}
        {place.location ? <ThemedText numberOfLines={1} style={styles.meta}>{place.location}</ThemedText> : null}
        {opening ? <ThemedText numberOfLines={1} style={styles.meta}>{opening}</ThemedText> : null}
      </View>

      <View style={[styles.actionSlot, grid && styles.gridAction]}>
        <Pressable
          accessibilityLabel={userRating === undefined ? `Rate ${name}` : `Rated ${userRating.toFixed(1)}, tap to update`}
          accessibilityRole="button"
          hitSlop={8}
          onPress={handleRate}
          style={({ pressed }) => [
            userRating === undefined ? styles.rateButton : styles.ratingBadge,
            ratingTier ? { backgroundColor: ratingTier.backgroundColor, borderColor: ratingTier.color } : null,
            pressed && styles.actionPressed,
          ]}
        >
          <ThemedText style={[
            userRating === undefined ? styles.rateLabel : styles.ratingLabel,
            ratingTier ? { color: ratingTier.textColor } : null,
          ]}>
            {userRating === undefined ? 'Rate' : userRating.toFixed(1)}
          </ThemedText>
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { width: '100%', minHeight: 104, flexDirection: 'row', alignItems: 'center', gap: 13, overflow: 'hidden', borderRadius: 22, padding: 8, backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.08)' },
  pressed: { opacity: 0.68, transform: [{ scale: 0.985 }] },
  photo: { width: 88, height: 88, borderRadius: 17, flexShrink: 0, backgroundColor: '#F3F4F6' },
  photoFallback: { width: 88, height: 88, borderRadius: 17, flexShrink: 0, backgroundColor: '#E9EBED', alignItems: 'center', justifyContent: 'center' },
  photoMarker: { fontSize: 26, color: '#637068' },
  details: { flex: 1, minWidth: 0, alignItems: 'flex-start', justifyContent: 'center', gap: 3, overflow: 'hidden' },
  name: { color: '#000000', fontSize: 17, fontWeight: '700', lineHeight: 22 },
  meta: { color: '#637068', fontSize: 13, fontWeight: '400', lineHeight: 18 },
  actionSlot: { width: 54, height: 60, flexShrink: 0, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  ratingBadge: { minWidth: 45, height: 30, paddingHorizontal: 10, borderWidth: 1, borderRadius: 100, alignItems: 'center', justifyContent: 'center' },
  ratingLabel: { color: '#000000', fontSize: 12, fontWeight: '400', lineHeight: 15 },
  rateButton: { minWidth: 52, height: 34, paddingHorizontal: 10, borderRadius: 100, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center' },
  rateLabel: { color: '#FFFFFF', fontSize: 12, fontWeight: '700', lineHeight: 15 },
  actionPressed: { opacity: 0.55 },
  gridCard: { flex: 1, minHeight: 236, flexDirection: 'column', alignItems: 'stretch', padding: 7, gap: 9 },
  gridPhoto: { width: '100%', height: 132, borderRadius: 17 },
  gridDetails: { flex: 0, paddingHorizontal: 5, gap: 2 },
  gridAction: { position: 'absolute', right: 10, top: 104, width: 54, height: 54 },
});
