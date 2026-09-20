import { router } from 'expo-router';
import { Button, Card, Screen } from '@/components/foundation';
import { ThemedText } from '@/components/themed-text';
import { PersonRow, SocialBack, SocialError, SocialState } from './components';
import { useSocialList, useSocialMutation } from './hooks';
import { notificationMessage } from './model';
import type { SocialNotification } from './types';

export default function NotificationsScreen() {
  const list = useSocialList<SocialNotification>('notifications');
  const mutation = useSocialMutation();
  const open = async (item: SocialNotification) => {
    if (!item.read && !await mutation.run('mark_read', { id: item.id })) return;
    router.push(item.post_id ? { pathname: '/feed/post/[id]', params: { id: item.post_id } } : { pathname: '/feed/person/[id]', params: { id: item.actor.id } });
  };
  return <Screen title="Notifications" headerDescription="Notifications">
    <SocialBack />
    <SocialError message={mutation.error} />
    {list.items.map((item) => <Card key={item.id}>
      <PersonRow person={item.actor} />
      <ThemedText>{item.read ? '' : '● '}{item.actor.name} {notificationMessage(item.kind)}.</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">{new Date(item.created_at).toLocaleString()}</ThemedText>
      <Button disabled={mutation.busy} label={item.post_id ? 'View conversation' : 'View profile'} onPress={() => void open(item)} />
      {!item.read && <Button disabled={mutation.busy} label="Mark as read" onPress={() => void mutation.run('mark_read', { id: item.id })} />}
    </Card>)}
    <SocialState loading={list.loading} error={list.error} empty={!list.items.length} onRetry={list.refresh} hasMore={list.hasMore} loadingMore={list.loadingMore} onMore={list.loadMore} />
  </Screen>;
}
