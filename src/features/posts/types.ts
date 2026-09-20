export type SelectedPostPhoto = {
  uri: string;
  base64: string;
  mimeType: string;
};

export type CreatePostInput = {
  googlePlaceId: string;
  rating: number;
  body: string;
  photos: SelectedPostPhoto[];
};

export type FeedCursor = {
  createdAt: string;
  id: number;
};

export type FeedPost = {
  id: number;
  userId: string;
  googlePlaceId: string;
  rating: number;
  body: string;
  createdAt: string;
  displayName: string;
  avatarUrl: string | null;
  placeName: string;
  placeCategory: string | null;
  placeAddress: string | null;
  placePriceLevel: string | null;
  placeRegularOpeningHours: string[];
  photoUrls: string[];
  likeCount: number;
  likedByMe: boolean;
};

export type FeedPage = {
  posts: FeedPost[];
  nextCursor: FeedCursor | null;
};
