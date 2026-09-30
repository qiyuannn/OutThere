import { useState } from 'react';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { routes } from '@/lib/routes';
import { formatFeedTimestamp } from '../feed-model';
import type { PostComment } from '../types';

interface CommentItemProps {
  comment: PostComment;
  currentUserId?: string;
  onDelete: (id: number) => void;
}

export function CommentItem({
  comment,
  currentUserId,
  onDelete,
}: CommentItemProps) {
  const isMine = !!currentUserId && comment.userId === currentUserId;
  const [avatarFailed, setAvatarFailed] = useState(false);

  const openProfile = () => {
    if (comment.userId) {
      router.push(routes.userProfile(comment.userId));
    }
  };

  return (
    <View style={styles.commentRow}>
      <Pressable accessibilityRole="button" onPress={openProfile} style={styles.commentAvatar}>
        {comment.avatarUrl && !avatarFailed ? (
          <Image
            accessibilityLabel={`${comment.displayName}'s avatar`}
            contentFit="cover"
            onError={() => setAvatarFailed(true)}
            source={comment.avatarUrl}
            style={styles.commentAvatarImg}
          />
        ) : (
          <ThemedText style={styles.commentAvatarInitials}>
            {comment.displayName.trim().slice(0, 2).toUpperCase() || 'OT'}
          </ThemedText>
        )}
      </Pressable>

      <View style={styles.commentBodyCol}>
        <View style={styles.commentHeaderRow}>
          <Pressable accessibilityRole="button" onPress={openProfile}>
            <ThemedText numberOfLines={1} style={styles.commentAuthor}>
              {comment.displayName}
            </ThemedText>
          </Pressable>
          <ThemedText style={styles.commentTimestamp}>
            {formatFeedTimestamp(comment.createdAt)}
          </ThemedText>
        </View>

        <ThemedText style={styles.commentText}>{comment.body}</ThemedText>
      </View>

      {isMine ? (
        <Pressable
          accessibilityLabel="Delete comment"
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => onDelete(comment.id)}
          style={({ pressed }) => [styles.deleteBtn, pressed && styles.pressed]}
        >
          <ThemedText style={styles.deleteBtnText}>Delete</ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  commentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E7EDDE',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  commentAvatarImg: {
    width: 32,
    height: 32,
  },
  commentAvatarInitials: {
    color: '#24331B',
    fontSize: 11,
    fontWeight: '700',
  },
  commentBodyCol: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  commentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  commentAuthor: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 16,
  },
  commentTimestamp: {
    color: '#9CA3AF',
    fontSize: 10,
    fontWeight: '400',
    lineHeight: 14,
  },
  commentText: {
    color: '#000000',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
  },
  deleteBtn: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  deleteBtnText: {
    color: '#EF4444',
    fontSize: 11,
    fontWeight: '500',
  },
  pressed: {
    opacity: 0.55,
  },
});
