import { router } from 'expo-router';
import { Button, Card } from '@/components/foundation';
import { ThemedText } from '@/components/themed-text';
import { useSubscription } from '@/providers/subscription-provider';
export function SubscriptionCard() {
  const { isPro, ready, unavailable } = useSubscription();
  return <Card><ThemedText type="subtitle" style={{ fontSize: 24 }}>OutThere Pro</ThemedText>
    <ThemedText themeColor="textSecondary">{unavailable ?? (isPro ? 'Your Pro access is active.' : ready ? 'View membership options and manage your purchases.' : 'Check your membership and purchase options.')}</ThemedText>
    <Button label={isPro ? 'Manage membership' : 'View membership'} onPress={() => router.push('/profile/subscription')} />
  </Card>;
}
