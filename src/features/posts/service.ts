import { decode } from 'base64-arraybuffer';

import { supabase } from '@/lib/supabase';
import type { CreatePostInput, FeedCursor, FeedPage, FeedPost, FeedScope, PostComment } from './types';

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

function client() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

function extensionFor(mimeType: string) {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/heic') return 'heic';
  if (mimeType === 'image/heif') return 'heif';
  return 'jpg';
}

export async function createPost(userId: string, input: CreatePostInput): Promise<string> {
  const db = client();
  const body = input.body.trim();
  if (!body && input.photos.length === 0) throw new Error('Add a note or photo before posting.');
  if (body.length > 2000) throw new Error('Your post must be 2,000 characters or fewer.');
  if (input.photos.length > 5) throw new Error('Choose up to five photos.');

  const uploadedPaths: string[] = [];
  let committed = false;
  try {
    for (const [index, photo] of input.photos.entries()) {
      const bytes = decode(photo.base64);
      if (!bytes.byteLength || bytes.byteLength > MAX_PHOTO_BYTES) throw new Error('Each photo must be under 5 MB.');
      const path = `${userId}/${Date.now()}-${index}-${Math.random().toString(36).slice(2)}.${extensionFor(photo.mimeType)}`;
      const { error } = await db.storage.from('post-photos').upload(path, bytes, {
        contentType: photo.mimeType,
        upsert: false,
      });
      if (error) throw error;
      uploadedPaths.push(path);
    }

    const { data, error } = await db.from('posts').insert({
      user_id: userId,
      google_place_id: input.googlePlaceId,
      rating: Math.max(0, Math.min(10, Math.round(input.rating * 10) / 10)),
      body,
      photo_paths: uploadedPaths,
    }).select('id').single();
    if (error) throw error;
    committed = true;
    return String(data.id);
  } finally {
    if (!committed && uploadedPaths.length) {
      await db.storage.from('post-photos').remove(uploadedPaths).catch(() => undefined);
    }
  }
}

export async function hasUserPostedAboutPlace(userId: string, googlePlaceId: string): Promise<boolean> {
  const { data, error } = await client()
    .from('posts')
    .select('id')
    .eq('user_id', userId)
    .eq('google_place_id', googlePlaceId)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data !== null;
}

const FEED_PAGE_SIZE = 20;
const SIGNED_URL_LIFETIME_SECONDS = 60 * 60;

type FeedPostRow = {
  id: number | string;
  user_id: string;
  google_place_id: string;
  rating: number | string;
  body: string;
  photo_paths: string[] | null;
  created_at: string;
  display_name: string;
  avatar_path: string | null;
  place_name: string;
  place_category: string | null;
  place_address: string | null;
  place_price_level: string | null;
  regular_opening_hours?: unknown;
  like_count: number | string;
  liked_by_me: boolean;
  comment_count?: number | string;
};

async function getSignedUrls(bucket: 'avatars' | 'post-photos', paths: string[]): Promise<Map<string, string>> {
  const uniquePaths = [...new Set(paths.filter(Boolean))];
  if (uniquePaths.length === 0) return new Map();

  const { data, error } = await client().storage
    .from(bucket)
    .createSignedUrls(uniquePaths, SIGNED_URL_LIFETIME_SECONDS);

  if (error || !data) return new Map();
  return new Map(data.flatMap((item) => item.path && item.signedUrl ? [[item.path, item.signedUrl] as const] : []));
}

async function getPostPage(
  onlyCurrentUser: boolean,
  cursor: FeedCursor | null,
  targetUserId?: string,
  feedScope?: FeedScope,
): Promise<FeedPage> {
  const { data, error } = await client().rpc('get_feed_posts', {
    p_before_created_at: cursor?.createdAt ?? null,
    p_before_id: cursor?.id ?? null,
    p_limit: FEED_PAGE_SIZE,
    p_only_current_user: onlyCurrentUser,
    p_target_user_id: targetUserId ?? null,
    p_feed_scope: feedScope ?? 'explore',
  });
  if (error) throw error;

  const rows = (data ?? []) as FeedPostRow[];
  const [avatarUrls, postPhotoUrls] = await Promise.all([
    getSignedUrls('avatars', rows.flatMap((row) => row.avatar_path ? [row.avatar_path] : [])),
    getSignedUrls('post-photos', rows.flatMap((row) => row.photo_paths ?? [])),
  ]);

  const posts: FeedPost[] = rows.map((row) => ({
    id: Number(row.id),
    userId: row.user_id,
    googlePlaceId: row.google_place_id,
    rating: Number(row.rating),
    body: row.body,
    createdAt: row.created_at,
    displayName: row.display_name,
    avatarUrl: row.avatar_path ? avatarUrls.get(row.avatar_path) ?? null : null,
    placeName: row.place_name,
    placeCategory: row.place_category,
    placeAddress: row.place_address,
    placePriceLevel: row.place_price_level,
    placeRegularOpeningHours: Array.isArray(row.regular_opening_hours)
      ? row.regular_opening_hours.filter((value): value is string => typeof value === 'string')
      : [],
    photoUrls: (row.photo_paths ?? []).flatMap((path) => {
      const url = postPhotoUrls.get(path);
      return url ? [url] : [];
    }),
    likeCount: Number(row.like_count),
    likedByMe: row.liked_by_me,
    commentCount: row.comment_count != null ? Number(row.comment_count) : 0,
  }));

  const last = rows.at(-1);
  return {
    posts,
    nextCursor: rows.length === FEED_PAGE_SIZE && last
      ? { createdAt: last.created_at, id: Number(last.id) }
      : null,
  };
}

export function getFeedPage(cursor: FeedCursor | null = null, scope: FeedScope = 'explore'): Promise<FeedPage> {
  return getPostPage(false, cursor, undefined, scope);
}

export function getMyPostsPage(cursor: FeedCursor | null = null): Promise<FeedPage> {
  return getPostPage(true, cursor);
}

export function getUserPostsPage(targetUserId: string, cursor: FeedCursor | null = null): Promise<FeedPage> {
  return getPostPage(false, cursor, targetUserId);
}

export async function setPostLiked(postId: number, userId: string, liked: boolean): Promise<void> {
  const db = client();
  const { error } = liked
    ? await db.from('post_likes').insert({ post_id: postId, user_id: userId })
    : await db.from('post_likes').delete().eq('post_id', postId).eq('user_id', userId);
  if (error) throw error;
}

export async function getPostDetail(postId: number): Promise<FeedPost | null> {
  const { data, error } = await client().rpc('get_post_detail', { p_post_id: postId });
  if (error) throw error;
  const rows = (data ?? []) as FeedPostRow[];
  if (rows.length === 0) return null;
  const row = rows[0];

  const [avatarUrls, postPhotoUrls] = await Promise.all([
    getSignedUrls('avatars', row.avatar_path ? [row.avatar_path] : []),
    getSignedUrls('post-photos', row.photo_paths ?? []),
  ]);

  return {
    id: Number(row.id),
    userId: row.user_id,
    googlePlaceId: row.google_place_id,
    rating: Number(row.rating),
    body: row.body,
    createdAt: row.created_at,
    displayName: row.display_name,
    avatarUrl: row.avatar_path ? avatarUrls.get(row.avatar_path) ?? null : null,
    placeName: row.place_name,
    placeCategory: row.place_category,
    placeAddress: row.place_address,
    placePriceLevel: row.place_price_level,
    placeRegularOpeningHours: Array.isArray(row.regular_opening_hours)
      ? row.regular_opening_hours.filter((value): value is string => typeof value === 'string')
      : [],
    photoUrls: (row.photo_paths ?? []).flatMap((path) => {
      const url = postPhotoUrls.get(path);
      return url ? [url] : [];
    }),
    likeCount: Number(row.like_count),
    likedByMe: row.liked_by_me,
    commentCount: row.comment_count != null ? Number(row.comment_count) : 0,
  };
}

type PostCommentRow = {
  id: number | string;
  post_id: number | string;
  user_id: string;
  body: string;
  created_at: string;
  display_name: string;
  username: string | null;
  avatar_path: string | null;
};

export async function getPostComments(postId: number): Promise<PostComment[]> {
  const { data, error } = await client().rpc('get_post_comments', { p_post_id: postId });
  if (error) throw error;
  const rows = (data ?? []) as PostCommentRow[];
  const avatarUrls = await getSignedUrls(
    'avatars',
    rows.flatMap((r) => r.avatar_path ? [r.avatar_path] : [])
  );

  return rows.map((r) => ({
    id: Number(r.id),
    postId: Number(r.post_id),
    userId: r.user_id,
    body: r.body,
    createdAt: r.created_at,
    displayName: r.display_name,
    username: r.username,
    avatarUrl: r.avatar_path ? avatarUrls.get(r.avatar_path) ?? null : null,
  }));
}

export async function createComment(postId: number, userId: string, body: string): Promise<PostComment> {
  const cleanBody = body.trim();
  if (!cleanBody) throw new Error('Comment cannot be empty.');
  if (cleanBody.length > 1000) throw new Error('Comment must be 1,000 characters or fewer.');

  const db = client();
  const { data, error } = await db
    .from('post_comments')
    .insert({ post_id: postId, user_id: userId, body: cleanBody })
    .select('id, created_at')
    .single();
  if (error) throw error;

  const { data: profile } = await db
    .from('profiles')
    .select('display_name, username, avatar_path')
    .eq('user_id', userId)
    .maybeSingle();

  let avatarUrl: string | null = null;
  if (profile?.avatar_path) {
    const avatarMap = await getSignedUrls('avatars', [profile.avatar_path]);
    avatarUrl = avatarMap.get(profile.avatar_path) ?? null;
  }

  return {
    id: Number(data.id),
    postId,
    userId,
    body: cleanBody,
    createdAt: data.created_at,
    displayName: profile?.display_name?.trim() || profile?.username?.trim() || 'OutThere user',
    username: profile?.username ?? null,
    avatarUrl,
  };
}

export async function deleteComment(commentId: number, userId: string): Promise<void> {
  const { error } = await client()
    .from('post_comments')
    .delete()
    .eq('id', commentId)
    .eq('user_id', userId);
  if (error) throw error;
}
