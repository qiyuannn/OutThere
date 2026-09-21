import { useCallback, useState } from 'react';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/app-header';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { useUnreadNotificationsCount } from '@/features/social/hooks';
import { FeedItem } from './feed-item';
import type { FeedPost } from './types';
import { useFeed } from './use-feed';

export default function FeedScreen() {
  const theme = useTheme();
  const feed = useFeed();
  const [likingIds, setLikingIds] = useState<Set<number>>(() => new Set());
  const { unreadCount, setUnreadCount } = useUnreadNotificationsCount();

  const handleNotifications = useCallback(() => {
    setUnreadCount(0);
    router.push('/feed/notifications');
  }, [setUnreadCount]);

  const toggleLike = async (post: FeedPost) => {
    if (likingIds.has(post.id)) return;
    setLikingIds((current) => new Set(current).add(post.id));
    try {
      await feed.toggleLike(post);
    } catch {
      Alert.alert('Could not update like', 'Check your connection and try again.');
    } finally {
      setLikingIds((current) => {
        const next = new Set(current);
        next.delete(post.id);
        return next;
      });
    }
  };

  return (
    <SafeAreaView edges={['left', 'right']} style={[styles.screen, { backgroundColor: theme.backgroundElement }]}>
      <AppHeader
        description="Feed"
        onNotifications={handleNotifications}
        notificationsCount={unreadCount}
      />
      {feed.loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator accessibilityLabel="Loading feed" color={theme.primary} />
        </View>
      ) : (
        <FlatList
          contentContainerStyle={feed.posts.length === 0 ? styles.emptyContent : styles.content}
          data={feed.posts}
          keyExtractor={(post) => String(post.id)}
          ListEmptyComponent={<EmptyFeed error={feed.error} onRetry={() => void feed.refresh()} />}
          ListFooterComponent={feed.loadingMore ? <ActivityIndicator color={theme.primary} style={styles.footerLoader} /> : null}
          onEndReached={() => void feed.loadMore()}
          onEndReachedThreshold={0.5}
          refreshControl={<RefreshControl refreshing={feed.refreshing} onRefresh={() => void feed.refresh()} tintColor={theme.primary} />}
          renderItem={({ item }) => (
            <FeedItem
              liking={likingIds.has(item.id)}
              onToggleLike={(post) => void toggleLike(post)}
              post={item}
            />
          )}
          showsVerticalScrollIndicator={false}
          style={styles.list}
        />
      )}
    </SafeAreaView>
  );
}

function EmptyFeed({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  const theme = useTheme();
  return (
    <View style={styles.centerState}>
      <ThemedText accessibilityRole={error ? 'alert' : undefined} style={[styles.stateTitle, { color: theme.text }]}>
        {error ? 'Couldn’t load the feed' : 'No posts yet'}
      </ThemedText>
      <ThemedText style={[styles.stateBody, { color: theme.textSecondary }]}>
        {error ? 'Check your connection and try again.' : 'Posts from the OutThere community will appear here.'}
      </ThemedText>
      {error ? (
        <Pressable
          accessibilityRole="button"
          onPress={onRetry}
          style={({ pressed }) => [
            styles.retryButton,
            { borderColor: theme.border, backgroundColor: theme.backgroundSelected },
            pressed && styles.pressed,
          ]}
        >
          <ThemedText style={[styles.retryLabel, { color: theme.text }]}>Try again</ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, overflow: 'hidden' },
  list: { width: '100%', maxWidth: 402, alignSelf: 'center' },
  content: { padding: 10, paddingBottom: 24 },
  emptyContent: { flexGrow: 1, padding: 20 },
  centerState: { flex: 1, minHeight: 180, padding: 20, alignItems: 'center', justifyContent: 'center', gap: 8 },
  stateTitle: { fontSize: 16, lineHeight: 20, fontWeight: '700', textAlign: 'center' },
  stateBody: { fontSize: 13, lineHeight: 18, textAlign: 'center' },
  retryButton: { minHeight: 40, marginTop: 10, paddingHorizontal: 24, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  retryLabel: { fontSize: 13, lineHeight: 16, fontWeight: '700' },
  footerLoader: { paddingVertical: 20 },
  pressed: { opacity: 0.55 },
});
