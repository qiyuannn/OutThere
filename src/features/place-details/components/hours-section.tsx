import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import type { PlaceDetails } from '../types';

export function HoursSection({ place }: { place: PlaceDetails }) {
  const hours = place.regularOpeningHours;
  if (!hours?.length) return null;

  return (
    <View style={styles.section}>
      <ThemedText style={styles.title}>Opening Hours</ThemedText>
      <View style={styles.list}>
        {hours.map((line, index) => {
          const separator = line.indexOf(':');
          const day = separator >= 0 ? line.slice(0, separator) : line;
          const time = separator >= 0 ? line.slice(separator + 1).trim() : '';
          return (
            <View key={`${line}-${index}`} style={styles.row}>
              <ThemedText style={styles.day}>{day}</ThemedText>
              <ThemedText style={styles.time}>{time}</ThemedText>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { width: '100%', gap: 10, padding: 10, overflow: 'hidden' },
  title: { width: '100%', color: '#000000', fontSize: 16, fontWeight: '600', lineHeight: 20, letterSpacing: 0.25 },
  list: { width: '100%', gap: 4, padding: 10 },
  row: { width: '100%', flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  day: { width: 66, flexShrink: 0, color: '#000000', fontSize: 10, fontWeight: '300', lineHeight: 15 },
  time: { flex: 1, color: '#000000', fontSize: 10, fontWeight: '300', lineHeight: 15 },
});
