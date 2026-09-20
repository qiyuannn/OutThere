import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Card, Screen } from '@/components/foundation';
import { ThemedText } from '@/components/themed-text';
import { submitSocialReport } from './api';
import { SocialBack, SocialError, SocialField } from './components';
import { REPORT_REASONS, socialError, validReportTarget } from './model';
import { useNetworkStatus } from './hooks';
import type { ReportReason } from './types';

export default function ReportScreen() {
  const params = useLocalSearchParams<{ target?: string; id?: string }>();
  const { offline } = useNetworkStatus();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const target = validReportTarget(params.target) ? params.target : null;
  const valid = !!target && !!params.id;

  const submit = async () => {
    if (!valid || !reason || busy || offline) return;
    setBusy(true); setError('');
    try { await submitSocialReport(target!, params.id!, reason, details.trim()); setSent(true); }
    catch (failure) { setError(socialError(failure)); }
    finally { setBusy(false); }
  };

  return <Screen title="Report" headerDescription="Report">
    <SocialBack />
    {!valid ? <Card>
      <ThemedText type="subtitle">This content is unavailable.</ThemedText>
      <Button label="Return to Feed" onPress={() => router.replace('/feed')} />
    </Card> : sent ? <Card>
      <ThemedText type="subtitle">Report received</ThemedText>
      <ThemedText themeColor="textSecondary">Thanks for helping keep OutThere useful and respectful. You can also block the person from their profile.</ThemedText>
      <Button label="Done" onPress={() => router.canGoBack() ? router.back() : router.replace('/feed')} />
    </Card> : <>
      <Card>
        <ThemedText type="subtitle">Why are you reporting this {params.target}?</ThemedText>
        {REPORT_REASONS.map((item) => <Button key={item.value} label={`${reason === item.value ? '✓ ' : ''}${item.label}`} onPress={() => setReason(item.value)} />)}
      </Card>
      <Card>
        <ThemedText type="subtitle">More details</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">Optional. Don’t include passwords or private contact information.</ThemedText>
        <SocialField accessibilityLabel="Report details" maxLength={1000} multiline value={details} onChangeText={setDetails} placeholder="Describe what happened" />
        <ThemedText type="small" themeColor="textSecondary">{details.length}/1000</ThemedText>
      </Card>
      {offline && <Card><ThemedText accessibilityRole="alert">You’re offline. Reconnect to submit this report.</ThemedText></Card>}
      <SocialError message={error} />
      <Button disabled={!reason || busy || offline} label={busy ? 'Submitting…' : 'Submit report'} onPress={() => void submit()} />
    </>}
  </Screen>;
}
