import { useState } from 'react';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { priceLabel, type SearchPlace } from './model';

type SearchResultItemProps = {
  place: SearchPlace;
  onPress: (place: SearchPlace) => void;
};

export function SearchResultItem({ place, onPress }: SearchResultItemProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const categoryLine = [place.priceLevel ? priceLabel(place.priceLevel) : null, place.category]
    .filter(Boolean)
    .join(' ');
  const opening = place.openNow === true ? 'Open Now' : place.openNow === false ? 'Closed Now' : null;

  return (
    <Pressable
      accessibilityLabel={`${place.name}${place.category ? `, ${place.category}` : ''}`}
      accessibilityRole="button"
      accessibilityHint="Opens place details"
      onPress={() => onPress(place)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {place.photoUrl && !imageFailed ? (
        <Image
          accessibilityLabel=""
          cachePolicy="none"
          contentFit="cover"
          onError={() => setImageFailed(true)}
          source={place.photoUrl}
          style={styles.image}
        />
      ) : <View accessibilityElementsHidden style={styles.placeholder} />}

      <View style={styles.details}>
        <ThemedText numberOfLines={1} style={styles.name}>{place.name}</ThemedText>
        {categoryLine ? <ThemedText numberOfLines={1} style={styles.meta}>{categoryLine}</ThemedText> : null}
        {place.address ? <ThemedText numberOfLines={1} style={styles.meta}>{place.address}</ThemedText> : null}
        {opening ? <ThemedText numberOfLines={1} style={styles.meta}>{opening}</ThemedText> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { width: '100%', minHeight: 104, flexDirection: 'row', alignItems: 'center', gap: 14, overflow: 'hidden', borderRadius: 22, padding: 8, backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.08)' },
  pressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },
  image: { width: 88, height: 88, borderRadius: 17, flexShrink: 0, backgroundColor: '#F3F4F6' },
  placeholder: { width: 88, height: 88, borderRadius: 17, flexShrink: 0, backgroundColor: '#E9EBED' },
  details: { flex: 1, minWidth: 0, alignItems: 'flex-start', justifyContent: 'center', gap: 3, overflow: 'hidden' },
  name: { color: '#000000', fontSize: 17, fontWeight: '700', lineHeight: 22 },
  meta: { color: '#637068', fontSize: 13, fontWeight: '400', lineHeight: 18 },
});
