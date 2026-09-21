import { router } from 'expo-router';
import { Button, Card, Screen } from '@/components/foundation';
import { ThemedText } from '@/components/themed-text';
import { SectionHeading } from '@/components/ui-system';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { SocialPostCard, SocialState, usePostPlaces } from './components';
import { useSocialList, useSocialQuery } from './hooks';
import type { SocialPost, SocialSettings } from './types';

export default function SocialFeedScreen() {
  const settings = useSocialQuery<SocialSettings>('settings');
  const feed = useSocialList<SocialPost>('feed');
  const places = usePostPlaces(feed.items);
  return <Screen title="Friends Feed" headerDescription="Friends Feed">
    <SectionHeading eyebrow="Your circle" title="What your friends loved" />
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickActions}>
      <QuickAction label="Find people" icon="＋" onPress={() => router.push('/feed/people')} />
      <QuickAction label="Notifications" icon="♡" onPress={() => router.push('/feed/notifications')} />
      <QuickAction label="Sharing" icon="◎" onPress={() => router.push('/feed/privacy')} />
    </ScrollView>
    {settings.data && !settings.data.enabled && <Card>
      <ThemedText type="subtitle">Enable your social profile</ThemedText>
      <ThemedText themeColor="textSecondary">People can only find you after you opt in. Your existing ratings remain private.</ThemedText>
      <Button variant="primary" label="Set up social sharing" onPress={() => router.push('/feed/privacy')} />
    </Card>}
    {!feed.loading && !feed.error && !feed.offline && !feed.items.length && <Card>
      <ThemedText type="subtitle">Your next find starts with a friend.</ThemedText>
      <ThemedText themeColor="textSecondary">Add friends and share a rating with Friends to start the feed.</ThemedText>
      <Button variant="primary" label="Open my rankings" onPress={() => router.push('/rankings')} />
    </Card>}
    {feed.items.map((post) => <SocialPostCard key={post.id} post={post} place={places[post.google_place_id]} />)}
    <SocialState loading={feed.loading} error={feed.error} offline={feed.offline} empty={false} onRetry={feed.refresh} hasMore={feed.hasMore} loadingMore={feed.loadingMore} onMore={feed.loadMore} />
  </Screen>;
}

function QuickAction({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.quickAction, pressed && styles.pressed]}>
    <ThemedText style={styles.quickIcon}>{icon}</ThemedText>
    <ThemedText style={styles.quickLabel}>{label}</ThemedText>
  </Pressable>;
}

const styles = StyleSheet.create({
  quickActions: { gap: 10, paddingRight: 18 },
  quickAction: { minWidth: 110, minHeight: 72, borderRadius: 22, paddingHorizontal: 14, paddingVertical: 12, gap: 4, backgroundColor: '#F3F4F6' },
  quickIcon: { fontSize: 20, lineHeight: 22 },
  quickLabel: { fontSize: 13, lineHeight: 17, fontWeight: '700' },
  pressed: { opacity: 0.7, transform: [{ scale: 0.98 }] },
});
