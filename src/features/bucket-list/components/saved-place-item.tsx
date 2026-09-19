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
  place: SavedPlace;
  userRating?: number;
  onPress: (place: SavedPlace) => void;
  onRate: (place: SavedPlace) => void;
};

export function SavedPlaceItem({ place, userRating, onPress, onRate }: SavedPlaceItemProps) {
  const name = place.display_name ?? (place.mode === 'food' ? 'Saved Food Spot' : 'Saved Activity');
  const category = place.category ?? (place.mode === 'food' ? 'Food' : 'Activity');
  const categoryLine = [priceLabel(place.price_level), category].filter(Boolean).join(' ');
  const opening = openingLabel(place.open_now);
  const ratingTier = userRating === undefined ? null : getScoreTier(userRating);

  const handleRate = (event: GestureResponderEvent) => {
    event.stopPropagation();
    onRate(place);
  };

  return (
    <Pressable
      accessibilityLabel={`${name}, ${category}${userRating === undefined ? ', unrated' : `, rated ${userRating.toFixed(1)}`}`}
      accessibilityRole="button"
      onPress={() => onPress(place)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.details}>
        <ThemedText numberOfLines={1} style={styles.name}>{name}</ThemedText>
        {categoryLine ? <ThemedText numberOfLines={1} style={styles.meta}>{categoryLine}</ThemedText> : null}
        {place.location ? <ThemedText numberOfLines={1} style={styles.meta}>{place.location}</ThemedText> : null}
        {opening ? <ThemedText numberOfLines={1} style={styles.meta}>{opening}</ThemedText> : null}
      </View>

      <View style={styles.actionSlot}>
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
  row: { width: '100%', minHeight: 60, flexDirection: 'row', alignItems: 'flex-start', gap: 11, overflow: 'hidden' },
  pressed: { opacity: 0.65 },
  details: { flex: 1, minWidth: 0, alignItems: 'flex-start', overflow: 'hidden' },
  name: { color: '#000000', fontSize: 16, fontWeight: '600', lineHeight: 15, letterSpacing: 0.25 },
  meta: { color: '#000000', fontSize: 10, fontWeight: '300', lineHeight: 15, letterSpacing: 0.25 },
  actionSlot: { width: 60, height: 60, flexShrink: 0, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  ratingBadge: { minWidth: 45, height: 30, paddingHorizontal: 10, borderWidth: 1, borderRadius: 100, alignItems: 'center', justifyContent: 'center' },
  ratingLabel: { color: '#000000', fontSize: 12, fontWeight: '400', lineHeight: 15 },
  rateButton: { minWidth: 52, height: 30, paddingHorizontal: 10, borderWidth: 1, borderColor: '#3157D5', borderRadius: 100, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  rateLabel: { color: '#3157D5', fontSize: 12, fontWeight: '600', lineHeight: 15 },
  actionPressed: { opacity: 0.55 },
});
