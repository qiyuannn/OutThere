import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button, Card } from '@/components/foundation';
import { ThemedText } from '@/components/themed-text';
import { disablePush, enablePush, openNotificationSettings, pushState, type PushState } from './push-service';

export function PushSettings({ embedded = false }: { embedded?: boolean } = {}) {
  const [state, setState] = useState<PushState>('disabled');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    void pushState().then(async next => {
      // Refresh an already-approved token for the current signed-in account.
      setState(next === 'enabled' ? await enablePush() : next);
    }).catch(() => setState('disabled'));
  }, []);
  const run = async (action: () => Promise<PushState>) => {
    setBusy(true); setError('');
    try { setState(await action()); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Notification settings could not be updated.'); }
    finally { setBusy(false); }
  };

  const body = (
    <>
      {!embedded && <ThemedText type="subtitle">Push notifications</ThemedText>}
      <ThemedText themeColor="textSecondary">Get friend requests, likes and comments when OutThere is closed. Notification text never includes private rating notes.</ThemedText>
      {state === 'unavailable' && <ThemedText type="small" themeColor="textSecondary">Remote push notifications require a physical iPhone or Android device and an EAS project.</ThemedText>}
      {state === 'denied' && <ThemedText type="small" themeColor="textSecondary">Notifications are blocked in system settings.</ThemedText>}
      {!!error && <ThemedText accessibilityRole="alert" style={{ color: '#9A3412' }}>{error}</ThemedText>}
      {state === 'enabled'
        ? <Button disabled={busy} label={busy ? 'Updating…' : 'Turn off push notifications'} onPress={() => void run(disablePush)} />
        : state === 'denied'
          ? <Button label="Open system settings" onPress={() => void openNotificationSettings()} />
          : <Button disabled={busy || state === 'unavailable'} label={busy ? 'Enabling…' : 'Enable push notifications'} onPress={() => void run(enablePush)} />}
    </>
  );

  if (embedded) return <View style={{ gap: 12 }}>{body}</View>;
  return <Card>{body}</Card>;
}
