import { useCallback, useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Button, Card, EmptyState, Screen } from '@/components/foundation';
import { ThemedText } from '@/components/themed-text';
import { SocialField } from '@/features/social/components';
import { listReports, resolveReport } from './api';
import type { ModerationReport, ModerationResolution, ModerationStatus } from './types';

function ReportCard({ item, onResolved }: { item: ModerationReport; onResolved: () => void }) {
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const decide = async (resolution: ModerationResolution) => {
    setBusy(true); setError('');
    try { await resolveReport(item.id, resolution, notes.trim()); onResolved(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'The decision could not be saved.'); }
    finally { setBusy(false); }
  };
  return <Card>
    <ThemedText type="subtitle">{item.target_type} · {item.reason}</ThemedText>
    <ThemedText type="small" themeColor="textSecondary">Reported {new Date(item.created_at).toLocaleString()}</ThemedText>
    {!!item.details && <ThemedText>{item.details}</ThemedText>}
    <ThemedText type="small" themeColor="textSecondary">Evidence: {JSON.stringify(item.context)}</ThemedText>
    {item.status === 'open' ? <>
      <SocialField accessibilityLabel="Private moderator notes" maxLength={2000} multiline value={notes} onChangeText={setNotes} placeholder="Private moderator notes" />
      <Button disabled={busy} label="Dismiss report" onPress={() => void decide('dismiss')} />
      {item.target_type !== 'user' && <Button disabled={busy} label="Remove reported content" onPress={() => void decide('remove_content')} />}
      <Button disabled={busy || !notes.trim()} label="Suspend user’s social access" onPress={() => void decide('suspend_user')} />
      {!!error && <ThemedText accessibilityRole="alert" style={{ color: '#9A3412' }}>{error}</ThemedText>}
    </> : <ThemedText>Decision: {item.resolution?.replace('_', ' ') ?? item.status}</ThemedText>}
  </Card>;
}

export default function ModerationScreen() {
  const [status, setStatus] = useState<ModerationStatus>('open');
  const [reports, setReports] = useState<ModerationReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { const next = await listReports(status); setReports(next.slice(0, 20)); setHasMore(next.length > 20); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'The moderation queue could not be loaded.'); }
    finally { setLoading(false); }
  }, [status]);
  const more = async () => {
    setLoadingMore(true); setError('');
    try {
      const next = await listReports(status, reports.length);
      setReports(current => [...current, ...next.slice(0, 20)]);
      setHasMore(next.length > 20);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'More reports could not be loaded.'); }
    finally { setLoadingMore(false); }
  };
  useEffect(() => { void load(); }, [load]);
  return <Screen title="Moderation" headerDescription="Moderation">
    <Button label="Back" onPress={() => router.canGoBack() ? router.back() : router.replace('/profile/account')} />
    <Card>
      <ThemedText type="subtitle">Review queue</ThemedText>
      <ThemedText themeColor="textSecondary">Evidence and notes are private. Removal and suspension decisions are recorded in an audit log.</ThemedText>
      <Button label="Open reports" onPress={() => setStatus('open')} />
      <Button label="Actioned reports" onPress={() => setStatus('actioned')} />
      <Button label="Dismissed reports" onPress={() => setStatus('dismissed')} />
    </Card>
    {loading && <ThemedText>Loading reports…</ThemedText>}
    {!!error && <Card><ThemedText accessibilityRole="alert" style={{ color: '#9A3412' }}>{error}</ThemedText><Button label="Try again" onPress={() => void load()} /></Card>}
    {!loading && !error && reports.map(item => <ReportCard key={item.id} item={item} onResolved={() => void load()} />)}
    {!loading && !error && !reports.length && <EmptyState title="Queue is clear" description={`There are no ${status} reports.`} />}
    {!loading && hasMore && <Button disabled={loadingMore} label={loadingMore ? 'Loading…' : 'Load more reports'} onPress={() => void more()} />}
  </Screen>;
}
