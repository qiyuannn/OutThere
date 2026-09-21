import { router } from 'expo-router';
import { Screen } from '@/components/foundation';
import { PushSettings } from './push-settings';

export default function NotificationsScreen() {
  return (
    <Screen
      title="Notifications"
      headerDescription="Notifications"
      showBack
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/profile/account'))}
    >
      <PushSettings />
    </Screen>
  );
}
