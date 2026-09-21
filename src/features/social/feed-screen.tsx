import { useCallback } from 'react';
import { router } from 'expo-router';
import { Button, Card, Screen } from '@/components/foundation';
import { ThemedText } from '@/components/themed-text';
import { SectionHeading } from '@/components/ui-system';
import { SocialPostCard, SocialState, usePostPlaces } from './components';
import { useSocialList, useSocialQuery, useUnreadNotificationsCount } from './hooks';
import type { SocialPost, SocialSettings } from './types';

export default function SocialFeedScreen() {
  const settings = useSocialQuery<SocialSettings>('settings');
  const feed = useSocialList<SocialPost>('feed');
  const places = usePostPlaces(feed.items);
  const { unreadCount, setUnreadCount } = useUnreadNotificationsCount();

  const handleNotifications = useCallback(() => {
    setUnreadCount(0);
    router.push('/feed/notifications');
  }, [setUnreadCount]);

  return <Screen
    title="Friends Feed"
    headerDescription="Friends Feed"
    onFindPeople={() => router.push('/feed/people')}
    onNotifications={handleNotifications}
    notificationsCount={unreadCount}
  >
    <SectionHeading eyebrow="Your circle" title="What your friends loved" />
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
