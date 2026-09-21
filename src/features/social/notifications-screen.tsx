import { useEffect, useRef } from 'react';
import { router } from 'expo-router';
import { Button, Card, Screen } from '@/components/foundation';
import { ThemedText } from '@/components/themed-text';
import { PersonRow, SocialError, SocialState } from './components';
import { markAllNotificationsRead } from './api';
import { useSocialList, useSocialMutation } from './hooks';
import { notificationMessage } from './model';
import type { SocialNotification } from './types';
import { SectionHeading } from '@/components/ui-system';

function groupLabel(dateValue: string) {
  const date = new Date(dateValue); const now = new Date();
  if (date.toDateString() === now.toDateString()) return 'Today';
  const days = (now.getTime() - date.getTime()) / 86_400_000;
  return days < 7 ? 'This week' : 'Earlier';
}

export default function NotificationsScreen() {
  const list = useSocialList<SocialNotification>('notifications');
  const mutation = useSocialMutation();
  const markedRef = useRef(new Set<string>());

  useEffect(() => {
    const unreadIds = list.items
      .filter((item) => !item.read && !markedRef.current.has(item.id))
      .map((item) => item.id);

    if (unreadIds.length > 0) {
      unreadIds.forEach((id) => markedRef.current.add(id));
      void markAllNotificationsRead(unreadIds);
    }
  }, [list.items]);

  const open = async (item: SocialNotification) => {
    if (!item.read && !markedRef.current.has(item.id)) {
      markedRef.current.add(item.id);
      void markAllNotificationsRead([item.id]);
    }
    router.push(item.post_id ? { pathname: '/feed/post/[id]', params: { id: item.post_id } } : { pathname: '/feed/person/[id]', params: { id: item.actor.id } });
  };

  return <Screen
    title="Notifications"
    headerDescription="Notifications"
    showBack
    onBack={() => (router.canGoBack() ? router.back() : router.replace('/feed'))}
  >
    <SocialError message={mutation.error} />
    {list.items.map((item, index) => {
      const isRead = item.read || markedRef.current.has(item.id);
      return (
        <Card key={item.id}>
          {index === 0 || groupLabel(list.items[index - 1].created_at) !== groupLabel(item.created_at)
            ? <SectionHeading title={groupLabel(item.created_at)} /> : null}
          <PersonRow person={item.actor} />
          <ThemedText>{isRead ? '' : '● '}{item.actor.name} {notificationMessage(item.kind)}.</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">{new Date(item.created_at).toLocaleString()}</ThemedText>
          <Button disabled={mutation.busy} label={item.post_id ? 'View conversation' : 'View profile'} onPress={() => void open(item)} />
          {!isRead && <Button disabled={mutation.busy} label="Mark as read" onPress={() => void mutation.run('mark_read', { id: item.id })} />}
        </Card>
      );
    })}
    <SocialState loading={list.loading} error={list.error} offline={list.offline} empty={!list.items.length} emptyTitle="No notifications yet" emptyMessage="Friend requests, likes and comments will appear here." onRetry={list.refresh} hasMore={list.hasMore} loadingMore={list.loadingMore} onMore={list.loadMore} />
  </Screen>;
}
