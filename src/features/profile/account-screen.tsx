import { useState } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { Button, Card, Screen } from '@/components/foundation';
import { ThemedText } from '@/components/themed-text';
import { SocialField } from '@/features/social/components';
import { useNetworkStatus } from '@/features/social/hooks';
import { useProfile } from '@/providers/profile-provider';
import { accountError, matchesDeletionConfirmation } from './account-model';
import { deleteCurrentAccount } from './account-service';
import { PushSettings } from '@/features/notifications/push-settings';
import { useAuth } from '@/providers/auth-provider';

export default function AccountScreen() {
  const { profile } = useProfile();
  const { session } = useAuth();
  const { offline } = useNetworkStatus();
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const username = profile?.username ?? '';
  const matches = matchesDeletionConfirmation(username, confirmation);

  const remove = () => Alert.alert(
    'Permanently delete account?',
    'Your profile, friendships, ratings, saved places, posts, comments and likes will be deleted. This cannot be undone. App Store subscriptions must be cancelled separately.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete account', style: 'destructive', onPress: () => {
        setBusy(true); setError('');
        void deleteCurrentAccount(confirmation).catch((reason) => setError(accountError(reason))).finally(() => setBusy(false));
      } },
    ],
  );

  return <Screen title="Account & Privacy" headerDescription="Account & Privacy">
    <Button label="Back" onPress={() => router.canGoBack() ? router.back() : router.replace('/profile')} />
    <Card>
      <ThemedText type="subtitle">Privacy and sharing</ThemedText>
      <ThemedText themeColor="textSecondary">Control whether people can find you and which ratings are shared with friends.</ThemedText>
      <Button label="Open privacy settings" onPress={() => router.push('/feed/privacy')} />
    </Card>
    <PushSettings />
    <Card>
      <ThemedText type="subtitle">Legal</ThemedText>
      <ThemedText themeColor="textSecondary">Review how OutThere handles information and the rules for using social features.</ThemedText>
      <Button label="Privacy Policy" onPress={() => router.push('/profile/privacy-policy')} />
      <Button label="Terms of Use" onPress={() => router.push('/profile/terms')} />
    </Card>
    {(session?.user.app_metadata?.role === 'moderator' || session?.user.app_metadata?.is_moderator === true) && <Card>
      <ThemedText type="subtitle">Safety team</ThemedText>
      <Button label="Open moderation queue" onPress={() => router.push('/profile/moderation')} />
    </Card>}
    <Card>
      <ThemedText type="subtitle">Delete account</ThemedText>
      <ThemedText themeColor="textSecondary">This permanently removes your OutThere account and app data. It does not cancel an App Store or Play Store subscription.</ThemedText>
      <ThemedText type="small">Type <ThemedText type="smallBold">{username}</ThemedText> to confirm.</ThemedText>
      <SocialField accessibilityLabel="Confirm username for account deletion" autoCapitalize="none" autoCorrect={false} value={confirmation} onChangeText={setConfirmation} placeholder={username} />
      {offline && <ThemedText accessibilityRole="alert" themeColor="textSecondary">You’re offline. Reconnect before deleting your account.</ThemedText>}
      {!!error && <ThemedText accessibilityRole="alert" style={{ color: '#9A3412' }}>{error}</ThemedText>}
      <Button disabled={!matches || busy || offline} label={busy ? 'Deleting account…' : 'Delete my account'} onPress={remove} />
    </Card>
  </Screen>;
}
