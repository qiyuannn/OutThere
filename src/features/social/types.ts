export type SocialVisibility = 'private' | 'friends';
export type Relationship = 'self' | 'none' | 'incoming' | 'outgoing' | 'friends';

export interface SocialPerson {
  id: string;
  username: string;
  name: string;
  bio: string;
  avatar_path: string | null;
}

export interface SocialSettings {
  enabled: boolean;
  default_visibility: SocialVisibility;
}

export interface SocialSummary {
  enabled: boolean;
  friends: number;
  incoming: number;
  outgoing: number;
  unread: number;
}

export interface SocialProfile {
  person: SocialPerson;
  relationship: Relationship;
}

export interface SocialPost {
  id: string;
  author: SocialPerson;
  google_place_id: string;
  mode: 'food' | 'activities';
  score: number;
  notes: string;
  recommend: boolean;
  visibility: SocialVisibility;
  created_at: string;
  liked: boolean;
  like_count: number;
  comment_count: number;
}

export interface SocialComment {
  id: string;
  author: SocialPerson;
  body: string;
  created_at: string;
}

export interface SocialNotification {
  id: string;
  actor: SocialPerson;
  kind: 'request' | 'accepted' | 'like' | 'comment';
  post_id: string | null;
  read: boolean;
  created_at: string;
}

export type SocialReadAction = 'settings' | 'people' | 'profile' | 'connections' | 'feed' | 'post' | 'comments' | 'notifications' | 'unread';
export type SocialMutation = 'settings_update' | 'request' | 'accept' | 'decline' | 'cancel' | 'remove_friend' | 'block' | 'unblock' | 'rating_visibility' | 'like' | 'unlike' | 'comment' | 'delete_comment' | 'delete_post' | 'post_visibility' | 'mark_read';
