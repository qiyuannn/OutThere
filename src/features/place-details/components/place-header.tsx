import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { computeIsOpenNow } from '@/lib/opening-hours';
import type { PlaceDetails } from '../types';

function distanceLabel(meters: number | null | undefined): string | null {
  if (meters === null || meters === undefined) return null;
  return meters < 1000
    ? `${Math.max(50, Math.round(meters / 50) * 50)} m away`
    : `${(meters / 1000).toFixed(meters < 10000 ? 1 : 0)} km away`;
}

function priceLabel(level: string | null | undefined): string | null {
  if (!level) return null;
  const levels: Record<string, string> = {
    PRICE_LEVEL_FREE: 'Free',
    PRICE_LEVEL_INEXPENSIVE: '$ · Inexpensive',
    PRICE_LEVEL_MODERATE: '$$ · Moderate',
    PRICE_LEVEL_EXPENSIVE: '$$$ · Expensive',
    PRICE_LEVEL_VERY_EXPENSIVE: '$$$$ · Very Expensive',
  };
  return levels[level] ?? null;
}

interface PlaceHeaderProps {
  place: PlaceDetails;
}

export function PlaceHeader({ place }: PlaceHeaderProps) {
  const theme = useTheme();
  const dist = distanceLabel(place.distanceMeters);
  const price = priceLabel(place.priceLevel);

  const kickerItems: string[] = [];
  if (place.matchPercent) kickerItems.push(`${place.matchPercent}% MATCH`);
  if (place.category) kickerItems.push(place.category.toUpperCase());

  return (
    <View style={styles.container}>
      {/* Kicker */}
      {kickerItems.length > 0 ? (
        <ThemedText type="smallBold" themeColor="primary" style={styles.kicker}>
          ✦ {kickerItems.join(' · ')}
        </ThemedText>
      ) : null}

      {/* Place Name */}
      <ThemedText accessibilityRole="header" style={styles.title}>
        {place.name}
      </ThemedText>

      {/* Badges Bar */}
      <View style={styles.badgesRow}>
        {/* Rating */}
        {place.rating ? (
          <View style={[styles.badge, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            <ThemedText style={styles.star}>★</ThemedText>
            <ThemedText type="smallBold">{place.rating.toFixed(1)}</ThemedText>
            {place.ratingCount ? (
              <ThemedText type="small" themeColor="textSecondary">
                ({place.ratingCount.toLocaleString()})
              </ThemedText>
            ) : null}
          </View>
        ) : null}

        {/* Price Tier */}
        {price ? (
          <View style={[styles.badge, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            <ThemedText type="small" themeColor="textSecondary">
              {price}
            </ThemedText>
          </View>
        ) : null}

        {/* Open / Closed Status */}
        {(() => {
          const isOpen = place.liveDetails ? place.openNow : place.openNow ?? computeIsOpenNow(place.regularOpeningHours);
          if (isOpen === null || isOpen === undefined) return null;
          return (
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: isOpen ? theme.accent : theme.backgroundElement,
                  borderColor: isOpen ? theme.accent : theme.border,
                },
              ]}
            >
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: isOpen ? theme.onAccent : theme.textSecondary },
                ]}
              />
              <ThemedText
                style={[
                  styles.openBadgeText,
                  { color: isOpen ? theme.onAccent : theme.textSecondary },
                ]}
              >
                {isOpen ? 'OPEN NOW' : 'CLOSED NOW'}
              </ThemedText>
            </View>
          );
        })()}

        {/* Distance */}
        {dist ? (
          <View style={[styles.badge, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            <ThemedText type="small" themeColor="textSecondary">
              ◎ {dist}
            </ThemedText>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  kicker: {
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 1.2,
  },
  title: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  badge: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  star: {
    fontSize: 14,
    color: '#E5A50A',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  openBadgeText: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
});
