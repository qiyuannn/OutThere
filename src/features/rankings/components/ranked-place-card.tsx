import { useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import type { RankedPlace } from '../types';
import { ScoreBadge } from './score-badge';

interface RankedPlaceCardProps {
  item: RankedPlace;
  rank: number;
  onDelete: (placeId: string) => void;
}

export function RankedPlaceCard({ item, rank, onDelete }: RankedPlaceCardProps) {
  const theme = useTheme();
  const [imageError, setImageError] = useState(false);

  const isTopThree = rank <= 3;
  const rankMedal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;

  const handlePress = () => {
    router.push({
      pathname: '/(tabs)/bucket-list/[id]',
      params: { id: item.google_place_id, mode: item.mode },
    });
  };

  const handleLongPress = () => {
    Alert.alert(
      'Remove from Rankings',
      `Are you sure you want to remove "${item.display_name}" from your personal rankings?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => onDelete(item.google_place_id) },
      ],
    );
  };

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={handleLongPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: theme.backgroundElement,
          borderColor: isTopThree ? theme.primary : theme.border,
          borderWidth: isTopThree ? 1.5 : 1,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      {/* Rank Indicator */}
      <View style={styles.rankCol}>
        {rankMedal ? (
          <ThemedText style={styles.medalIcon}>{rankMedal}</ThemedText>
        ) : (
          <View style={[styles.rankBadge, { backgroundColor: theme.backgroundSelected }]}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              #{rank}
            </ThemedText>
          </View>
        )}
      </View>

      {/* Thumbnail */}
      <View style={[styles.thumbContainer, { backgroundColor: theme.background }]}>
        {item.photo_url && !imageError ? (
          <Image
            source={{ uri: item.photo_url }}
            style={styles.thumb}
            onError={() => setImageError(true)}
          />
        ) : (
          <ThemedText style={styles.thumbEmoji}>{item.category_icon ?? '📍'}</ThemedText>
        )}
      </View>

      {/* Place Details */}
      <View style={styles.contentCol}>
        <View style={styles.titleRow}>
          <ThemedText type="smallBold" numberOfLines={1} style={styles.title}>
            {item.display_name}
          </ThemedText>
        </View>

        <View style={styles.metaRow}>
          {item.category_name ? (
            <View style={[styles.categoryTag, { backgroundColor: theme.backgroundSelected }]}>
              <ThemedText type="small" style={styles.categoryText} numberOfLines={1}>
                {item.category_icon} {item.category_name}
              </ThemedText>
            </View>
          ) : null}

          {item.recommend ? (
            <ThemedText type="small" style={styles.recommendBadge}>
              👍 Would return
            </ThemedText>
          ) : null}
        </View>

        {item.notes ? (
          <ThemedText
            type="small"
            themeColor="textSecondary"
            numberOfLines={2}
            style={styles.notes}
          >
            “{item.notes}”
          </ThemedText>
        ) : null}
      </View>

      {/* Score Pill */}
      <View style={styles.scoreCol}>
        <ScoreBadge score={item.rating} size="medium" />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 18,
    gap: 12,
    marginVertical: 4,
  },
  rankCol: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  medalIcon: {
    fontSize: 22,
  },
  rankBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
  },
  thumbContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  thumbEmoji: {
    fontSize: 24,
  },
  contentCol: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  categoryTag: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    maxWidth: 160,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '600',
  },
  recommendBadge: {
    fontSize: 11,
    color: '#059669',
    fontWeight: '600',
  },
  notes: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 2,
  },
  scoreCol: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
