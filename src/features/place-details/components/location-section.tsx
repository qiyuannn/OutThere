import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import type { PlaceDetails } from '../types';
import { PlaceMap } from './place-map';

interface LocationSectionProps {
  place: PlaceDetails;
}

export function LocationSection({ place }: LocationSectionProps) {
  const hasCoordinates = Number.isFinite(place.latitude) && Number.isFinite(place.longitude);

  if (!place.address && !hasCoordinates) return null;

  const openMaps = () => {
    if (place.mapsUrl) {
      void Linking.openURL(place.mapsUrl);
      return;
    }

    const query = hasCoordinates
      ? `${place.latitude},${place.longitude}`
      : `${place.name} ${place.address ?? ''}`;
    void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`);
  };

  return (
    <View style={styles.section}>
      <ThemedText style={styles.title}>Location</ThemedText>
      {hasCoordinates ? (
        <Pressable
          accessibilityLabel={`Open ${place.name} in Google Maps`}
          accessibilityRole="link"
          onPress={openMaps}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <PlaceMap latitude={place.latitude!} longitude={place.longitude!} name={place.name} />
        </Pressable>
      ) : (
        <Pressable accessibilityRole="link" onPress={openMaps} style={styles.placeholder}>
          <ThemedText style={styles.address}>{place.address}</ThemedText>
          <ThemedText style={styles.openLabel}>Open in Maps</ThemedText>
        </Pressable>
      )}
      {place.address ? <ThemedText style={styles.address}>{place.address}</ThemedText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { width: '100%', gap: 10, padding: 10, overflow: 'hidden' },
  title: { color: '#000000', fontSize: 16, fontWeight: '600', lineHeight: 20, letterSpacing: 0.25 },
  placeholder: { width: '100%', height: 232, padding: 20, alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#D9D9D9' },
  address: { color: '#000000', fontSize: 10, fontWeight: '300', lineHeight: 15, letterSpacing: 0.25 },
  openLabel: { color: '#000000', fontSize: 12, fontWeight: '600', lineHeight: 15 },
  pressed: { opacity: 0.75 },
});
