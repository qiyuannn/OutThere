import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, type FlatList } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { useAuth } from '@/providers/auth-provider';
import { validateCommentBody } from '../feed-model';
import {
  createComment,
  deleteComment,
  getPostComments,
  getPostDetail,
} from '../service';
import type { FeedPost, PostComment } from '../types';

export function useComments() {
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
      if (trimmed.length > 1000) Alert.alert('Comment too long', validation.error);
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
      setTimeout(() => { flatListRef.current?.scrollToEnd({ animated: true }); }, 100);
    } catch (reason) {
      Alert.alert('Could not post comment', reason instanceof Error ? reason.message : 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async (commentId: number) => {
    if (!currentUserId) return;
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
  };

  const handleDeleteComment = (commentId: number) => {
    if (!currentUserId) return;
    Alert.alert('Delete comment', 'Are you sure you want to delete this comment?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void confirmDelete(commentId) },
    ]);
  };

  const canSubmit = validateCommentBody(commentText).valid;

  return {
    post,
    comments,
    loading,
    refreshing,
    error,
    commentText,
    setCommentText,
    submitting,
    canSubmit,
    flatListRef,
    currentUserId,
    loadData,
    handleRefresh,
    handleSubmitComment,
    handleDeleteComment,
  };
}
