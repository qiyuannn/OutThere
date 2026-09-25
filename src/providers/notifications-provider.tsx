import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { supabase } from '@/lib/supabase';
import {
  getUnreadNotificationCount,
  markNotificationsRead,
} from '@/features/notifications/service';
import { useAuth } from './auth-provider';

interface NotificationsContextValue {
  unreadCount: number;
  refreshUnreadCount: () => Promise<void>;
  markAllRead: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextValue>({
  unreadCount: 0,
  refreshUnreadCount: async () => {},
  markAllRead: async () => {},
});

export function NotificationsProvider({ children }: PropsWithChildren) {
  const { session } = useAuth();
  const userId = session?.user.id;

  return (
    <NotificationsSession key={userId ?? 'guest'} userId={userId}>
      {children}
    </NotificationsSession>
  );
}

function NotificationsSession({
  children,
  userId,
}: PropsWithChildren<{ userId?: string }>) {
  const [unreadCount, setUnreadCount] = useState(0);
  const mounted = useRef(true);

  const refreshUnreadCount = useCallback(async () => {
    if (!userId) {
      setUnreadCount(0);
      return;
    }
    try {
      const count = await getUnreadNotificationCount();
      if (mounted.current) {
        setUnreadCount(count);
      }
    } catch {
      // Ignore background refresh errors
    }
  }, [userId]);

  const markAllRead = useCallback(async () => {
    if (!userId) return;
    setUnreadCount(0);
    try {
      await markNotificationsRead();
    } catch {
      void refreshUnreadCount();
    }
  }, [userId, refreshUnreadCount]);

  useEffect(() => {
    mounted.current = true;
    if (!userId) {
      setUnreadCount(0);
      return;
    }

    void refreshUnreadCount();

    if (!supabase) return;

    const channel = supabase
      .channel(`user-notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void refreshUnreadCount();
        }
      )
      .subscribe();

    return () => {
      mounted.current = false;
      void supabase?.removeChannel(channel);
    };
  }, [userId, refreshUnreadCount]);

  return (
    <NotificationsContext.Provider
      value={{
        unreadCount,
        refreshUnreadCount,
        markAllRead,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationsContext);
}
