import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import type { PlaceDetails } from '../types';

interface AttributionFooterProps {
  place: PlaceDetails;
}

export function AttributionFooter({ place }: AttributionFooterProps) {
  const attributions: Array<{ displayName: string; uri: string | null }> = [];

  if (place.photoAttribution?.displayName) {
    attributions.push({
      displayName: place.photoAttribution.displayName,
      uri: place.photoAttribution.uri,
    });
  }

  if (place.photos) {
    for (const photo of place.photos) {
      if (photo.authorAttributions) {
        for (const attr of photo.authorAttributions) {
          if (attr.displayName && !attributions.some((a) => a.displayName === attr.displayName)) {
            attributions.push({ displayName: attr.displayName, uri: attr.uri });
          }
        }
      }
    }
  }

  return (
    <View style={styles.container}>
      {attributions.length > 0 ? (
        <View style={styles.contributors}>
          <ThemedText style={styles.subtext} themeColor="textSecondary">
            Photos contributed by:
          </ThemedText>
          <View style={styles.contributorList}>
            {attributions.map((attr, idx) => (
              <Pressable
                key={idx}
                disabled={!attr.uri}
                onPress={() => attr.uri && Linking.openURL(attr.uri)}
                accessibilityRole={attr.uri ? 'link' : undefined}
              >
                <ThemedText
                  style={[styles.contributorName, attr.uri ? styles.link : undefined]}
                  themeColor={attr.uri ? 'primary' : 'textSecondary'}
                >
                  {attr.displayName}
                  {idx < attributions.length - 1 ? ' · ' : ''}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      <ThemedText style={styles.legalNotice} themeColor="textSecondary">
        Data and imagery powered by Google Maps Platform
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 16,
    alignItems: 'center',
    gap: 8,
  },
  contributors: {
    alignItems: 'center',
    gap: 4,
  },
  subtext: {
    fontSize: 11,
    lineHeight: 15,
  },
  contributorList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  contributorName: {
    fontSize: 11,
    lineHeight: 15,
  },
  link: {
    textDecorationLine: 'underline',
  },
  legalNotice: {
    fontSize: 10,
    lineHeight: 14,
    textAlign: 'center',
    opacity: 0.8,
  },
});
