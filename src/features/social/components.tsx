import { useEffect, useState } from 'react';
import { Image } from 'expo-image';
import { ActivityIndicator, Pressable, Share, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { router } from 'expo-router';
import { Button, Card } from '@/components/foundation';
import { ThemedText } from '@/components/themed-text';
import { Avatar } from '@/features/profile/components/avatar';
import { ScoreBadge } from '@/features/rankings/components/score-badge';
import { getLivePlaceDetails } from '@/features/search/service';
import type { SearchPlace } from '@/features/search/model';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers/auth-provider';
import { useSocialMutation } from './hooks';
import type { SocialPerson, SocialPost } from './types';

const likeIcon = require('../../../assets/images/posts/thumbs-up.svg');
const commentIcon = require('../../../assets/images/posts/chat-dots.svg');
const shareIcon = require('../../../assets/images/posts/share-fat.svg');

export function SocialField(props: TextInputProps) {
  const theme = useTheme();
  return <TextInput {...props} placeholderTextColor={theme.textSecondary} style={[styles.field, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundElement }, props.style]} />;
}

export function SocialError({ message }: { message: string }) {
  return message ? <ThemedText accessibilityRole="alert" style={styles.error}>{message}</ThemedText> : null;
}

export function SocialState({ loading, error, offline = false, empty, emptyTitle = 'Nothing here yet', emptyMessage = 'Nothing to show yet.', onRetry, hasMore, loadingMore, onMore }: { loading: boolean; error: string; offline?: boolean; empty: boolean; emptyTitle?: string; emptyMessage?: string; onRetry: () => void; hasMore?: boolean; loadingMore?: boolean; onMore?: () => void }) {
  if (loading) return <ActivityIndicator accessibilityLabel="Loading social activity" color="#000000" />;
  if (error) return <Card><SocialError message={error} /><Button label="Try again" onPress={onRetry} /></Card>;
  if (offline) return <Card><ThemedText type="subtitle">You’re offline</ThemedText><ThemedText themeColor="textSecondary">Reconnect to refresh social activity. Previously loaded items remain visible.</ThemedText><Button label="Try again" onPress={onRetry} /></Card>;
  if (empty) return <Card><ThemedText type="subtitle">{emptyTitle}</ThemedText><ThemedText themeColor="textSecondary">{emptyMessage}</ThemedText></Card>;
  if (hasMore && onMore) return <Button disabled={loadingMore} label={loadingMore ? 'Loading…' : 'Load more'} onPress={onMore} />;
  return null;
}

export function SocialBack() {
  return <Button label="Back" onPress={() => router.canGoBack() ? router.back() : router.replace('/feed')} />;
}

export function PersonRow({ person, open = true, prominent = false }: { person: SocialPerson; open?: boolean; prominent?: boolean }) {
  const content = <View style={styles.personRow}>
    <Avatar name={person.name} path={person.avatar_path} size={prominent ? 82 : 44} />
    <View style={styles.personCopy}>
      <ThemedText type="smallBold" numberOfLines={1} style={prominent ? styles.prominentName : undefined}>{person.name}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={prominent ? styles.prominentUsername : undefined}>@{person.username}</ThemedText>
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
  const { session } = useAuth();
  const mutation = useSocialMutation();
  const openPlace = () => router.push({ pathname: '/search/[id]', params: { id: post.google_place_id, mode: post.mode } });
  const sharePost = () => void Share.share({ message: `${post.author.name} rated ${place?.name ?? 'a place'} ${Number(post.score).toFixed(1)}/10 on OutThere.${post.notes ? `\n\n${post.notes}` : ''}` });
  return <Card>
    <View style={styles.postHeader}>
      <PersonRow person={post.author} />
      {post.author.id !== session?.user.id ? <Pressable accessibilityLabel="Report post" hitSlop={10} onPress={() => router.push({ pathname: '/feed/report', params: { target: 'post', id: post.id } })}>
        <ThemedText style={styles.more}>•••</ThemedText>
      </Pressable> : null}
    </View>
    {place?.photoUrl ? <Pressable accessibilityRole="button" onPress={openPlace} style={styles.photoFrame}>
      <Image source={place.photoUrl} contentFit="cover" transition={180} style={styles.postPhoto} />
      <View style={styles.scoreOverlay}><ScoreBadge score={Number(post.score)} size="small" /></View>
    </Pressable> : null}
    <Pressable accessibilityRole="button" onPress={openPlace} style={styles.postPlace}>
      <View style={styles.postCopy}>
        <ThemedText style={styles.placeName} numberOfLines={2}>{place?.name ?? 'Loading place…'}</ThemedText>
        <ThemedText style={styles.meta} themeColor="textSecondary" numberOfLines={2}>{place?.address ?? post.mode}</ThemedText>
      </View>
      {!place?.photoUrl ? <ScoreBadge score={Number(post.score)} size="small" /> : null}
    </Pressable>
    {!!post.notes && <ThemedText style={styles.notes}>{post.notes}</ThemedText>}
    <View style={styles.actions}>
      <PostAction disabled={mutation.busy} icon={likeIcon} label={`${post.liked ? 'Unlike' : 'Like'} · ${post.like_count}`} selected={post.liked} onPress={() => void mutation.run(post.liked ? 'unlike' : 'like', { post_id: post.id })} />
      {!detail ? <PostAction icon={commentIcon} label={`Comments · ${post.comment_count}`} onPress={() => router.push({ pathname: '/feed/post/[id]', params: { id: post.id } })} /> : null}
      <PostAction icon={shareIcon} label="Share" onPress={sharePost} />
    </View>
    <ThemedText style={styles.timestamp} themeColor="textSecondary">{new Date(post.created_at).toLocaleString()} · {post.visibility === 'friends' ? 'Friends' : 'Only me'}</ThemedText>
    <SocialError message={mutation.error} />
  </Card>;
}

function PostAction({ disabled, icon, label, onPress, selected = false }: { disabled?: boolean; icon: number; label: string; onPress: () => void; selected?: boolean }) {
  return <Pressable accessibilityLabel={label} accessibilityRole="button" disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.postAction, selected && styles.selectedAction, pressed && styles.pressed]}>
    <Image source={icon} contentFit="contain" style={styles.actionIcon} />
    <ThemedText numberOfLines={1} style={styles.actionLabel}>{label}</ThemedText>
  </Pressable>;
}

const styles = StyleSheet.create({
  field: { minHeight: 48, borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, fontSize: 15 },
  error: { color: '#9A3412', fontSize: 12 },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  personCopy: { flex: 1, minWidth: 0 },
  prominentName: { fontSize: 24, lineHeight: 30 },
  prominentUsername: { fontSize: 14, lineHeight: 19 },
  postHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  more: { fontSize: 16, letterSpacing: 2 },
  photoFrame: { height: 250, marginHorizontal: -18, overflow: 'hidden', backgroundColor: '#F3F4F6' },
  postPhoto: { width: '100%', height: '100%' },
  scoreOverlay: { position: 'absolute', right: 12, bottom: 12 },
  postPlace: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  postCopy: { flex: 1, minWidth: 0 },
  placeName: { fontSize: 17, lineHeight: 22, fontWeight: '700' },
  meta: { fontSize: 13, lineHeight: 18 },
  notes: { fontSize: 15, lineHeight: 21 },
  actions: { flexDirection: 'row', gap: 8 },
  postAction: { minHeight: 42, flex: 1, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#F3F4F6' },
  selectedAction: { backgroundColor: '#E8EBEF' },
  actionIcon: { width: 17, height: 17 },
  actionLabel: { flexShrink: 1, fontSize: 11, lineHeight: 15, fontWeight: '700' },
  timestamp: { fontSize: 12, lineHeight: 16 },
  pressed: { opacity: 0.65, transform: [{ scale: 0.98 }] },
});
