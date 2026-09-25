import { supabase } from '@/lib/supabase';
import type { AppNotification, NotificationType } from './types';

const SIGNED_URL_LIFETIME_SECONDS = 3600;

function client() {
  if (!supabase) throw new Error('Supabase client is not configured.');
  return supabase;
}

type NotificationRow = {
  id: number | string;
  type: string;
  created_at: string;
  is_read: boolean;
  actor_id: string;
  actor_display_name: string;
  actor_username: string | null;
  actor_avatar_path: string | null;
  post_id: number | string | null;
  place_name: string | null;
  place_category: string | null;
  post_rating: number | string | null;
  post_body: string | null;
  post_photo_path: string | null;
  comment_id: number | string | null;
  comment_body: string | null;
  is_following_actor: boolean;
  google_place_id: string | null;
  invite_status: string | null;
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

export async function getUserNotifications(limit = 50, offset = 0): Promise<AppNotification[]> {
  const { data, error } = await client().rpc('get_user_notifications', {
    p_limit: limit,
    p_offset: offset,
  });

  if (error) throw error;
  const rows = (data ?? []) as NotificationRow[];

  const [avatarUrls, postPhotoUrls] = await Promise.all([
    getSignedUrls('avatars', rows.flatMap((r) => r.actor_avatar_path ? [r.actor_avatar_path] : [])),
    getSignedUrls('post-photos', rows.flatMap((r) => r.post_photo_path ? [r.post_photo_path] : [])),
  ]);

  return rows.map((r) => ({
    id: Number(r.id),
    type: r.type as NotificationType,
    createdAt: r.created_at,
    isRead: r.is_read,
    actorId: r.actor_id,
    actorDisplayName: r.actor_display_name,
    actorUsername: r.actor_username,
    actorAvatarUrl: r.actor_avatar_path ? avatarUrls.get(r.actor_avatar_path) ?? null : null,
    postId: r.post_id != null ? Number(r.post_id) : null,
    placeName: r.place_name,
    placeCategory: r.place_category,
    postRating: r.post_rating != null ? Number(r.post_rating) : null,
    postBody: r.post_body,
    postPhotoUrl: r.post_photo_path ? postPhotoUrls.get(r.post_photo_path) ?? null : null,
    commentId: r.comment_id != null ? Number(r.comment_id) : null,
    commentBody: r.comment_body,
    isFollowingActor: r.is_following_actor,
    googlePlaceId: r.google_place_id ?? null,
    inviteStatus: (r.invite_status as AppNotification['inviteStatus']) ?? null,
  }));
}

export async function getUnreadNotificationCount(): Promise<number> {
  const { data, error } = await client().rpc('get_unread_notification_count');
  if (error) throw error;
  return Number(data ?? 0);
}

export async function markNotificationsRead(notificationIds?: number[]): Promise<void> {
  const { error } = await client().rpc('mark_notifications_read', {
    p_notification_ids: notificationIds ?? null,
  });
  if (error) throw error;
}

export async function sendPlaceInvite(
  recipientId: string,
  googlePlaceId: string,
  placeName?: string
): Promise<number> {
  const { data, error } = await client().rpc('send_place_invite', {
    p_recipient_id: recipientId,
    p_google_place_id: googlePlaceId,
    p_place_name: placeName ?? null,
  });

  if (error) throw error;
  return Number(data);
}

export async function respondToPlaceInvite(
  notificationId: number,
  status: 'accepted' | 'declined'
): Promise<void> {
  const { error } = await client().rpc('respond_to_place_invite', {
    p_notification_id: notificationId,
    p_status: status,
  });

  if (error) throw error;
}

export async function getSentPlaceInvites(googlePlaceId: string): Promise<Set<string>> {
  const { data, error } = await client().rpc('get_sent_place_invites', {
    p_google_place_id: googlePlaceId,
  });

  if (error) throw error;
  const rows = (data ?? []) as { recipient_id: string }[];
  return new Set(rows.map((r) => r.recipient_id));
}

