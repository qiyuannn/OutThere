import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
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
import { FeedItem } from '@/features/posts/feed-item';
import type { FeedPost } from '@/features/posts/types';
import { useAuth } from '@/providers/auth-provider';
import { formatActivitiesTitle } from './model';
import { usePastActivities } from './use-past-activities';

export default function PastActivitiesScreen() {
  const { userId: paramUserId, userName } = useLocalSearchParams<{ userId?: string; userName?: string }>();
  const { session } = useAuth();
  const currentUserId = session?.user.id;
  const targetUserId = paramUserId || currentUserId;
  const isOwn = !paramUserId || paramUserId === currentUserId;

  const activities = usePastActivities(targetUserId);
  const [likingIds, setLikingIds] = useState<Set<number>>(() => new Set());

  const toggleLike = async (post: FeedPost) => {
    if (likingIds.has(post.id)) return;
    setLikingIds((current) => new Set(current).add(post.id));
    try {
      await activities.toggleLike(post);
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

  const headerTitle = formatActivitiesTitle(isOwn, userName);

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.screen}>
      <AppHeader description={headerTitle} onBack={() => router.back()} showBack />
      {activities.loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator accessibilityLabel="Loading past activities" color="#000000" />
        </View>
      ) : (
        <FlatList
          contentContainerStyle={activities.posts.length === 0 ? styles.emptyContent : styles.content}
          data={activities.posts}
          keyExtractor={(post) => String(post.id)}
          ListEmptyComponent={<EmptyActivities error={activities.error} isOwn={isOwn} onRetry={() => void activities.refresh()} />}
          ListFooterComponent={activities.loadingMore ? <ActivityIndicator color="#000000" style={styles.footerLoader} /> : null}
          onEndReached={() => void activities.loadMore()}
          onEndReachedThreshold={0.5}
          refreshControl={<RefreshControl refreshing={activities.refreshing} onRefresh={() => void activities.refresh()} tintColor="#000000" />}
          renderItem={({ item }) => (
            <FeedItem
              liking={likingIds.has(item.id)}
              onToggleLike={(post) => void toggleLike(post)}
              post={item}
              showAuthor={false}
              showOpeningStatus
            />
          )}
          showsVerticalScrollIndicator={false}
          style={styles.list}
        />
      )}
    </SafeAreaView>
  );
}

function EmptyActivities({ error, isOwn, onRetry }: { error: string | null; isOwn: boolean; onRetry: () => void }) {
  return (
    <View style={styles.centerState}>
      <ThemedText accessibilityRole={error ? 'alert' : undefined} style={styles.stateTitle}>
        {error ? 'Couldn’t load activities' : 'No past activities yet'}
      </ThemedText>
      <ThemedText style={styles.stateBody}>
        {error ? 'Check your connection and try again.' : isOwn ? 'Places you post about will appear here.' : 'Places this user posts about will appear here.'}
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
