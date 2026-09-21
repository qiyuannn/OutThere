import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, Card, Screen } from '@/components/foundation';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { PersonRow, SocialError, SocialField, SocialState } from './components';
import { useSocialList, useSocialMutation } from './hooks';
import type { SocialPerson } from './types';

type PeopleMode = 'search' | 'friends' | 'incoming' | 'outgoing' | 'blocked';
const labels: Record<PeopleMode, string> = { search: 'Search', friends: 'Friends', incoming: 'Requests', outgoing: 'Sent', blocked: 'Blocked' };

export default function PeopleScreen() {
  const theme = useTheme();
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

  return <Screen
    title="Find People"
    headerDescription="Find People"
    showBack
    onBack={() => (router.canGoBack() ? router.back() : router.replace('/feed'))}
  >
    <View style={styles.modesRow} accessibilityRole="tablist">
      {(Object.keys(labels) as PeopleMode[]).map((value) => {
        const isSelected = mode === value;
        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: isSelected }}
            key={value}
            onPress={() => setMode(value)}
            style={[
              styles.mode,
              {
                backgroundColor: isSelected ? theme.text : theme.backgroundSelected,
                borderColor: isSelected ? theme.text : theme.border,
              },
            ]}
          >
            <ThemedText
              style={[
                styles.modeLabel,
                { color: isSelected ? theme.backgroundElement : theme.textSecondary },
              ]}
            >
              {labels[value]}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
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
  modesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
    marginVertical: 4,
  },
  mode: {
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
  },
});
