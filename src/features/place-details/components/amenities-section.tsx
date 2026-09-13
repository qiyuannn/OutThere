import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import type { PlaceDetails } from '../types';

interface AmenitiesSectionProps {
  place: PlaceDetails;
}

const AMENITY_CONFIG: Record<string, { label: string; icon: string }> = {
  outdoorSeating: { label: 'Outdoor Seating', icon: '☀️' },
  reservable: { label: 'Reservable', icon: '📅' },
  dineIn: { label: 'Dine-in', icon: '🍽️' },
  takeout: { label: 'Takeout', icon: '🛍️' },
  delivery: { label: 'Delivery', icon: '🛵' },
  servesVegetarianFood: { label: 'Vegetarian Options', icon: '🥗' },
  servesBeer: { label: 'Serves Beer', icon: '🍺' },
  servesWine: { label: 'Serves Wine', icon: '🍷' },
  goodForChildren: { label: 'Good for Kids', icon: '👶' },
  goodForGroups: { label: 'Good for Groups', icon: '👥' },
  freeParking: { label: 'Free Parking', icon: '🚗' },
  restroom: { label: 'Restroom Available', icon: '🚻' },
};

export function AmenitiesSection({ place }: AmenitiesSectionProps) {
  const theme = useTheme();

  if (!place.amenities) return null;

  const activeAmenities = Object.entries(place.amenities)
    .filter(([_, isTrue]) => !!isTrue)
    .map(([key]) => AMENITY_CONFIG[key])
    .filter(Boolean);

  if (activeAmenities.length === 0) return null;

  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <View style={styles.titleRow}>
        <ThemedText style={styles.sectionIcon}>✨</ThemedText>
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.eyebrow}>
          HIGHLIGHTS & AMENITIES
        </ThemedText>
      </View>

      <View style={styles.chipsContainer}>
        {activeAmenities.map((item, idx) => (
          <View
            key={idx}
            style={[
              styles.chip,
              { backgroundColor: theme.backgroundSelected, borderColor: theme.border },
            ]}
          >
            <ThemedText style={styles.chipIcon}>{item.icon}</ThemedText>
            <ThemedText type="small" style={styles.chipText}>
              {item.label}
            </ThemedText>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    gap: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionIcon: {
    fontSize: 14,
  },
  eyebrow: {
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 1.2,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chipIcon: {
    fontSize: 13,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
  },
});
