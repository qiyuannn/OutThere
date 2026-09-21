import { router } from 'expo-router';
import { Button, Card, Screen } from '@/components/foundation';
import { ThemedText } from '@/components/themed-text';

export default function LegalHubScreen() {
  return (
    <Screen
      title="Legal"
      headerDescription="Legal"
      showBack
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/profile/account'))}
    >
      <Card>
        <ThemedText type="subtitle">Policies & Terms</ThemedText>
        <ThemedText themeColor="textSecondary">
          Review how OutThere handles your information and the rules for using social and place discovery features.
        </ThemedText>
        <Button label="Privacy Policy" onPress={() => router.push('/profile/privacy-policy')} />
        <Button label="Terms of Use" onPress={() => router.push('/profile/terms')} />
      </Card>
    </Screen>
  );
}
