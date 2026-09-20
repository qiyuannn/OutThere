import { useCallback, useRef } from 'react';
import MapView, { Marker, type LatLng } from 'react-native-maps';
import { StyleSheet, View } from 'react-native';

import type { VisitedPlace } from '../service';

type VisitedPlacesMapProps = { places: VisitedPlace[] };

const EMPTY_REGION = { latitude: 20, longitude: 0, latitudeDelta: 120, longitudeDelta: 120 };

function initialRegion(places: VisitedPlace[]) {
  if (!places.length) return EMPTY_REGION;
  const latitudes = places.map((place) => place.latitude);
  const longitudes = places.map((place) => place.longitude);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);
  return {
    latitude: (minLatitude + maxLatitude) / 2,
    longitude: (minLongitude + maxLongitude) / 2,
    latitudeDelta: Math.max((maxLatitude - minLatitude) * 1.35, 0.02),
    longitudeDelta: Math.max((maxLongitude - minLongitude) * 1.35, 0.02),
  };
}

export function VisitedPlacesMap({ places }: VisitedPlacesMapProps) {
  const map = useRef<MapView>(null);
  const coordinates: LatLng[] = places.map(({ latitude, longitude }) => ({ latitude, longitude }));
  const fitPins = useCallback(() => {
    if (!coordinates.length) return;
    map.current?.fitToCoordinates(coordinates, {
      animated: false,
      edgePadding: { top: 36, right: 36, bottom: 36, left: 36 },
    });
  }, [coordinates]);

  return (
    <View style={styles.container}>
      <MapView ref={map} initialRegion={initialRegion(places)} onMapReady={fitPins} onLayout={fitPins}
        pitchEnabled={false} rotateEnabled={false} style={styles.map}>
        {places.map((place) => (
          <Marker key={place.googlePlaceId}
            coordinate={{ latitude: place.latitude, longitude: place.longitude }}
            description={`${place.rating.toFixed(1)} / 10`} title={place.name} />
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', height: 330, overflow: 'hidden', backgroundColor: '#D9D9D9' },
  map: { width: '100%', height: '100%' },
});
