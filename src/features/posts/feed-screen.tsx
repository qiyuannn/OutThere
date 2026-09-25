import { useState } from 'react';
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
import { FeedItem } from './feed-item';
import type { FeedPost } from './types';
import { useFeed } from './use-feed';

export default function FeedScreen() {
  const feed = useFeed();
  const [likingIds, setLikingIds] = useState<Set<number>>(() => new Set());

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
    <SafeAreaView edges={['left', 'right']} style={styles.screen}>
      <AppHeader description="Feed" />
      {feed.loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator accessibilityLabel="Loading feed" color="#000000" />
        </View>
      ) : (
        <FlatList
          contentContainerStyle={feed.posts.length === 0 ? styles.emptyContent : styles.content}
          data={feed.posts}
          keyExtractor={(post) => String(post.id)}
          ListEmptyComponent={<EmptyFeed error={feed.error} onRetry={() => void feed.refresh()} />}
          ListFooterComponent={feed.loadingMore ? <ActivityIndicator color="#000000" style={styles.footerLoader} /> : null}
          onEndReached={() => void feed.loadMore()}
          onEndReachedThreshold={0.5}
          refreshControl={<RefreshControl refreshing={feed.refreshing} onRefresh={() => void feed.refresh()} tintColor="#000000" />}
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
  return (
    <View style={styles.centerState}>
      <ThemedText accessibilityRole={error ? 'alert' : undefined} style={styles.stateTitle}>
        {error ? 'Couldn’t load the feed' : 'No posts yet'}
      </ThemedText>
      <ThemedText style={styles.stateBody}>
        {error ? 'Check your connection and try again.' : 'Posts from profiles you follow will appear here.'}
      </ThemedText>
      {error ? (
        <Pressable accessibilityRole="button" onPress={onRetry} style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}>
          <ThemedText style={styles.retryLabel}>Try again</ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, overflow: 'hidden', backgroundColor: '#FFFFFF' },
  list: { width: '100%', maxWidth: 402, alignSelf: 'center' },
  content: { padding: 10, paddingBottom: 24 },
  emptyContent: { flexGrow: 1, padding: 20 },
  centerState: { flex: 1, minHeight: 180, padding: 20, alignItems: 'center', justifyContent: 'center', gap: 8 },
  stateTitle: { color: '#000000', fontSize: 16, lineHeight: 20, fontWeight: '600', textAlign: 'center' },
  stateBody: { color: '#000000', fontSize: 10, lineHeight: 15, fontWeight: '300', textAlign: 'center' },
  retryButton: { minHeight: 38, marginTop: 6, paddingHorizontal: 24, borderWidth: 1, borderColor: '#000000', alignItems: 'center', justifyContent: 'center' },
  retryLabel: { color: '#000000', fontSize: 12, lineHeight: 15, fontWeight: '600' },
  footerLoader: { paddingVertical: 20 },
  pressed: { opacity: 0.55 },
});
