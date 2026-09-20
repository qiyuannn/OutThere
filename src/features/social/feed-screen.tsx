import { router } from 'expo-router';
import { Button, Card, Screen } from '@/components/foundation';
import { ThemedText } from '@/components/themed-text';
import { SocialPostCard, SocialState, usePostPlaces } from './components';
import { useSocialList, useSocialQuery } from './hooks';
import type { SocialPost, SocialSettings } from './types';

export default function SocialFeedScreen() {
  const settings = useSocialQuery<SocialSettings>('settings');
  const feed = useSocialList<SocialPost>('feed');
  const places = usePostPlaces(feed.items);
  return <Screen title="Friends Feed" headerDescription="Friends Feed">
    <Button label="Find people & manage friends" onPress={() => router.push('/feed/people')} />
    <Button label="Notifications" onPress={() => router.push('/feed/notifications')} />
    <Button label="Privacy & sharing" onPress={() => router.push('/feed/privacy')} />
    {settings.data && !settings.data.enabled && <Card>
      <ThemedText type="subtitle">Enable your social profile</ThemedText>
      <ThemedText themeColor="textSecondary">People can only find you after you opt in. Your existing ratings remain private.</ThemedText>
      <Button label="Set up social sharing" onPress={() => router.push('/feed/privacy')} />
    </Card>}
    {!feed.loading && !feed.error && !feed.items.length && <Card>
      <ThemedText type="subtitle">Your next find starts with a friend.</ThemedText>
      <ThemedText themeColor="textSecondary">Add friends and share a rating with Friends to start the feed.</ThemedText>
      <Button label="Open my rankings" onPress={() => router.push('/rankings')} />
    </Card>}
    {feed.items.map((post) => <SocialPostCard key={post.id} post={post} place={places[post.google_place_id]} />)}
    <SocialState loading={feed.loading} error={feed.error} empty={false} onRetry={feed.refresh} hasMore={feed.hasMore} loadingMore={feed.loadingMore} onMore={feed.loadMore} />
  </Screen>;
}
