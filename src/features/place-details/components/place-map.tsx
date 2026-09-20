import MapView, { Marker } from 'react-native-maps';
import { StyleSheet, View } from 'react-native';

type PlaceMapProps = {
  latitude: number;
  longitude: number;
  name: string;
};

export function PlaceMap({ latitude, longitude, name }: PlaceMapProps) {
  const coordinate = { latitude, longitude };

  return (
    <View pointerEvents="none" style={styles.container}>
      <MapView
        initialRegion={{ ...coordinate, latitudeDelta: 0.012, longitudeDelta: 0.012 }}
        pitchEnabled={false}
        rotateEnabled={false}
        scrollEnabled={false}
        style={styles.map}
        zoomEnabled={false}
      >
        <Marker coordinate={coordinate} title={name} />
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', height: 232, overflow: 'hidden', backgroundColor: '#D9D9D9' },
  map: { width: '100%', height: '100%' },
});
