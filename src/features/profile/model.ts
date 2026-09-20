export interface ProfileDraft {
  username: string;
  display_name: string;
  bio: string;
  avatar_path: string | null;
}
export interface Profile extends Omit<ProfileDraft, 'username'> {
  user_id: string;
  username: string | null;
  onboarding_completed: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}
export interface AvatarSelection { uri: string; base64: string }
export const emptyDraft = (): ProfileDraft => ({ username: '', display_name: '', bio: '', avatar_path: null });
export function toDraft(profile: Profile | null): ProfileDraft {
  if (!profile) return emptyDraft();
  const { username, display_name, bio, avatar_path } = profile;
  return { username: username ?? '', display_name, bio, avatar_path };
}
export function normalizeProfile(draft: ProfileDraft): ProfileDraft {
  return { ...draft, username: draft.username.trim().toLowerCase(), display_name: draft.display_name.trim(), bio: draft.bio.trim() };
}
export function validateProfile(draft: ProfileDraft): string | null {
  const value = normalizeProfile(draft);
  if (!value.display_name || value.display_name.length > 60) return 'Enter your name (up to 60 characters).';
  if (!/^[a-z0-9_]{3,24}$/.test(value.username)) return 'Choose a username with 3–24 letters, numbers, or underscores.';
  if (value.bio.length > 240) return 'Keep your bio within 240 characters.';
  return null;
}
export function profileError(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : '';
  if (code === '23505') return 'That username is already taken. Choose another one.';
  if (code === '23514') return 'Some profile details aren’t valid. Check your entries and try again.';
  if (error instanceof Error && error.message.startsWith('Your profile changed')) return error.message;
  return 'We couldn’t save your profile. Check your connection and try again.';
}
