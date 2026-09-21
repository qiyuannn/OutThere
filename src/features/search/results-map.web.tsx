import { StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import type { SearchPlace } from './model';

export function SearchResultsMap({ places }: { center: { latitude: number; longitude: number }; onSelect: (place: SearchPlace) => void; places: SearchPlace[] }) {
  return <View style={styles.frame}><ThemedText style={styles.title}>Map view is available in the iOS and Android app.</ThemedText><ThemedText themeColor="textSecondary">{places.length} places in this search.</ThemedText></View>;
}
const styles = StyleSheet.create({ frame: { flex: 1, minHeight: 260, borderRadius: 26, padding: 24, alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#F3F4F6' }, title: { fontSize: 18, lineHeight: 24, fontWeight: '700', textAlign: 'center' } });
