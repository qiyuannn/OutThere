import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { useAuth } from '@/providers/auth-provider';
import { getFeedPage, setPostLiked } from './service';
import type { FeedCursor, FeedPost, FeedScope } from './types';

export function useFeed(scope: FeedScope = 'explore') {
  const { session } = useAuth();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [cursor, setCursor] = useState<FeedCursor | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);
  const hasLoaded = useRef(false);
  const currentScope = useRef<FeedScope>(scope);

  const refresh = useCallback(async () => {
    const id = ++request.current;
    if (scope !== currentScope.current) {
      currentScope.current = scope;
      hasLoaded.current = false;
      setPosts([]);
      setCursor(null);
    }
    hasLoaded.current ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const page = await getFeedPage(null, scope);
      if (id !== request.current) return;
      setPosts(page.posts);
      setCursor(page.nextCursor);
      hasLoaded.current = true;
    } catch (reason) {
      if (id === request.current) setError(reason instanceof Error ? reason.message : 'Could not load the feed.');
    } finally {
      if (id === request.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [scope]);

  useFocusEffect(useCallback(() => {
    void refresh();
    return () => { request.current += 1; };
  }, [refresh]));

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore || refreshing) return;
    setLoadingMore(true);
    try {
      const page = await getFeedPage(cursor, scope);
      setPosts((current) => {
        const knownIds = new Set(current.map((post) => post.id));
        return [...current, ...page.posts.filter((post) => !knownIds.has(post.id))];
      });
      setCursor(page.nextCursor);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load more posts.');
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, loadingMore, refreshing, scope]);

  const toggleLike = useCallback(async (post: FeedPost) => {
    const userId = session?.user.id;
    if (!userId) return;
    const nextLiked = !post.likedByMe;
    setPosts((current) => current.map((item) => item.id === post.id ? {
      ...item,
      likedByMe: nextLiked,
      likeCount: Math.max(0, item.likeCount + (nextLiked ? 1 : -1)),
    } : item));
    try {
      await setPostLiked(post.id, userId, nextLiked);
    } catch (reason) {
      setPosts((current) => current.map((item) => item.id === post.id ? {
        ...item,
        likedByMe: post.likedByMe,
        likeCount: post.likeCount,
      } : item));
      throw reason;
    }
  }, [session?.user.id]);

  return { posts, loading, refreshing, loadingMore, error, refresh, loadMore, toggleLike };
}
