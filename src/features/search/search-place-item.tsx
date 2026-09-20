import { Image } from 'expo-image';
import { Pressable, StyleSheet, View, type GestureResponderEvent } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { priceLabel } from './model';

const deleteIcon = require('../../../assets/images/search/delete.svg');

export type SearchPlaceItemData = {
  id: string;
  name: string;
  category?: string | null;
  address?: string | null;
  priceLevel?: string | null;
  openNow?: boolean | null;
};

type SearchPlaceItemProps = {
  place: SearchPlaceItemData;
  onPress: (place: SearchPlaceItemData) => void;
  onDelete?: (place: SearchPlaceItemData) => void;
};

export function SearchPlaceItem({ place, onPress, onDelete }: SearchPlaceItemProps) {
  const categoryLine = [place.priceLevel ? priceLabel(place.priceLevel) : null, place.category]
    .filter(Boolean)
    .join(' ');
  const opening = place.openNow === true ? 'Open Now' : place.openNow === false ? 'Closed Now' : null;

  const handleDelete = (event: GestureResponderEvent) => {
    event.stopPropagation();
    onDelete?.(place);
  };

  return (
    <Pressable
      accessibilityLabel={`${place.name}${place.category ? `, ${place.category}` : ''}`}
      accessibilityRole="button"
      onPress={() => onPress(place)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.details}>
        <ThemedText numberOfLines={1} style={styles.name}>{place.name}</ThemedText>
        {categoryLine ? <ThemedText numberOfLines={1} style={styles.meta}>{categoryLine}</ThemedText> : null}
        {place.address ? <ThemedText numberOfLines={1} style={styles.meta}>{place.address}</ThemedText> : null}
        {opening ? <ThemedText numberOfLines={1} style={styles.meta}>{opening}</ThemedText> : null}
      </View>

      {onDelete ? (
        <View style={styles.actionSlot}>
          <Pressable
            accessibilityLabel={`Remove ${place.name} from recent places`}
            accessibilityRole="button"
            hitSlop={8}
            onPress={handleDelete}
            style={({ pressed }) => pressed && styles.deletePressed}
          >
            <Image source={deleteIcon} contentFit="contain" style={styles.deleteIcon} />
          </Pressable>
        </View>
      ) : null}
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
  deleteIcon: { width: 24, height: 24 },
  deletePressed: { opacity: 0.45 },
});
