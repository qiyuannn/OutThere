import { useRef, useState } from 'react';
import { Alert } from 'react-native';
import * as Crypto from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Card, Screen } from '@/components/foundation';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/providers/auth-provider';
import { PersonRow, SocialError, SocialField, SocialPostCard, SocialState, usePostPlaces } from './components';
import { useSocialList, useSocialMutation, useSocialQuery } from './hooks';
import type { SocialComment, SocialPost } from './types';

export default function SocialPostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const post = useSocialQuery<SocialPost>('post', { post_id: id }, !!id);
  const comments = useSocialList<SocialComment>('comments', { post_id: id }, !!post.data);
  const places = usePostPlaces(post.data ? [post.data] : []);
  const mutation = useSocialMutation();
  const [body, setBody] = useState('');
  const retryId = useRef<string | null>(null);

  const submit = async () => {
    const text = body.trim();
    if (!text) return;
    retryId.current ??= Crypto.randomUUID();
    if (await mutation.run('comment', { post_id: id, id: retryId.current, body: text })) {
      retryId.current = null; setBody(''); await comments.refresh(); await post.refresh();
    }
  };
  const removePost = () => Alert.alert('Delete shared post?', 'Your private rating will remain, but likes and comments will be deleted.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: () => { void mutation.run('delete_post', { post_id: id }).then((ok) => { if (ok) router.replace('/feed'); }); } },
  ]);

  return <Screen
    title="Conversation"
    headerDescription="Conversation"
    showBack
    onBack={() => (router.canGoBack() ? router.back() : router.replace('/feed'))}
  >
    <SocialState loading={post.loading} error={post.error} offline={post.offline} empty={false} onRetry={post.refresh} />
    {post.data && <>
      <SocialPostCard post={post.data} place={places[post.data.google_place_id]} detail />
      {post.data.author.id === session?.user.id && <Card>
        <Button disabled={mutation.busy} label={post.data.visibility === 'friends' ? 'Make private' : 'Share with friends'} onPress={() => void mutation.run('post_visibility', { post_id: id, visibility: post.data!.visibility === 'friends' ? 'private' : 'friends' })} />
        <Button disabled={mutation.busy} label="Delete shared post" onPress={removePost} />
      </Card>}
      <Card>
        <ThemedText type="subtitle">Add a comment</ThemedText>
        <SocialField accessibilityLabel="Comment" maxLength={1000} multiline placeholder="Write a comment" value={body} onChangeText={(value) => { setBody(value); retryId.current = null; }} />
        <Button disabled={mutation.busy || !body.trim()} label={mutation.busy ? 'Posting…' : 'Post comment'} onPress={() => void submit()} />
      </Card>
    </>}
    <SocialError message={mutation.error} />
    {comments.items.map((comment) => <Card key={comment.id}>
      <PersonRow person={comment.author} />
      <ThemedText>{comment.body}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">{new Date(comment.created_at).toLocaleString()}</ThemedText>
      {comment.author.id === session?.user.id && <Button label="Delete my comment" disabled={mutation.busy} onPress={() => void mutation.run('delete_comment', { id: comment.id })} />}
      {comment.author.id !== session?.user.id && <Button label="Report comment" onPress={() => router.push({ pathname: '/feed/report', params: { target: 'comment', id: comment.id } })} />}
    </Card>)}
    {!!post.data && <SocialState loading={comments.loading} error={comments.error} offline={comments.offline} empty={!comments.items.length} emptyTitle="No comments yet" emptyMessage="Start the conversation about this rating." onRetry={comments.refresh} hasMore={comments.hasMore} loadingMore={comments.loadingMore} onMore={comments.loadMore} />}
  </Screen>;
}
