import { useState } from 'react';
import { Alert, Platform } from 'react-native';
import { router } from 'expo-router';
import { Button, Card, Screen } from '@/components/foundation';
import { ThemedText } from '@/components/themed-text';
import { SocialField } from '@/features/social/components';
import { disablePush } from '@/features/notifications/push-service';
import { useNetworkStatus } from '@/features/social/hooks';
import { useProfile } from '@/providers/profile-provider';
import { supabase } from '@/lib/supabase';
import { authErrorMessage } from '@/lib/auth-validation';
import { accountError, matchesDeletionConfirmation } from './account-model';
import { deleteCurrentAccount } from './account-service';

export default function ManageAccountScreen() {
  const { profile } = useProfile();
  const { offline } = useNetworkStatus();

  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const username = profile?.username ?? '';
  const matches = matchesDeletionConfirmation(username, confirmation);

  const performSignOut = async () => {
    if (!supabase) return;
    setBusy(true);
    setError('');
    try {
      try { await disablePush(); } catch { /* Ignore token cleanup failure */ }
      const result = await supabase.auth.signOut({ scope: 'local' });
      if (result.error) throw result.error;
      router.replace('/auth');
    } catch (reason) {
      setError(authErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  };

  const handleAddAccount = () => {
    const question = 'You will be signed out of your current account so you can sign in to or register another account. Do you want to proceed?';
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(question)) {
        void performSignOut();
      }
      return;
    }
    Alert.alert(
      'Add another account',
      question,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes',
          onPress: () => { void performSignOut(); },
        },
      ],
    );
  };

  const handleSignOut = () => {
    const question = 'Are you sure you really want to sign out?';
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(question)) {
        void performSignOut();
      }
      return;
    }
    Alert.alert(
      'Sign out',
      question,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes',
          style: 'destructive',
          onPress: () => { void performSignOut(); },
        },
      ],
    );
  };

  const remove = () => {
    const question = 'Your profile, friendships, ratings, saved places, posts, comments and likes will be deleted. This cannot be undone. App Store subscriptions must be cancelled separately.';
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(`Permanently delete account?\n\n${question}`)) {
        setBusy(true);
        setError('');
        void deleteCurrentAccount(confirmation)
          .catch((reason) => setError(accountError(reason)))
          .finally(() => setBusy(false));
      }
      return;
    }
    Alert.alert(
      'Permanently delete account?',
      question,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: () => {
            setBusy(true);
            setError('');
            void deleteCurrentAccount(confirmation)
              .catch((reason) => setError(accountError(reason)))
              .finally(() => setBusy(false));
          },
        },
      ],
    );
  };

  return (
    <Screen
      title="Account"
      headerDescription="Account"
      showBack
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/profile/account'))}
    >
      <Card>
        <ThemedText type="subtitle">Add another account</ThemedText>
        <ThemedText themeColor="textSecondary">
          Sign in with a different OutThere account or create a new one to switch accounts.
        </ThemedText>
        <Button
          disabled={busy}
          label="Add another account"
          onPress={handleAddAccount}
        />
      </Card>

      <Card>
        <ThemedText type="subtitle">Sign out</ThemedText>
        <ThemedText themeColor="textSecondary">
          Sign out of {username ? `@${username}` : 'your account'} on this device. You can sign back in anytime.
        </ThemedText>
        <Button
          disabled={busy}
          label="Sign out"
          onPress={handleSignOut}
        />
      </Card>

      <Card>
        <ThemedText type="subtitle" style={{ color: '#DC2626' }}>Delete account</ThemedText>
        <ThemedText themeColor="textSecondary">
          This permanently removes your OutThere account and app data. It does not cancel an App Store or Play Store subscription.
        </ThemedText>
        <ThemedText type="small">
          Type <ThemedText type="smallBold">{username}</ThemedText> to confirm.
        </ThemedText>
        <SocialField
          accessibilityLabel="Confirm username for account deletion"
          autoCapitalize="none"
          autoCorrect={false}
          value={confirmation}
          onChangeText={setConfirmation}
          placeholder={username}
        />
        {offline && (
          <ThemedText accessibilityRole="alert" themeColor="textSecondary">
            You’re offline. Reconnect before deleting your account.
          </ThemedText>
        )}
        {!!error && (
          <ThemedText accessibilityRole="alert" style={{ color: '#9A3412' }}>
            {error}
          </ThemedText>
        )}
        <Button
          disabled={!matches || busy || offline}
          label={busy ? 'Deleting account…' : 'Delete my account'}
          onPress={remove}
        />
      </Card>
    </Screen>
  );
}
