import { useCallback, useEffect, useRef, useState } from 'react';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/app-header';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/providers/auth-provider';
import { FeedItem } from './feed-item';
import { formatFeedTimestamp, validateCommentBody } from './feed-model';
import {
  createComment,
  deleteComment,
  getPostComments,
  getPostDetail,
} from './service';
import type { FeedPost, PostComment } from './types';

export default function CommentsScreen() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const { session } = useAuth();
  const currentUserId = session?.user.id;
  const numericPostId = Number(postId);

  const [post, setPost] = useState<FeedPost | null>(null);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const flatListRef = useRef<FlatList<PostComment>>(null);
  const requestCount = useRef(0);

  const loadData = useCallback(async () => {
    if (!numericPostId || Number.isNaN(numericPostId)) {
      setLoading(false);
      setError('Post not found.');
      return;
    }

    const currentReq = ++requestCount.current;
    setError(null);
    try {
      const [fetchedPost, fetchedComments] = await Promise.all([
        getPostDetail(numericPostId),
        getPostComments(numericPostId),
      ]);
      if (currentReq !== requestCount.current) return;
      if (!fetchedPost) {
        setError('Post not found.');
      } else {
        setPost(fetchedPost);
        setComments(fetchedComments);
      }
    } catch (reason) {
      if (currentReq === requestCount.current) {
        setError(reason instanceof Error ? reason.message : 'Could not load comments.');
      }
    } finally {
      if (currentReq === requestCount.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [numericPostId]);

  useEffect(() => {
    setLoading(true);
    void loadData();
    return () => { requestCount.current += 1; };
  }, [loadData]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
  }, [loadData]);

  const handleSubmitComment = async () => {
    const trimmed = commentText.trim();
    const validation = validateCommentBody(trimmed);
    if (!validation.valid) {
      if (trimmed.length > 1000) {
        Alert.alert('Comment too long', validation.error);
      }
      return;
    }
    if (!currentUserId || !numericPostId || submitting) return;

    setSubmitting(true);
    try {
      const newComment = await createComment(numericPostId, currentUserId, trimmed);
      setComments((current) => [...current, newComment]);
      setCommentText('');
      setPost((current) => current ? {
        ...current,
        commentCount: (current.commentCount ?? 0) + 1,
      } : null);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (reason) {
      Alert.alert('Could not post comment', reason instanceof Error ? reason.message : 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = (commentId: number) => {
    if (!currentUserId) return;
    Alert.alert('Delete comment', 'Are you sure you want to delete this comment?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteComment(commentId, currentUserId);
            setComments((current) => current.filter((c) => c.id !== commentId));
            setPost((current) => current ? {
              ...current,
              commentCount: Math.max(0, (current.commentCount ?? 1) - 1),
            } : null);
          } catch (reason) {
            Alert.alert('Could not delete comment', reason instanceof Error ? reason.message : 'Please try again.');
          }
        },
      },
    ]);
  };

  const canSubmit = validateCommentBody(commentText).valid;

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.screen}>
      <AppHeader description="Comments" onBack={() => router.back()} showBack />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardArea}
      >
        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator accessibilityLabel="Loading comments" color="#000000" />
          </View>
        ) : error && !post ? (
          <View style={styles.centerState}>
            <ThemedText style={styles.stateTitle}>Couldn’t load comments</ThemedText>
            <ThemedText style={styles.stateBody}>{error}</ThemedText>
            <Pressable accessibilityRole="button" onPress={() => void loadData()} style={({ pressed }) => [styles.retryBtn, pressed && styles.pressed]}>
              <ThemedText style={styles.retryLabel}>Try again</ThemedText>
            </Pressable>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            contentContainerStyle={styles.listContent}
            data={comments}
            keyExtractor={(item) => String(item.id)}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={(
              <View style={styles.emptyComments}>
                <ThemedText style={styles.emptyCommentsTitle}>No comments yet</ThemedText>
                <ThemedText style={styles.emptyCommentsBody}>Be the first to share your thoughts.</ThemedText>
              </View>
            )}
            ListHeaderComponent={(
              <View style={styles.headerContainer}>
                {post ? (
                  <FeedItem
                    disableCommentLink
                    post={post}
                    showActions={false}
                  />
                ) : null}
                <View style={styles.commentsTitleRow}>
                  <ThemedText style={styles.commentsTitle}>Comments</ThemedText>
                </View>
              </View>
            )}
            refreshControl={(
              <RefreshControl
                onRefresh={() => void handleRefresh()}
                refreshing={refreshing}
                tintColor="#000000"
              />
            )}
            renderItem={({ item }) => (
              <CommentItem
                comment={item}
                currentUserId={currentUserId}
                onDelete={handleDeleteComment}
              />
            )}
            showsVerticalScrollIndicator={false}
            style={styles.list}
          />
        )}

        {/* Sticky Input Bar on top of bottom navigation bar */}
        <View style={styles.inputBar}>
          <TextInput
            accessibilityLabel="Add a comment"
            maxLength={1000}
            multiline
            onChangeText={setCommentText}
            placeholder="Add a comment..."
            placeholderTextColor="#9CA3AF"
            style={styles.inputField}
            value={commentText}
          />
          <Pressable
            accessibilityLabel="Post comment"
            accessibilityRole="button"
            disabled={!canSubmit || submitting}
            onPress={() => void handleSubmitComment()}
            style={({ pressed }) => [
              styles.postBtn,
              canSubmit ? styles.postBtnActive : styles.postBtnDisabled,
              pressed && canSubmit && styles.pressed,
            ]}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <ThemedText style={[styles.postBtnText, canSubmit ? styles.postBtnTextActive : styles.postBtnTextDisabled]}>
                Post
              </ThemedText>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function CommentItem({
  comment,
  currentUserId,
  onDelete,
}: {
  comment: PostComment;
  currentUserId?: string;
  onDelete: (id: number) => void;
}) {
  const isMine = !!currentUserId && comment.userId === currentUserId;
  const [avatarFailed, setAvatarFailed] = useState(false);

  const openProfile = () => {
    if (comment.userId) {
      router.push({ pathname: '/search/profile/[id]', params: { id: comment.userId } });
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
  screen: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  keyboardArea: {
    flex: 1,
  },
  list: {
    flex: 1,
    width: '100%',
    maxWidth: 402,
    alignSelf: 'center',
  },
  listContent: {
    paddingBottom: 20,
  },
  headerContainer: {
    width: '100%',
    backgroundColor: '#FFFFFF',
  },
  commentsTitleRow: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 6,
  },
  commentsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
    lineHeight: 18,
  },
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
  emptyComments: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  emptyCommentsTitle: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyCommentsBody: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '400',
    textAlign: 'center',
  },
  inputBar: {
    width: '100%',
    maxWidth: 402,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
    backgroundColor: '#FFFFFF',
  },
  inputField: {
    flex: 1,
    minHeight: 38,
    maxHeight: 100,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingTop: 9,
    paddingBottom: 9,
    fontSize: 13,
    lineHeight: 18,
    color: '#000000',
  },
  postBtn: {
    height: 38,
    minWidth: 54,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 19,
  },
  postBtnActive: {
    backgroundColor: '#000000',
  },
  postBtnDisabled: {
    backgroundColor: '#E5E7EB',
  },
  postBtnText: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 15,
  },
  postBtnTextActive: {
    color: '#FFFFFF',
  },
  postBtnTextDisabled: {
    color: '#9CA3AF',
  },
  centerState: {
    flex: 1,
    minHeight: 200,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 8,
  },
  stateTitle: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  stateBody: {
    color: '#6B7280',
    fontSize: 12,
    textAlign: 'center',
  },
  retryBtn: {
    minHeight: 38,
    marginTop: 8,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryLabel: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.55,
  },
});
