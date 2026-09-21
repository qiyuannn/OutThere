import MapView, { Marker } from 'react-native-maps';
import { StyleSheet, View } from 'react-native';

import type { SearchPlace } from './model';

export function SearchResultsMap({ center, onSelect, places }: {
  center: { latitude: number; longitude: number };
  onSelect: (place: SearchPlace) => void;
  places: SearchPlace[];
}) {
  const visible = places.filter((place) => typeof place.latitude === 'number' && typeof place.longitude === 'number');
  return <View style={styles.frame}>
    <MapView style={StyleSheet.absoluteFill} initialRegion={{ ...center, latitudeDelta: 0.11, longitudeDelta: 0.11 }}>
      {visible.map((place) => <Marker key={place.id} coordinate={{ latitude: place.latitude!, longitude: place.longitude! }}
        title={place.name} description={place.category ?? place.address ?? undefined} onCalloutPress={() => onSelect(place)} />)}
    </MapView>
  </View>;
}

const styles = StyleSheet.create({ frame: { flex: 1, minHeight: 360, borderRadius: 26, overflow: 'hidden', backgroundColor: '#E9EBED' } });
