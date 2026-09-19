import { createElement } from 'react';
import { StyleSheet, View } from 'react-native';

type PlaceMapProps = {
  latitude: number;
  longitude: number;
  name: string;
};

export function PlaceMap({ latitude, longitude, name }: PlaceMapProps) {
  const delta = 0.008;
  const bbox = [longitude - delta, latitude - delta, longitude + delta, latitude + delta].join('%2C');
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitude}%2C${longitude}`;

  return (
    <View pointerEvents="none" style={styles.container}>
      {createElement('iframe', {
        'aria-label': `Map showing ${name}`,
        loading: 'lazy',
        src,
        style: { border: 0, display: 'block', height: '100%', width: '100%' },
        title: `Map showing ${name}`,
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', height: 232, overflow: 'hidden', backgroundColor: '#D9D9D9' },
});
