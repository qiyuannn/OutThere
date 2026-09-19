import { useState } from 'react';
import { Image } from 'expo-image';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import type { PlaceDetails } from '../types';

interface PhotoCarouselProps {
  place: PlaceDetails;
}

export function PhotoCarousel({ place }: PhotoCarouselProps) {
  const theme = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const carouselWidth = Math.min(windowWidth, 402);
  const [activeIndex, setActiveIndex] = useState(0);
  const [failedIndices, setFailedIndices] = useState<Record<number, boolean>>({});

  // Compute carousel items
  const rawPhotos: Array<{ uri: string | null; source?: string | null; attribution?: { displayName: string | null; uri: string | null } | null }> = [];

  if (place.photos && place.photos.length > 0) {
    for (const photo of place.photos) {
      const uri = photo.url ?? null;
      const attribution = photo.authorAttributions?.[0] ?? null;
      if (uri) {
        rawPhotos.push({ uri, attribution, source: photo.googleMapsUri });
      }
    }
  }

  // Fallback to primary photoUrl if no items in rawPhotos
  if (rawPhotos.length === 0 && place.photoUrl) {
    rawPhotos.push({
      uri: place.photoUrl,
      attribution: place.photoAttribution ?? null,
    });
  }

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const slideSize = event.nativeEvent.layoutMeasurement.width;
    if (slideSize > 0) {
      const index = Math.round(event.nativeEvent.contentOffset.x / slideSize);
      if (index !== activeIndex && index >= 0 && index < rawPhotos.length) {
        setActiveIndex(index);
      }
    }
  };

  const handleImageError = (index: number) => {
    setFailedIndices((prev) => ({ ...prev, [index]: true }));
  };

  // If completely empty or all photos failed
  if (rawPhotos.length === 0) {
    const hasUnresolvedPhotos = place.photos?.some((p) => p.name && !p.url);
    return (
      <View style={[styles.fallbackContainer, { backgroundColor: theme.backgroundSelected, borderColor: theme.border }]}>
        {hasUnresolvedPhotos ? (
          <ActivityIndicator size="small" color={theme.primary} />
        ) : (
          <ThemedText style={[styles.fallbackIcon, { color: theme.primary }]}>✦</ThemedText>
        )}
        <ThemedText type="smallBold" themeColor="textSecondary">
          {hasUnresolvedPhotos ? 'Loading photos…' : (place.category ?? 'A special place to explore')}
        </ThemedText>
      </View>
    );
  }

  const currentAttribution = rawPhotos[activeIndex]?.attribution;

  return (
    <View style={styles.container}>
      <FlatList
        data={rawPhotos}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        keyExtractor={(_, index) => `photo-${index}`}
        renderItem={({ item, index }) => {
          const isFailed = failedIndices[index];
          return (
            <View style={[styles.slide, { width: carouselWidth, backgroundColor: theme.backgroundSelected }]}>
              {item.uri && !isFailed ? (
                <Image
                  source={{ uri: item.uri }}
                  accessibilityLabel={`Photo of ${place.name}`}
                  style={styles.image}
                  contentFit="cover"
                  cachePolicy={place.liveDetails ? 'none' : 'disk'}
                  transition={200}
                  onError={() => handleImageError(index)}
                />
              ) : (
                <View style={styles.fallbackSlide}>
                  <ThemedText style={[styles.fallbackIcon, { color: theme.primary }]}>✦</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Photo unavailable
                  </ThemedText>
                </View>
              )}
            </View>
          );
        }}
      />

      {/* Attribution Overlay */}
      {currentAttribution?.displayName ? (
        <View style={styles.attributionBadge}>
          <Pressable
            disabled={!currentAttribution.uri}
            onPress={() => currentAttribution.uri && Linking.openURL(currentAttribution.uri)}
            accessibilityRole={currentAttribution.uri ? 'link' : undefined}
          >
            <ThemedText style={styles.attributionText} numberOfLines={1}>
              Photo: {currentAttribution.displayName}
              {currentAttribution.uri ? ' ↗' : ''}
            </ThemedText>
          </Pressable>
        </View>
      ) : null}

      {/* Pagination Indicator */}
      {rawPhotos[activeIndex]?.source && <Pressable accessibilityRole="link" accessibilityLabel="View original photo on Google Maps"
        onPress={() => void Linking.openURL(rawPhotos[activeIndex].source!).catch(() => {})}
        style={[styles.paginationBadge, { bottom: 48 }]}><ThemedText style={styles.paginationText}>View photo on Google Maps ↗</ThemedText></Pressable>}
      {rawPhotos.length > 1 ? (
        <View style={styles.paginationBadge}>
          <ThemedText style={styles.paginationText}>
            {activeIndex + 1} / {rawPhotos.length}
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: 402,
    height: 227,
    alignSelf: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  slide: {
    height: 227,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  fallbackContainer: {
    width: '100%',
    maxWidth: 402,
    height: 227,
    alignSelf: 'center',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  fallbackSlide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  fallbackIcon: {
    fontSize: 42,
    lineHeight: 48,
  },
  attributionBadge: {
    position: 'absolute',
    bottom: 12,
    left: 14,
    maxWidth: '70%',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  attributionText: {
    fontSize: 10,
    lineHeight: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  paginationBadge: {
    position: 'absolute',
    bottom: 12,
    right: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
  },
  paginationText: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
});
