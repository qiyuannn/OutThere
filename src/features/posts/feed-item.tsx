import { useState } from 'react';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import {
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { getScoreTier } from '@/features/rankings/comparison';
import { formatFeedTimestamp, formatLikeCount, formatPlaceCategory } from './feed-model';
import type { FeedPost } from './types';

const likeIcon = require('../../../assets/images/posts/thumbs-up.svg');
const commentIcon = require('../../../assets/images/posts/chat-dots.svg');
const shareIcon = require('../../../assets/images/posts/share-fat.svg');

type FeedItemProps = {
  post: FeedPost;
  liking: boolean;
  onToggleLike: (post: FeedPost) => void;
};

export function FeedItem({ post, liking, onToggleLike }: FeedItemProps) {
  const category = formatPlaceCategory(post.placePriceLevel, post.placeCategory);
  const scoreTier = getScoreTier(post.rating);
  const badgeColors = post.rating >= 9
    ? { backgroundColor: 'rgba(139, 242, 144, 0.74)', borderColor: '#66C152' }
    : { backgroundColor: scoreTier.backgroundColor, borderColor: scoreTier.color };

  const openPlace = () => router.push({ pathname: '/search/[id]', params: { id: post.googlePlaceId } });
  const sharePost = () => Share.share({
    message: `${post.displayName} rated ${post.placeName} ${post.rating.toFixed(1)}/10 on OutThere.${post.body ? `\n\n${post.body}` : ''}`,
  });

  return (
    <View style={styles.item}>
      <View style={styles.profileRow}>
        <FeedAvatar name={post.displayName} uri={post.avatarUrl} />
        <View style={styles.profileCopy}>
          <ThemedText numberOfLines={1} style={styles.profileName}>{post.displayName}</ThemedText>
          <ThemedText style={styles.meta}>{formatFeedTimestamp(post.createdAt)}</ThemedText>
        </View>
        <View style={[styles.ratingBadge, badgeColors]}>
          <ThemedText style={styles.ratingText}>{post.rating.toFixed(1)}</ThemedText>
        </View>
      </View>

      <Pressable accessibilityRole="link" onPress={openPlace} style={({ pressed }) => [styles.placeDetails, pressed && styles.pressed]}>
        <ThemedText numberOfLines={1} style={styles.placeName}>{post.placeName}</ThemedText>
        {category ? <ThemedText numberOfLines={1} style={styles.meta}>{category}</ThemedText> : null}
        {post.placeAddress ? <ThemedText numberOfLines={1} style={styles.meta}>{post.placeAddress}</ThemedText> : null}
      </Pressable>

      {post.body ? <ThemedText style={styles.body}>{post.body}</ThemedText> : null}
      {post.photoUrls.length > 0 ? <PhotoGallery urls={post.photoUrls} placeName={post.placeName} /> : null}

      <ThemedText style={styles.likeCount}>{formatLikeCount(post.likeCount)}</ThemedText>
      <View style={styles.actions}>
        <ActionButton
          accessibilityLabel={post.likedByMe ? 'Unlike post' : 'Like post'}
          disabled={liking}
          icon={likeIcon}
          onPress={() => onToggleLike(post)}
          selected={post.likedByMe}
        />
        <ActionButton accessibilityLabel="Comments are not available yet" disabled icon={commentIcon} />
        <ActionButton accessibilityLabel="Share post" icon={shareIcon} onPress={() => void sharePost()} />
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
  const onLayout = (event: LayoutChangeEvent) => setWidth(Math.round(event.nativeEvent.layout.width));

  return (
    <View onLayout={onLayout} style={styles.photoViewport}>
      {width > 0 ? (
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
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
      ) : null}
    </View>
  );
}

function ActionButton({ accessibilityLabel, disabled = false, icon, onPress, selected = false }: {
  accessibilityLabel: string;
  disabled?: boolean;
  icon: number;
  onPress?: () => void;
  selected?: boolean;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.actionButton, pressed && styles.actionMuted]}
    >
      <Image contentFit="contain" source={icon} style={[styles.actionIcon, selected && styles.selectedIcon]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  item: { width: '100%', gap: 10, padding: 10, overflow: 'hidden', backgroundColor: '#FFFFFF' },
  profileRow: { width: '100%', padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10, overflow: 'hidden' },
  avatar: { width: 40, height: 40, borderRadius: 20, flexShrink: 0, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: '#E7EDDE' },
  avatarImage: { width: 40, height: 40 },
  avatarInitials: { color: '#24331B', fontSize: 12, lineHeight: 15, fontWeight: '700' },
  profileCopy: { flex: 1, minWidth: 0, paddingHorizontal: 2, paddingVertical: 1, justifyContent: 'center' },
  profileName: { color: '#000000', fontSize: 16, lineHeight: 15, fontWeight: '600', letterSpacing: 0.25 },
  meta: { color: '#000000', fontSize: 10, lineHeight: 15, fontWeight: '300', letterSpacing: 0.25 },
  ratingBadge: { height: 30, minWidth: 45, flexShrink: 0, paddingHorizontal: 10, borderWidth: 1, borderRadius: 100, alignItems: 'center', justifyContent: 'center' },
  ratingText: { color: '#000000', fontSize: 12, lineHeight: 15, fontWeight: '400' },
  placeDetails: { width: '100%', overflow: 'hidden' },
  placeName: { color: '#000000', fontSize: 16, lineHeight: 15, fontWeight: '600', letterSpacing: 0.25 },
  body: { width: '100%', color: '#000000', fontSize: 10, lineHeight: 15, fontWeight: '300', letterSpacing: 0.25 },
  photoViewport: { width: '100%', height: 227, overflow: 'hidden', backgroundColor: '#F3F4F6' },
  likeCount: { width: '100%', height: 16, color: '#000000', fontSize: 10, lineHeight: 15, fontWeight: '500', letterSpacing: 0.25 },
  actions: { width: '100%', height: 54, flexDirection: 'row', gap: 10, overflow: 'hidden' },
  actionButton: { flex: 1, height: 54, alignItems: 'center', justifyContent: 'center' },
  actionIcon: { width: 24, height: 24 },
  selectedIcon: { opacity: 0.48 },
  actionMuted: { opacity: 0.35 },
  pressed: { opacity: 0.55 },
});
