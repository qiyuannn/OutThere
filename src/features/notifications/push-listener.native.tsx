import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

const allowed = /^\/feed\/(notifications|post\/[0-9a-f-]{36})$/i;
export function PushListener() {
  useEffect(() => Notifications.addNotificationResponseReceivedListener(response => {
    const path = response.notification.request.content.data?.path;
    if (typeof path === 'string' && allowed.test(path)) router.push(path as never);
  }).remove, []);
  return null;
}
