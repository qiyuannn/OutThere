import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { Button, Card, Screen } from '@/components/foundation';
import { ThemedText } from '@/components/themed-text';
import { SocialError, SocialState } from './components';
import { useSocialMutation, useSocialQuery } from './hooks';
import type { SocialSettings, SocialVisibility } from './types';

export default function PrivacyScreen() {
  const settings = useSocialQuery<SocialSettings>('settings');
  const mutation = useSocialMutation();
  const [enabled, setEnabled] = useState(false);
  const [visibility, setVisibility] = useState<SocialVisibility>('private');
  useEffect(() => { if (settings.data) { setEnabled(settings.data.enabled); setVisibility(settings.data.default_visibility); } }, [settings.data]);

  const save = () => {
    const apply = async () => {
      if (await mutation.run('settings_update', { enabled, default_visibility: enabled ? visibility : 'private' })) await settings.refresh();
    };
    if (!enabled && settings.data?.enabled) {
      Alert.alert('Disable social profile?', 'Your shared ratings become private and friendships stop exposing activity.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Disable', style: 'destructive', onPress: () => void apply() }]);
    } else void apply();
  };

  return <Screen title="Privacy & Sharing" headerDescription="Privacy & Sharing" showBack onBack={() => (router.canGoBack() ? router.back() : router.replace('/profile/account'))}>
    <SocialState loading={settings.loading} error={settings.error} offline={settings.offline} empty={false} onRetry={settings.refresh} />
    {settings.data && <>
      <Card>
        <ThemedText type="subtitle">Social profile</ThemedText>
        <ThemedText themeColor="textSecondary">When enabled, signed-in people can find your name, username, photo and bio. Private profile details and saved places remain private.</ThemedText>
        <Button label={`${enabled ? '✓ ' : ''}Enabled`} onPress={() => setEnabled(true)} />
        <Button label={`${!enabled ? '✓ ' : ''}Disabled`} onPress={() => setEnabled(false)} />
      </Card>
      <Card>
        <ThemedText type="subtitle">Default rating audience</ThemedText>
        <Button label={`${visibility === 'private' ? '✓ ' : ''}Only me`} onPress={() => setVisibility('private')} />
        <Button disabled={!enabled} label={`${visibility === 'friends' ? '✓ ' : ''}Friends`} onPress={() => setVisibility('friends')} />
        <ThemedText type="small" themeColor="textSecondary">You can change the audience for each rating. Existing ratings keep their current audience.</ThemedText>
      </Card>
      <Button disabled={mutation.busy} label={mutation.busy ? 'Saving…' : 'Save privacy settings'} onPress={save} />
    </>}
    <SocialError message={mutation.error} />
  </Screen>;
}
