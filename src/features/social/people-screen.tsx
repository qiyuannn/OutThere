import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Screen } from '@/components/foundation';
import { ThemedText } from '@/components/themed-text';
import { PersonRow, SocialBack, SocialError, SocialField, SocialState } from './components';
import { useSocialList, useSocialMutation } from './hooks';
import type { SocialPerson } from './types';

type PeopleMode = 'search' | 'friends' | 'incoming' | 'outgoing' | 'blocked';
const labels: Record<PeopleMode, string> = { search: 'Search', friends: 'Friends', incoming: 'Requests', outgoing: 'Sent', blocked: 'Blocked' };

export default function PeopleScreen() {
  const [mode, setMode] = useState<PeopleMode>('search');
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => { const timer = setTimeout(() => setDebounced(query.trim()), 300); return () => clearTimeout(timer); }, [query]);
  const search = mode === 'search';
  const list = useSocialList<SocialPerson>(search ? 'people' : 'connections', search ? { query: debounced } : { mode }, !search || debounced.length >= 2, true);
  const mutation = useSocialMutation();

  const act = async (action: 'accept' | 'decline' | 'cancel' | 'unblock', id: string) => {
    if (await mutation.run(action, { user_id: id })) await list.refresh();
  };

  return <Screen title="Friends" headerDescription="Friends">
    <SocialBack />
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modes}>
      {(Object.keys(labels) as PeopleMode[]).map((value) => <Pressable accessibilityRole="tab" accessibilityState={{ selected: mode === value }} key={value}
        onPress={() => setMode(value)} style={[styles.mode, mode === value && styles.selectedMode]}>
        <ThemedText style={[styles.modeLabel, mode === value && styles.selectedModeLabel]}>{labels[value]}</ThemedText>
      </Pressable>)}
    </ScrollView>
    {search && <>
      <SocialField accessibilityLabel="Search people" autoCapitalize="none" autoCorrect={false} maxLength={80} placeholder="Name or username" value={query} onChangeText={setQuery} />
      <ThemedText type="small" themeColor="textSecondary">Enter at least two characters. Only opted-in profiles appear.</ThemedText>
    </>}
    <SocialError message={mutation.error} />
    {list.items.map((person) => <Card key={person.id}>
      <PersonRow person={person} open={mode !== 'blocked'} />
      {mode === 'incoming' && <View style={{ gap: 8 }}><Button disabled={mutation.busy} label="Accept request" onPress={() => void act('accept', person.id)} /><Button disabled={mutation.busy} label="Decline request" onPress={() => void act('decline', person.id)} /></View>}
      {mode === 'outgoing' && <Button disabled={mutation.busy} label="Cancel request" onPress={() => void act('cancel', person.id)} />}
      {mode === 'blocked' && <Button disabled={mutation.busy} label="Unblock" onPress={() => void act('unblock', person.id)} />}
    </Card>)}
    <SocialState loading={list.loading} error={list.error} offline={list.offline} empty={list.items.length === 0 && (!search || debounced.length >= 2)} emptyTitle={search ? 'No matching people' : `No ${labels[mode].toLocaleLowerCase()}`} emptyMessage={search ? 'Try another name or username.' : mode === 'friends' ? 'Accepted friends will appear here.' : mode === 'incoming' ? 'New friend requests will appear here.' : mode === 'outgoing' ? 'Requests you send will appear here.' : 'People you block will appear here.'} onRetry={list.refresh} hasMore={list.hasMore} loadingMore={list.loadingMore} onMore={list.loadMore} />
  </Screen>;
}

const styles = StyleSheet.create({
  modes: { gap: 8, paddingRight: 16 },
  mode: { minHeight: 42, borderRadius: 21, paddingHorizontal: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F4F6' },
  selectedMode: { backgroundColor: '#000000' },
  modeLabel: { color: '#637068', fontSize: 13, lineHeight: 17, fontWeight: '700' },
  selectedModeLabel: { color: '#FFFFFF' },
});
