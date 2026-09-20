import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { router } from 'expo-router';
import { Button, Card } from '@/components/foundation';
import { ThemedText } from '@/components/themed-text';
import { Avatar } from '@/features/profile/components/avatar';
import { ScoreBadge } from '@/features/rankings/components/score-badge';
import { getLivePlaceDetails } from '@/features/search/service';
import type { SearchPlace } from '@/features/search/model';
import { useTheme } from '@/hooks/use-theme';
import { useSocialMutation } from './hooks';
import type { SocialPerson, SocialPost } from './types';

export function SocialField(props: TextInputProps) {
  const theme = useTheme();
  return <TextInput {...props} placeholderTextColor={theme.textSecondary} style={[styles.field, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundElement }, props.style]} />;
}

export function SocialError({ message }: { message: string }) {
  return message ? <ThemedText accessibilityRole="alert" style={styles.error}>{message}</ThemedText> : null;
}

export function SocialState({ loading, error, empty, onRetry, hasMore, loadingMore, onMore }: { loading: boolean; error: string; empty: boolean; onRetry: () => void; hasMore?: boolean; loadingMore?: boolean; onMore?: () => void }) {
  if (loading) return <ActivityIndicator accessibilityLabel="Loading social activity" color="#000000" />;
  if (error) return <Card><SocialError message={error} /><Button label="Try again" onPress={onRetry} /></Card>;
  if (empty) return <ThemedText themeColor="textSecondary">Nothing to show yet.</ThemedText>;
  if (hasMore && onMore) return <Button disabled={loadingMore} label={loadingMore ? 'Loading…' : 'Load more'} onPress={onMore} />;
  return null;
}

export function SocialBack() {
  return <Button label="Back" onPress={() => router.canGoBack() ? router.back() : router.replace('/feed')} />;
}

export function PersonRow({ person, open = true }: { person: SocialPerson; open?: boolean }) {
  const content = <View style={styles.personRow}>
    <Avatar name={person.name} path={person.avatar_path} size={44} />
    <View style={styles.personCopy}>
      <ThemedText type="smallBold" numberOfLines={1}>{person.name}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>@{person.username}</ThemedText>
    </View>
  </View>;
  if (!open) return content;
  return <Pressable accessibilityRole="button" accessibilityLabel={`Open ${person.name}'s profile`} onPress={() => router.push({ pathname: '/feed/person/[id]', params: { id: person.id } })}>{content}</Pressable>;
}

export function usePostPlaces(posts: SocialPost[]) {
  const [places, setPlaces] = useState<Record<string, SearchPlace>>({});
  const ids = [...new Set(posts.map((post) => post.google_place_id))];
  const key = ids.join('|');
  useEffect(() => {
    let active = true;
    if (!ids.length) { setPlaces({}); return () => { active = false; }; }
    void getLivePlaceDetails(ids).then((result) => {
      if (active) setPlaces(Object.fromEntries(result));
    }).catch(() => { if (active) setPlaces({}); });
    return () => { active = false; };
  // IDs are represented by the stable key.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return places;
}

export function SocialPostCard({ post, place, detail = false }: { post: SocialPost; place?: SearchPlace; detail?: boolean }) {
  const mutation = useSocialMutation();
  const openPlace = () => router.push({ pathname: '/search/[id]', params: { id: post.google_place_id, mode: post.mode } });
  return <Card>
    <PersonRow person={post.author} />
    <Pressable accessibilityRole="button" onPress={openPlace} style={styles.postPlace}>
      <View style={styles.postCopy}>
        <ThemedText type="smallBold" numberOfLines={2}>{place?.name ?? 'Loading place…'}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>{place?.address ?? post.mode}</ThemedText>
      </View>
      <ScoreBadge score={Number(post.score)} size="small" />
    </Pressable>
    {!!post.notes && <ThemedText>{post.notes}</ThemedText>}
    <ThemedText type="small" themeColor="textSecondary">{new Date(post.created_at).toLocaleString()} · {post.visibility === 'friends' ? 'Friends' : 'Only me'}</ThemedText>
    <View style={styles.actions}>
      <Button disabled={mutation.busy} label={`${post.liked ? 'Unlike' : 'Like'} · ${post.like_count}`} onPress={() => void mutation.run(post.liked ? 'unlike' : 'like', { post_id: post.id })} />
      {!detail && <Button label={`Comments · ${post.comment_count}`} onPress={() => router.push({ pathname: '/feed/post/[id]', params: { id: post.id } })} />}
    </View>
    <SocialError message={mutation.error} />
  </Card>;
}

const styles = StyleSheet.create({
  field: { minHeight: 44, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, fontSize: 14 },
  error: { color: '#9A3412', fontSize: 12 },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  personCopy: { flex: 1, minWidth: 0 },
  postPlace: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  postCopy: { flex: 1, minWidth: 0 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
