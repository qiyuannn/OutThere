import { useState } from 'react';
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import type { CandidatePlace } from '../types';

export function RatingPlaceSummary({ place }: { place: CandidatePlace }) {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <View style={styles.row}>
      {place.photo_url && !imageFailed ? (
        <Image
          accessible={false}
          cachePolicy="none"
          contentFit="cover"
          onError={() => setImageFailed(true)}
          source={place.photo_url}
          style={styles.image}
        />
      ) : <View accessibilityElementsHidden style={styles.placeholder} />}

      <View style={styles.details}>
        <ThemedText numberOfLines={1} style={styles.name}>{place.display_name}</ThemedText>
        {place.primary_type_display_name ? (
          <ThemedText numberOfLines={1} style={styles.meta}>{place.primary_type_display_name}</ThemedText>
        ) : null}
        {place.formatted_address ? (
          <ThemedText numberOfLines={1} style={styles.meta}>{place.formatted_address}</ThemedText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { width: '100%', minHeight: 60, flexDirection: 'row', alignItems: 'flex-start', gap: 11, overflow: 'hidden' },
  image: { width: 60, height: 60, flexShrink: 0, backgroundColor: '#DC2424' },
  placeholder: { width: 60, minHeight: 60, alignSelf: 'stretch', flexShrink: 0, backgroundColor: '#DC2424' },
  details: { flex: 1, minWidth: 0, alignItems: 'flex-start', overflow: 'hidden' },
  name: { color: '#000000', fontSize: 16, fontWeight: '600', lineHeight: 15, letterSpacing: 0.25 },
  meta: { color: '#000000', fontSize: 10, fontWeight: '300', lineHeight: 15, letterSpacing: 0.25 },
});
