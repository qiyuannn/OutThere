export const INTERESTS = [
  ['nature', 'Nature & outdoors', '↟'], ['culture', 'Arts & culture', '◈'],
  ['active', 'Get moving', '↗'], ['entertainment', 'Entertainment', '✦'],
  ['relaxation', 'Slow moments', '☼'], ['learning', 'Learn something', '⌘'],
  ['cafes', 'Café hopping', '☕'], ['local_food', 'Local food', '◒'],
  ['restaurants', 'Dining out', '◇'], ['desserts', 'Sweet treats', '♡'],
] as const;
export const BUDGETS = [ ['free', 'Free', 'Keep it free'], ['low', 'Low', 'Easy on the wallet'], ['medium', 'Moderate', 'A little treat'], ['flexible', 'Flexible', 'Open to options'] ] as const;
export const EXPLORATION = [ ['familiar', 'Comfort zone', 'More of what I love'], ['balanced', 'A little of both', 'Favourites and discoveries'], ['adventurous', 'Surprise me', 'Try something different'] ] as const;
export type Interest = typeof INTERESTS[number][0];
export interface ProfileDraft {
  username: string;
  display_name: string;
  bio: string;
  city: string;
  interests: Interest[];
  budget: typeof BUDGETS[number][0];
  travel_radius_meters: number;
  exploration_style: typeof EXPLORATION[number][0];
  avatar_path: string | null;
}
export interface Profile extends Omit<ProfileDraft, 'username'> {
  user_id: string;
  username: string | null;
  onboarding_step: number;
  onboarding_completed: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}
export interface AvatarSelection { uri: string; base64: string }
export const emptyDraft = (): ProfileDraft => ({ username: '', display_name: '', bio: '', city: '', interests: [], budget: 'flexible', travel_radius_meters: 10000, exploration_style: 'balanced', avatar_path: null });
export function toDraft(profile: Profile | null): ProfileDraft {
  if (!profile) return emptyDraft();
  const { username, display_name, bio, city, interests, budget, travel_radius_meters, exploration_style, avatar_path } = profile;
  return { username: username ?? '', display_name, bio, city, interests: [...interests], budget, travel_radius_meters, exploration_style, avatar_path };
}
export function normalizeProfile(draft: ProfileDraft): ProfileDraft {
  return { ...draft, username: draft.username.trim().toLowerCase(), display_name: draft.display_name.trim(), city: draft.city.trim(), bio: draft.bio.trim(), interests: [...new Set(draft.interests)] };
}
export function validateProfile(draft: ProfileDraft, step?: number): string | null {
  const value = normalizeProfile(draft);
  if (step === undefined || step === 0) {
    if (!value.display_name || value.display_name.length > 60) return 'Enter your name (up to 60 characters).';
    if (!/^[a-z0-9_]{3,24}$/.test(value.username)) return 'Choose a username with 3–24 letters, numbers, or underscores.';
    if (value.bio.length > 240) return 'Keep your bio within 240 characters.';
  }
  if (step === undefined || step === 1) {
    if (!value.city || value.city.length > 80) return 'Enter your home city (up to 80 characters).';
    if (!value.interests.length || value.interests.some(id => !INTERESTS.some(([key]) => key === id))) return 'Choose at least one of the interests below.';
  }
  if (step === undefined || step === 2) {
    if (!BUDGETS.some(([id]) => id === value.budget)) return 'Choose a budget preference.';
    if (!EXPLORATION.some(([id]) => id === value.exploration_style)) return 'Choose your exploration style.';
    if (!Number.isInteger(value.travel_radius_meters) || value.travel_radius_meters < 1000 || value.travel_radius_meters > 50000) return 'Choose a travel range between 1 and 50 km.';
  }
  return null;
}
export function profileError(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : '';
  if (code === '23505') return 'That username is already taken. Choose another one.';
  if (code === '23514') return 'Some profile details aren’t valid. Check your entries and try again.';
  if (error instanceof Error && error.message.startsWith('Your profile changed')) return error.message;
  return 'We couldn’t save your profile. Check your connection and try again.';
}
