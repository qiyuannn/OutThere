import { useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import type { PlaceDetails } from '../types';

interface LocationSectionProps {
  place: PlaceDetails;
}

export function LocationSection({ place }: LocationSectionProps) {
  const theme = useTheme();
  const [copied, setCopied] = useState(false);

  if (!place.address && place.latitude === null && place.longitude === null) {
    return null;
  }

  const handleCopy = async () => {
    if (!place.address) return;
    try {
      // In web / react-native fallback
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(place.address);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleOpenMaps = () => {
    if (place.mapsUrl) {
      Linking.openURL(place.mapsUrl);
    } else {
      const query = encodeURIComponent(`${place.name} ${place.address ?? ''}`);
      const url = Platform.select({
        ios: `maps:0,0?q=${query}`,
        android: `geo:0,0?q=${query}`,
        default: `https://www.google.com/maps/search/?api=1&query=${query}`,
      });
      Linking.openURL(url);
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <View style={styles.titleRow}>
        <ThemedText style={styles.sectionIcon}>📍</ThemedText>
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.eyebrow}>
          LOCATION & ACCESS
        </ThemedText>
      </View>

      {place.address ? (
        <ThemedText type="default" style={styles.addressText} selectable>
          {place.address}
        </ThemedText>
      ) : null}

      {place.latitude !== null && place.latitude !== undefined && place.longitude !== null && place.longitude !== undefined ? (
        <ThemedText type="code" themeColor="textSecondary">
          {place.latitude.toFixed(4)}° N, {place.longitude.toFixed(4)}° E
        </ThemedText>
      ) : null}

      <View style={[styles.actionsRow, { borderTopColor: theme.border }]}>
        {place.address ? (
          <Pressable accessibilityRole="button" onPress={handleCopy} style={styles.actionBtn}>
            <ThemedText type="smallBold" themeColor="primary">
              {copied ? '✓ Copied' : 'Copy Address'}
            </ThemedText>
          </Pressable>
        ) : null}

        {place.address && <View style={[styles.divider, { backgroundColor: theme.border }]} />}

        <Pressable accessibilityRole="button" onPress={handleOpenMaps} style={styles.actionBtn}>
          <ThemedText type="smallBold" themeColor="primary">
            Open in Maps ↗
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    gap: 10,
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
  addressText: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 10,
    marginTop: 2,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    width: 1,
    height: 16,
  },
});
