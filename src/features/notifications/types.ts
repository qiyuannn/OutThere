export type NotificationType =
  | 'follow'
  | 'like'
  | 'comment'
  | 'invite'
  | 'invite_accepted'
  | 'invite_declined'
  | 'follow_accepted';

export type FollowStatus = 'pending' | 'accepted' | 'declined';
export type InviteStatus = 'pending' | 'accepted' | 'declined';

export type AppNotification = {
  id: number;
  type: NotificationType;
  createdAt: string;
  isRead: boolean;
  actorId: string;
  actorDisplayName: string;
  actorUsername: string | null;
  actorAvatarUrl: string | null;
  postId: number | null;
  placeName: string | null;
  placeCategory: string | null;
  postRating: number | null;
  postBody: string | null;
  postPhotoUrl: string | null;
  commentId: number | null;
  commentBody: string | null;
  isFollowingActor: boolean;
  googlePlaceId: string | null;
  inviteStatus: InviteStatus | null;
  followStatus: FollowStatus | null;
};

