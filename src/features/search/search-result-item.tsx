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
  row: { width: '100%', minHeight: 60, flexDirection: 'row', alignItems: 'flex-start', gap: 11, overflow: 'hidden' },
  pressed: { opacity: 0.65 },
  image: { width: 60, height: 60, flexShrink: 0, backgroundColor: '#DC2424' },
  placeholder: { width: 60, minHeight: 60, alignSelf: 'stretch', flexShrink: 0, backgroundColor: '#DC2424' },
  details: { flex: 1, minWidth: 0, alignItems: 'flex-start', overflow: 'hidden' },
  name: { color: '#000000', fontSize: 16, fontWeight: '600', lineHeight: 15, letterSpacing: 0.25 },
  meta: { color: '#000000', fontSize: 10, fontWeight: '300', lineHeight: 15, letterSpacing: 0.25 },
});
