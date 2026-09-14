import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ScoreBadge } from '@/features/rankings/components/score-badge';
import { useTheme } from '@/hooks/use-theme';
import type { PlaceDetails } from '../types';

interface ActionBarProps {
  place: PlaceDetails;
  isSaved?: boolean;
  onToggleSave?: (saved: boolean) => void | Promise<void>;
  userRating?: number | null;
  onRate?: () => void;
}

export function ActionBar({
  place,
  isSaved = false,
  onToggleSave,
  userRating,
  onRate,
}: ActionBarProps) {
  const theme = useTheme();
  const [saving, setSaving] = useState(false);

  const handleDirections = () => {
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

  const handleCall = () => {
    if (place.phoneNumber) {
      Linking.openURL(`tel:${place.phoneNumber.replace(/[^\d+]/g, '')}`);
    }
  };

  const handleWebsite = () => {
    if (place.websiteUri) {
      Linking.openURL(place.websiteUri);
    }
  };

  const handleShare = async () => {
    try {
      const message = [
        `Check out ${place.name} on OutThere!`,
        place.address ? `📍 ${place.address}` : null,
        place.mapsUrl ? `Map: ${place.mapsUrl}` : null,
      ]
        .filter(Boolean)
        .join('\n');

      await Share.share({
        title: place.name,
        message,
        url: place.mapsUrl ?? place.websiteUri ?? undefined,
      });
    } catch {
      // User cancelled or share dismissed
    }
  };

  const handleSaveToggle = async () => {
    if (!onToggleSave || saving) return;
    try {
      setSaving(true);
      await onToggleSave(!isSaved);
    } catch (error) {
      Alert.alert('Could not update saved places', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Primary Row: Directions & Save */}
      <View style={styles.primaryRow}>
        <Pressable
          accessibilityRole="button"
          onPress={handleDirections}
          style={({ pressed }) => [
            styles.directionsButton,
            { backgroundColor: theme.primary, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
            Directions
          </ThemedText>
          <ThemedText style={{ color: theme.onPrimary, fontSize: 13 }}>↗</ThemedText>
        </Pressable>

        {onToggleSave ? (
          <Pressable
            accessibilityRole="button"
            disabled={saving}
            onPress={handleSaveToggle}
            style={({ pressed }) => [
              styles.secondaryButton,
              {
                backgroundColor: isSaved ? theme.backgroundSelected : theme.backgroundElement,
                borderColor: isSaved ? theme.primary : theme.border,
                opacity: saving ? 0.6 : pressed ? 0.75 : 1,
              },
            ]}
          >
            {saving ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : (
              <>
                <ThemedText style={styles.buttonIcon}>
                  {isSaved ? '★' : '☆'}
                </ThemedText>
                <ThemedText type="smallBold" themeColor={isSaved ? 'primary' : undefined}>
                  {isSaved ? 'Saved' : 'Save'}
                </ThemedText>
              </>
            )}
          </Pressable>
        ) : null}

        {onRate ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={userRating ? `Rated ${userRating}, tap to update` : 'Rate this place'}
            onPress={onRate}
            style={({ pressed }) => [
              styles.secondaryButton,
              {
                backgroundColor: userRating ? theme.backgroundSelected : theme.backgroundElement,
                borderColor: userRating ? theme.primary : theme.border,
                opacity: pressed ? 0.75 : 1,
              },
            ]}
          >
            {userRating !== undefined && userRating !== null ? (
              <ScoreBadge score={userRating} size="small" />
            ) : (
              <>
                <ThemedText style={styles.buttonIcon}>★</ThemedText>
                <ThemedText type="smallBold" themeColor="primary">
                  Rate
                </ThemedText>
              </>
            )}
          </Pressable>
        ) : null}
      </View>

      {/* Secondary Row: Call, Website, Share */}
      <View style={styles.secondaryRow}>
        {place.phoneNumber ? (
          <Pressable
            accessibilityRole="button"
            onPress={handleCall}
            style={({ pressed }) => [
              styles.actionPill,
              { backgroundColor: theme.backgroundElement, borderColor: theme.border, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <ThemedText style={styles.pillIcon}>📞</ThemedText>
            <ThemedText type="smallBold">Call</ThemedText>
          </Pressable>
        ) : null}

        {place.websiteUri ? (
          <Pressable
            accessibilityRole="button"
            onPress={handleWebsite}
            style={({ pressed }) => [
              styles.actionPill,
              { backgroundColor: theme.backgroundElement, borderColor: theme.border, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <ThemedText style={styles.pillIcon}>🌐</ThemedText>
            <ThemedText type="smallBold">Website</ThemedText>
          </Pressable>
        ) : null}

        <Pressable
          accessibilityRole="button"
          onPress={handleShare}
          style={({ pressed }) => [
            styles.actionPill,
            { backgroundColor: theme.backgroundElement, borderColor: theme.border, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <ThemedText style={styles.pillIcon}>↗</ThemedText>
          <ThemedText type="smallBold">Share</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
    marginTop: 4,
  },
  primaryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  directionsButton: {
    flex: 2,
    minHeight: 48,
    borderRadius: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  buttonIcon: {
    fontSize: 16,
  },
  secondaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionPill: {
    flex: 1,
    minWidth: 90,
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  pillIcon: {
    fontSize: 14,
  },
});
