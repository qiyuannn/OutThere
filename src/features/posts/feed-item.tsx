import { useEffect, useRef, useState } from 'react';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { getScoreTier } from '@/features/rankings/comparison';
import { useTheme } from '@/hooks/use-theme';
import { computeIsOpenNow } from '@/lib/opening-hours';
import { formatFeedTimestamp, formatLikeCount, formatPlaceCategory } from './feed-model';
import type { FeedPost } from './types';

const likeIcon = require('../../../assets/images/posts/thumbs-up.svg');
const commentIcon = require('../../../assets/images/posts/chat-dots.svg');
const shareIcon = require('../../../assets/images/posts/share-fat.svg');

type FeedItemProps = {
  post: FeedPost;
  liking: boolean;
  onToggleLike: (post: FeedPost) => void;
  showAuthor?: boolean;
  showOpeningStatus?: boolean;
};

export function FeedItem({ post, liking, onToggleLike, showAuthor = true, showOpeningStatus = false }: FeedItemProps) {
  const theme = useTheme();
  const category = formatPlaceCategory(post.placePriceLevel, post.placeCategory);
  const openNow = showOpeningStatus ? computeIsOpenNow(post.placeRegularOpeningHours) : null;
  const scoreTier = getScoreTier(post.rating);
  const badgeColors = post.rating >= 9
    ? { backgroundColor: 'rgba(139, 242, 144, 0.74)', borderColor: '#66C152' }
    : { backgroundColor: scoreTier.backgroundColor, borderColor: scoreTier.color };

  const openPlace = () => router.push({ pathname: '/search/[id]', params: { id: post.googlePlaceId } });
  const sharePost = () => {
    if (Platform.OS !== 'web') void Haptics.selectionAsync();
    return Share.share({
      message: `${post.displayName} rated ${post.placeName} ${post.rating.toFixed(1)}/10 on OutThere.${post.body ? `\n\n${post.body}` : ''}`,
    });
  };

  const handleLike = () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onToggleLike(post);
  };

  return (
    <View style={[styles.item, { backgroundColor: theme.backgroundElement, borderBottomColor: theme.border }]}>
      {showAuthor ? (
        <View style={styles.profileRow}>
          <FeedAvatar name={post.displayName} uri={post.avatarUrl} />
          <View style={styles.profileCopy}>
            <ThemedText numberOfLines={1} style={[styles.profileName, { color: theme.text }]}>{post.displayName}</ThemedText>
            <ThemedText style={[styles.meta, { color: theme.textSecondary }]}>{formatFeedTimestamp(post.createdAt)}</ThemedText>
          </View>
        </View>
      ) : null}

      <View style={styles.placeRow}>
        <Pressable accessibilityRole="link" onPress={openPlace} style={({ pressed }) => [styles.placeDetails, pressed && styles.pressed]}>
          <ThemedText numberOfLines={1} style={[styles.placeName, { color: theme.text }]}>{post.placeName}</ThemedText>
          {category ? <ThemedText numberOfLines={1} style={[styles.meta, { color: theme.textSecondary }]}>{category}</ThemedText> : null}
          {post.placeAddress ? <ThemedText numberOfLines={1} style={[styles.meta, { color: theme.textSecondary }]}>{post.placeAddress}</ThemedText> : null}
          {openNow !== null ? <ThemedText style={[styles.meta, { color: openNow ? (theme.save ?? '#10B981') : theme.textSecondary }]}>{openNow ? 'Open Now' : 'Closed Now'}</ThemedText> : null}
        </Pressable>
        <View style={styles.ratingSlot}>
          <View style={[styles.ratingBadge, badgeColors]}>
            <ThemedText style={styles.ratingText}>{post.rating.toFixed(1)}</ThemedText>
          </View>
        </View>
      </View>

      {post.body ? <ThemedText style={[styles.body, { color: theme.text }]}>{post.body}</ThemedText> : null}
      {post.photoUrls.length > 0 ? <PhotoGallery urls={post.photoUrls} placeName={post.placeName} /> : null}

      <ThemedText style={[styles.likeCount, { color: theme.textSecondary }]}>{formatLikeCount(post.likeCount)}</ThemedText>
      <View style={[styles.actions, { borderTopColor: theme.border }]}>
        <ActionButton
          accessibilityLabel={post.likedByMe ? 'Unlike post' : 'Like post'}
          disabled={liking}
          icon={likeIcon}
          onPress={handleLike}
          selected={post.likedByMe}
          activeTint={theme.like ?? '#EF4444'}
          defaultTint={theme.textSecondary}
        />
        <ActionButton accessibilityLabel="Comments are not available yet" disabled icon={commentIcon} defaultTint={theme.textSecondary} />
        <ActionButton accessibilityLabel="Share post" icon={shareIcon} onPress={() => void sharePost()} defaultTint={theme.textSecondary} />
      </View>
    </View>
  );
}

function FeedAvatar({ name, uri }: { name: string; uri: string | null }) {
  const [failed, setFailed] = useState(false);
  return (
    <View style={styles.avatar}>
      {uri && !failed ? (
        <Image accessibilityLabel={`${name}'s profile photo`} contentFit="cover" onError={() => setFailed(true)} source={uri} style={styles.avatarImage} />
      ) : (
        <ThemedText style={styles.avatarInitials}>{name.trim().slice(0, 2).toUpperCase() || 'OT'}</ThemedText>
      )}
    </View>
  );
}

function PhotoGallery({ urls, placeName }: { urls: string[]; placeName: string }) {
  const [width, setWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const onLayout = (event: LayoutChangeEvent) => setWidth(Math.round(event.nativeEvent.layout.width));

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width > 0) {
      const nextIndex = Math.round(event.nativeEvent.contentOffset.x / width);
      if (nextIndex !== activeIndex) {
        setActiveIndex(nextIndex);
      }
    }
  };

  return (
    <View onLayout={onLayout} style={styles.photoViewport}>
      {width > 0 ? (
        <>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={32}
          >
            {urls.map((url, index) => (
              <Image
                accessibilityLabel={`${placeName} photo ${index + 1}`}
                contentFit="cover"
                key={url}
                source={url}
                style={{ width, height: 227 }}
                transition={150}
              />
            ))}
          </ScrollView>
          {urls.length > 1 ? (
            <View pointerEvents="none" style={styles.paginationContainer}>
              {urls.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.paginationDot,
                    i === activeIndex && styles.paginationDotActive,
                  ]}
                />
              ))}
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

function ActionButton({
  accessibilityLabel,
  disabled = false,
  icon,
  onPress,
  selected = false,
  activeTint,
  defaultTint,
}: {
  accessibilityLabel: string;
  disabled?: boolean;
  icon: number;
  onPress?: () => void;
  selected?: boolean;
  activeTint?: string;
  defaultTint?: string;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (selected) {
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.35, duration: 110, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, speed: 24, bounciness: 10, useNativeDriver: true }),
      ]).start();
    }
  }, [selected, scale]);

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.actionButton, pressed && styles.actionMuted]}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Image
          contentFit="contain"
          source={icon}
          style={[
            styles.actionIcon,
            { tintColor: selected ? activeTint : defaultTint },
            disabled && styles.actionMuted,
          ]}
        />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  item: {
    width: '100%',
    gap: 10,
    padding: 12,
    overflow: 'hidden',
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
    borderRadius: 20,
  },
  profileRow: { width: '100%', paddingHorizontal: 2, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 10, overflow: 'hidden' },
  avatar: { width: 40, height: 40, borderRadius: 20, flexShrink: 0, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: '#E7EDDE' },
  avatarImage: { width: 40, height: 40 },
  avatarInitials: { color: '#24331B', fontSize: 12, lineHeight: 15, fontWeight: '700' },
  profileCopy: { flex: 1, minWidth: 0, paddingHorizontal: 2, paddingVertical: 1, justifyContent: 'center' },
  profileName: { fontSize: 15, lineHeight: 18, fontWeight: '700', letterSpacing: 0.2 },
  meta: { fontSize: 11, lineHeight: 15, fontWeight: '500', letterSpacing: 0.2 },
  ratingBadge: { height: 32, minWidth: 48, flexShrink: 0, paddingHorizontal: 10, borderWidth: 1, borderRadius: 100, alignItems: 'center', justifyContent: 'center' },
  ratingText: { color: '#000000', fontSize: 13, lineHeight: 16, fontWeight: '700' },
  placeRow: { width: '100%', flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  placeDetails: { flex: 1, minWidth: 0, overflow: 'hidden', gap: 2 },
  ratingSlot: { width: 56, height: 56, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
  placeName: { fontSize: 17, lineHeight: 22, fontWeight: '700', letterSpacing: -0.2 },
  body: { width: '100%', fontSize: 13, lineHeight: 18, fontWeight: '400', letterSpacing: 0.2 },
  photoViewport: { width: '100%', height: 227, overflow: 'hidden', borderRadius: 16, backgroundColor: '#F3F4F6' },
  paginationContainer: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  paginationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
  },
  paginationDotActive: {
    width: 16,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  likeCount: { width: '100%', height: 16, fontSize: 11, lineHeight: 15, fontWeight: '600', letterSpacing: 0.25 },
  actions: { width: '100%', height: 48, flexDirection: 'row', gap: 10, overflow: 'hidden', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 4 },
  actionButton: { flex: 1, height: 44, alignItems: 'center', justifyContent: 'center' },
  actionIcon: { width: 22, height: 22 },
  actionMuted: { opacity: 0.35 },
  pressed: { opacity: 0.55 },
});
