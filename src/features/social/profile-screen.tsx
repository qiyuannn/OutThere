import { Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Card, Screen } from '@/components/foundation';
import { ThemedText } from '@/components/themed-text';
import { PersonRow, SocialBack, SocialError, SocialPostCard, SocialState, usePostPlaces } from './components';
import { useSocialList, useSocialMutation, useSocialQuery } from './hooks';
import type { SocialPost, SocialProfile } from './types';

export default function SocialProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const profile = useSocialQuery<SocialProfile>('profile', { user_id: id }, !!id);
  const feed = useSocialList<SocialPost>('feed', { user_id: id }, !!profile.data);
  const places = usePostPlaces(feed.items);
  const mutation = useSocialMutation();
  const relationship = profile.data?.relationship;

  const run = async (action: 'request' | 'accept' | 'decline' | 'cancel') => {
    if (await mutation.run(action, { user_id: id })) await profile.refresh();
  };
  const confirm = (action: 'remove_friend' | 'block') => Alert.alert(action === 'block' ? 'Block this person?' : 'Remove friend?', action === 'block' ? 'You will no longer find each other or see shared activity.' : 'You will no longer see each other’s friends-only ratings.', [
    { text: 'Cancel', style: 'cancel' },
    { text: action === 'block' ? 'Block' : 'Remove', style: 'destructive', onPress: () => { void mutation.run(action, { user_id: id }).then((ok) => { if (ok) router.replace('/feed/people'); }); } },
  ]);

  return <Screen title="Social Profile" headerDescription="Social Profile">
    <SocialBack />
    <SocialState loading={profile.loading} error={profile.error} empty={false} onRetry={profile.refresh} />
    {profile.data && <Card>
      <PersonRow person={profile.data.person} open={false} />
      {!!profile.data.person.bio && <ThemedText>{profile.data.person.bio}</ThemedText>}
      {relationship === 'none' && <Button disabled={mutation.busy} label="Send friend request" onPress={() => void run('request')} />}
      {relationship === 'incoming' && <><Button disabled={mutation.busy} label="Accept request" onPress={() => void run('accept')} /><Button disabled={mutation.busy} label="Decline request" onPress={() => void run('decline')} /></>}
      {relationship === 'outgoing' && <Button disabled={mutation.busy} label="Cancel request" onPress={() => void run('cancel')} />}
      {relationship === 'friends' && <Button disabled={mutation.busy} label="Remove friend" onPress={() => confirm('remove_friend')} />}
      {relationship && relationship !== 'self' && <Button disabled={mutation.busy} label="Block person" onPress={() => confirm('block')} />}
    </Card>}
    <SocialError message={mutation.error} />
    {feed.items.map((post) => <SocialPostCard key={post.id} post={post} place={places[post.google_place_id]} />)}
    {!!profile.data && <SocialState loading={feed.loading} error={feed.error} empty={!feed.items.length} onRetry={feed.refresh} hasMore={feed.hasMore} loadingMore={feed.loadingMore} onMore={feed.loadMore} />}
  </Screen>;
}
