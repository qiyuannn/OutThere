import { createElement, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import type { VisitedPlace } from '../service';

type VisitedPlacesMapProps = { places: VisitedPlace[] };

function mapDocument(places: VisitedPlace[]) {
  const safePlaces = JSON.stringify(places).replaceAll('<', '\\u003c').replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029');
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>html,body,#map{height:100%;margin:0}body{background:#d9d9d9}.leaflet-container{font:12px system-ui,sans-serif}</style></head>
<body><div id="map"></div><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script>
const places=${safePlaces};
const map=L.map('map',{zoomControl:true});
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(map);
const bounds=[];
for(const place of places){const point=[place.latitude,place.longitude];bounds.push(point);L.marker(point).addTo(map).bindPopup('<strong>'+escapeHtml(place.name)+'</strong><br>'+place.rating.toFixed(1)+' / 10')}
if(bounds.length){map.fitBounds(bounds,{padding:[28,28],maxZoom:15})}else{map.setView([20,0],2)}
function escapeHtml(value){const node=document.createElement('div');node.textContent=value;return node.innerHTML}
</script></body></html>`;
}

export function VisitedPlacesMap({ places }: VisitedPlacesMapProps) {
  const srcDoc = useMemo(() => mapDocument(places), [places]);
  return (
    <View style={styles.container}>
      {createElement('iframe', {
        'aria-label': 'Map of places visited', loading: 'lazy', srcDoc,
        style: { border: 0, display: 'block', height: '100%', width: '100%' },
        title: 'Map of places visited',
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', height: 330, overflow: 'hidden', backgroundColor: '#D9D9D9' },
});
