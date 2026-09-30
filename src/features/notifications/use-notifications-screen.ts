import { useCallback, useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';

import { routes } from '@/lib/routes';
import { useAuth } from '@/providers/auth-provider';
import { useNotifications } from '@/providers/notifications-provider';
import { partitionNotifications } from './model';
import { getUserNotifications } from './service';
import type { AppNotification } from './types';
import { useNotificationMutations } from './use-notification-mutations';

export interface NotificationSection {
  title: string;
  data: AppNotification[];
  isInvites: boolean;
}

export function useNotificationsScreen() {
  const { session } = useAuth();
  const currentUserId = session?.user.id;
  const { markAllRead } = useNotifications();

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestCount = useRef(0);
  const {
    followProcessing,
    inviteProcessing,
    followRespondProcessing,
    handleToggleFollow,
    handleRespondInvite,
    handleRespondFollow,
  } = useNotificationMutations(currentUserId, setNotifications);

  const loadNotifications = useCallback(async () => {
    if (!currentUserId) {
      setLoading(false);
      return;
    }
    const reqId = ++requestCount.current;
    setError(null);
    try {
      const items = await getUserNotifications(50, 0);
      if (reqId === requestCount.current) {
        setNotifications(items);
        void markAllRead();
      }
    } catch (err) {
      if (reqId === requestCount.current) {
        setError(err instanceof Error ? err.message : 'Could not load notifications.');
      }
    } finally {
      if (reqId === requestCount.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [currentUserId, markAllRead]);

  useEffect(() => {
    void loadNotifications();
    return () => {
      requestCount.current += 1;
    };
  }, [loadNotifications]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadNotifications();
  }, [loadNotifications]);

  const handlePressNotification = (item: AppNotification) => {
    if (item.type === 'follow' || item.type === 'follow_accepted') {
      if (item.actorId) router.push(routes.userProfile(item.actorId));
      return;
    }
    if (item.type === 'invite' || item.type === 'invite_accepted' || item.type === 'invite_declined') {
      if (item.googlePlaceId) {
        router.push(routes.placeDetails(item.googlePlaceId));
      } else if (item.actorId) {
        router.push(routes.userProfile(item.actorId));
      }
      return;
    }
    if (item.postId) {
      router.push(routes.postComments(item.postId));
    }
  };

  const { invites, regular } = partitionNotifications(notifications);
  const sections: NotificationSection[] = [
    ...(invites.length > 0 ? [{ title: 'Invites', data: invites, isInvites: true }] : []),
    ...(regular.length > 0 || invites.length === 0
      ? [{ title: invites.length > 0 ? 'Notifications' : '', data: regular, isInvites: false }]
      : []),
  ];

  return {
    notifications,
    loading,
    refreshing,
    error,
    sections,
    invitesCount: invites.length,
    inviteProcessing,
    followProcessing,
    followRespondProcessing,
    loadNotifications,
    handleRefresh,
    handleToggleFollow,
    handleRespondInvite,
    handleRespondFollow,
    handlePressNotification,
  };
}
